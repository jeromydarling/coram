/**
 * vault — client-side encryption for organizer notes (§3.3).
 *
 * "Organizer notes on people are client-side encrypted with a tenant-held key
 * derived from the steward's passphrase. The server stores ciphertext and
 * cannot decrypt it. This is the single most important architectural decision
 * in the product."
 *
 * The shape:
 *
 *   passphrase --PBKDF2--> KEK --AES-GCM--> wraps a random DEK
 *   DEK --AES-GCM--> seals each note
 *
 * Two keys rather than one, because it means changing a passphrase re-wraps a
 * single 32-byte DEK instead of re-encrypting every note a workspace has ever
 * written. Rotation stays a fast, safe operation, which is what makes it
 * something a steward will actually do.
 *
 * ---------------------------------------------------------------------------
 * What this does not protect against, stated plainly rather than left implied:
 *
 *   - The server sees metadata. Which contact has notes, how many, roughly how
 *     long, and when they were written. Encryption hides content, not shape.
 *   - We serve the JavaScript. A coerced or compromised deployment could ship a
 *     build that exfiltrates the passphrase. Client-side encryption raises the
 *     cost of quiet mass access; it does not make targeted access impossible.
 *     Subresource integrity and reproducible builds are the answer to that, and
 *     they belong on the roadmap rather than in a comment claiming otherwise.
 *   - A forgotten passphrase means the notes are gone. There is no recovery
 *     path and adding one would mean holding a key, which is the whole thing we
 *     are declining to do.
 *   - JavaScript cannot reliably zero memory. The DEK lives in the tab until
 *     it is closed. `lock()` drops our reference and is honest about being a
 *     best effort, not a guarantee.
 * ---------------------------------------------------------------------------
 */

const enc = new TextEncoder();
const dec = new TextDecoder();

/** Same figure the Worker uses for passwords. OWASP 2023 for PBKDF2-SHA256. */
export const KDF_ITERATIONS = 600_000;

const SALT_BYTES = 16;
const NONCE_BYTES = 12; // AES-GCM standard
const DEK_BYTES = 32; // AES-256

/** The server's half of a vault. Exactly what `vault_keys` stores. */
export interface VaultKeyRecord {
  id: string;
  wrappedDek: string;
  wrapNonce: string;
  kdfSalt: string;
  kdfIterations: number;
}

/** A sealed note. Exactly what `contact_notes` stores. */
export interface SealedNote {
  ciphertext: string;
  nonce: string;
  keyId: string;
}

export class VaultError extends Error {}

/**
 * An unlocked vault, live in the tab.
 *
 * `dek` is imported non-extractable, so once unlocked the raw key bytes cannot
 * be read back out of the CryptoKey — not by our code and not by anything that
 * gets a reference to it. The bytes are kept separately and only when the
 * caller asked to be able to rotate, because rotation is the one operation
 * that genuinely needs them.
 */
export interface UnlockedVault {
  keyId: string;
  seal(plaintext: string): Promise<SealedNote>;
  open(note: Pick<SealedNote, 'ciphertext' | 'nonce'>): Promise<string>;
  lock(): void;
}

// ---------------------------------------------------------------------------
// Creating and unlocking
// ---------------------------------------------------------------------------

/**
 * Create a workspace's vault. Called once, by a steward, at setup.
 *
 * Returns the record to POST to the server. The passphrase and the DEK are not
 * in it — check that for yourself before wiring this up, because a mistake here
 * is the one bug in this file that would silently defeat the entire design.
 */
export async function createVault(
  passphrase: string,
): Promise<Omit<VaultKeyRecord, 'id'>> {
  assertUsablePassphrase(passphrase);

  const kdfSalt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const wrapNonce = crypto.getRandomValues(new Uint8Array(NONCE_BYTES));
  const dek = crypto.getRandomValues(new Uint8Array(DEK_BYTES));

  const kek = await deriveKek(passphrase, kdfSalt, KDF_ITERATIONS);
  const wrapped = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: wrapNonce as BufferSource },
    kek,
    dek as BufferSource,
  );

  return {
    wrappedDek: b64(new Uint8Array(wrapped)),
    wrapNonce: b64(wrapNonce),
    kdfSalt: b64(kdfSalt),
    kdfIterations: KDF_ITERATIONS,
  };
}

/**
 * Unlock a vault for this session.
 *
 * A wrong passphrase fails as an AES-GCM authentication error, which is what
 * makes "is this the right passphrase" answerable without the server storing
 * any verifier it could be checked against.
 */
export async function unlockVault(
  passphrase: string,
  record: VaultKeyRecord,
): Promise<UnlockedVault> {
  const dekBytes = await unwrapDek(passphrase, record);

  let dek: CryptoKey | null = await crypto.subtle.importKey(
    'raw',
    dekBytes as BufferSource,
    'AES-GCM',
    false, // non-extractable: the bytes cannot be read back out
    ['encrypt', 'decrypt'],
  );

  // Our copy of the raw bytes has done its job.
  dekBytes.fill(0);

  return {
    keyId: record.id,

    async seal(plaintext: string): Promise<SealedNote> {
      if (!dek) throw new VaultError('This vault is locked.');
      const nonce = crypto.getRandomValues(new Uint8Array(NONCE_BYTES));
      const sealed = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: nonce as BufferSource },
        dek,
        enc.encode(plaintext) as BufferSource,
      );
      return {
        ciphertext: b64(new Uint8Array(sealed)),
        nonce: b64(nonce),
        keyId: record.id,
      };
    },

    async open(note): Promise<string> {
      if (!dek) throw new VaultError('This vault is locked.');
      try {
        const opened = await crypto.subtle.decrypt(
          { name: 'AES-GCM', iv: unb64(note.nonce) as BufferSource },
          dek,
          unb64(note.ciphertext) as BufferSource,
        );
        return dec.decode(opened);
      } catch {
        // GCM authentication failed: wrong key, or the ciphertext was altered.
        // Both mean the same thing to a caller — this note cannot be trusted.
        throw new VaultError('This note could not be decrypted. It may have been written with a different passphrase.');
      }
    },

    lock() {
      dek = null;
    },
  };
}

/**
 * Change the passphrase.
 *
 * Re-wraps the DEK and returns a new record. **No note is touched**, because
 * notes are sealed under the DEK and the DEK does not change. That is the
 * payoff of the two-key design, and it is why rotation is cheap enough to do
 * whenever someone leaves a group.
 *
 * The returned record keeps the same `id`, so `contact_notes.key_id` stays
 * valid across the rotation.
 */
export async function rotatePassphrase(
  oldPassphrase: string,
  newPassphrase: string,
  record: VaultKeyRecord,
): Promise<VaultKeyRecord> {
  assertUsablePassphrase(newPassphrase);

  const dekBytes = await unwrapDek(oldPassphrase, record);

  try {
    const kdfSalt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
    const wrapNonce = crypto.getRandomValues(new Uint8Array(NONCE_BYTES));
    const kek = await deriveKek(newPassphrase, kdfSalt, KDF_ITERATIONS);

    const wrapped = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: wrapNonce as BufferSource },
      kek,
      dekBytes as BufferSource,
    );

    return {
      id: record.id,
      wrappedDek: b64(new Uint8Array(wrapped)),
      wrapNonce: b64(wrapNonce),
      kdfSalt: b64(kdfSalt),
      kdfIterations: KDF_ITERATIONS,
    };
  } finally {
    dekBytes.fill(0);
  }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

async function unwrapDek(passphrase: string, record: VaultKeyRecord): Promise<Uint8Array> {
  if (!record.kdfIterations || record.kdfIterations < 100_000) {
    // A tampered or corrupted record could otherwise ask us to derive a key
    // with an iteration count low enough to brute-force offline.
    throw new VaultError('This vault record has an unsafe key-derivation cost and was refused.');
  }

  const kek = await deriveKek(passphrase, unb64(record.kdfSalt), record.kdfIterations);

  try {
    const dek = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: unb64(record.wrapNonce) as BufferSource },
      kek,
      unb64(record.wrappedDek) as BufferSource,
    );
    return new Uint8Array(dek);
  } catch {
    throw new VaultError('That passphrase is not the one this workspace was set up with.');
  }
}

async function deriveKek(
  passphrase: string,
  salt: Uint8Array,
  iterations: number,
): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    'raw',
    enc.encode(passphrase) as BufferSource,
    'PBKDF2',
    false,
    ['deriveKey'],
  );

  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations },
    material,
    { name: 'AES-GCM', length: 256 },
    false, // the KEK is never extractable
    ['encrypt', 'decrypt'],
  );
}

/**
 * Length only, matching the Worker's password rule. Character-class
 * requirements push people toward predictable substitutions and shorter
 * effective secrets.
 */
function assertUsablePassphrase(passphrase: string): void {
  if (passphrase.length < 12) {
    throw new VaultError('Use a passphrase of at least 12 characters. There is no way to recover it.');
  }
}

function b64(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

function unb64(s: string): Uint8Array {
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}
