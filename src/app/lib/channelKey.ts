/**
 * Sealing for Colloquium (§5.7), in the browser.
 *
 * The server holds ciphertext and never a key. That is the whole point of the
 * module, and it forces an awkward question this file answers plainly rather
 * than papering over: where does the key come from?
 *
 * Here it comes from a passphrase the channel's members agree out of band —
 * said aloud in a room, not typed into Coram. PBKDF2 stretches it, salted with
 * the channel id so the same passphrase in two rooms produces two keys, and
 * AES-GCM seals each message under it. The key lives in this tab and nowhere
 * else: not in localStorage, not in a cookie, not on our side of the wire.
 *
 * What this is not, stated rather than implied:
 *
 *   - It is not Signal. There is no forward secrecy, no ratchet, no device
 *     verification. Someone who learns the passphrase can read everything still
 *     inside the TTL window, including messages sent before they learned it.
 *   - Key distribution is a human problem here. That is a real limitation and
 *     the honest place for it is a sentence in the UI, which Messages.tsx
 *     carries, not a comment nobody reads.
 *   - We serve the JavaScript. A coerced deployment could ship a build that
 *     leaks the passphrase. Client-side encryption raises the cost of quiet
 *     mass access; it does not make targeted access impossible.
 *
 * The retention promise does not depend on any of that. Even against a group
 * that never seals well, the server keeps envelopes only and the ciphertext
 * expires on the channel's TTL.
 */

const ITERATIONS = 300_000;

const enc = new TextEncoder();
const dec = new TextDecoder();

export class SealError extends Error {}

/**
 * Derive a channel key. Non-extractable, so once derived the raw bytes cannot
 * be read back out — not by our code and not by anything holding a reference.
 */
export async function channelKey(passphrase: string, channelId: string): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey('raw', enc.encode(passphrase), 'PBKDF2', false, [
    'deriveKey',
  ]);

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      // The channel id, not a random salt. It has to be reproducible from
      // nothing but the passphrase and the room, because there is no key
      // record on the server to fetch a salt from — that is the point.
      salt: enc.encode(`coram:channel:${channelId}`),
      iterations: ITERATIONS,
      hash: 'SHA-256',
    },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function seal(key: CryptoKey, plaintext: string) {
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const sealed = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce },
    key,
    enc.encode(plaintext),
  );
  return { ciphertext: b64(new Uint8Array(sealed)), nonce: b64(nonce) };
}

/**
 * Open a message, or fail.
 *
 * A wrong passphrase produces an authentication failure rather than garbage —
 * that is AES-GCM doing its job — and the caller shows it as "sealed with a
 * different passphrase" rather than as a broken message.
 */
export async function open(key: CryptoKey, ciphertext: string, nonce: string): Promise<string> {
  try {
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: unb64(nonce) },
      key,
      unb64(ciphertext),
    );
    return dec.decode(plain);
  } catch {
    throw new SealError('This was sealed with a different passphrase.');
  }
}

const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));

const unb64 = (value: string) =>
  Uint8Array.from(atob(value), (ch) => ch.charCodeAt(0));
