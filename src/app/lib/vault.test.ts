import { describe, expect, it } from 'vitest';

import {
  createVault,
  rotatePassphrase,
  unlockVault,
  VaultError,
  type VaultKeyRecord,
} from './vault';

// PBKDF2 at 600k iterations is slow by design. Each unlock costs one.
const SLOW = 30_000;

const PASSPHRASE = 'the church basement on tuesday';
const KEY_ID = '00000000-0000-4000-8000-000000000001';

async function newVault(passphrase = PASSPHRASE): Promise<VaultKeyRecord> {
  return { id: KEY_ID, ...(await createVault(passphrase)) };
}

describe('createVault', () => {
  it(
    'returns nothing derived from the passphrase',
    async () => {
      const record = await createVault(PASSPHRASE);
      const serialized = JSON.stringify(record).toLowerCase();

      // The single most important assertion in this file. If the passphrase,
      // or anything recognisably derived from it, appears in what we POST to
      // the server, §3.3 is broken and everything else here is theatre.
      expect(serialized).not.toContain('church');
      expect(serialized).not.toContain('basement');
      expect(serialized).not.toContain(PASSPHRASE);
      expect(Object.keys(record).sort()).toEqual([
        'kdfIterations',
        'kdfSalt',
        'wrapNonce',
        'wrappedDek',
      ]);
    },
    SLOW,
  );

  it(
    'salts, so two vaults with the same passphrase differ',
    async () => {
      const [a, b] = await Promise.all([createVault(PASSPHRASE), createVault(PASSPHRASE)]);
      expect(a.kdfSalt).not.toBe(b.kdfSalt);
      expect(a.wrappedDek).not.toBe(b.wrappedDek);
    },
    SLOW,
  );

  it('refuses a passphrase too short to be worth deriving from', async () => {
    await expect(createVault('short')).rejects.toThrow(VaultError);
  });
});

describe('seal and open', () => {
  it(
    'round-trips a note',
    async () => {
      const vault = await unlockVault(PASSPHRASE, await newVault());
      const sealed = await vault.seal('Prefers to be called in the evening. Works nights.');

      expect(sealed.keyId).toBe(KEY_ID);
      expect(await vault.open(sealed)).toBe('Prefers to be called in the evening. Works nights.');
    },
    SLOW,
  );

  it(
    'leaks no plaintext into the ciphertext',
    async () => {
      const vault = await unlockVault(PASSPHRASE, await newVault());
      const sealed = await vault.seal('arrested at the november action');

      expect(sealed.ciphertext.toLowerCase()).not.toContain('arrested');
      expect(sealed.ciphertext.toLowerCase()).not.toContain('november');
    },
    SLOW,
  );

  it(
    'uses a fresh nonce per note, so identical notes differ on the wire',
    async () => {
      const vault = await unlockVault(PASSPHRASE, await newVault());
      const [a, b] = await Promise.all([vault.seal('same text'), vault.seal('same text')]);

      expect(a.nonce).not.toBe(b.nonce);
      expect(a.ciphertext).not.toBe(b.ciphertext);
    },
    SLOW,
  );

  it(
    'rejects a tampered ciphertext rather than returning garbage',
    async () => {
      const vault = await unlockVault(PASSPHRASE, await newVault());
      const sealed = await vault.seal('do not modify me');

      // Flip a byte in the middle of the ciphertext.
      const bytes = Uint8Array.from(atob(sealed.ciphertext), (c) => c.charCodeAt(0));
      bytes[Math.floor(bytes.length / 2)] ^= 0xff;
      const tampered = btoa(String.fromCharCode(...bytes));

      await expect(vault.open({ ciphertext: tampered, nonce: sealed.nonce })).rejects.toThrow(
        VaultError,
      );
    },
    SLOW,
  );

  it(
    'refuses to work once locked',
    async () => {
      const vault = await unlockVault(PASSPHRASE, await newVault());
      const sealed = await vault.seal('x');
      vault.lock();

      await expect(vault.open(sealed)).rejects.toThrow(/locked/);
      await expect(vault.seal('y')).rejects.toThrow(/locked/);
    },
    SLOW,
  );
});

describe('unlockVault', () => {
  it(
    'rejects the wrong passphrase',
    async () => {
      const record = await newVault();
      await expect(unlockVault('the wrong passphrase entirely', record)).rejects.toThrow(VaultError);
    },
    SLOW,
  );

  it(
    'refuses a record whose KDF cost has been tampered down',
    async () => {
      const record = await newVault();
      // An attacker who can alter what the server returns could otherwise ask
      // the browser to derive with an iteration count cheap to brute-force.
      await expect(unlockVault(PASSPHRASE, { ...record, kdfIterations: 1 })).rejects.toThrow(
        /unsafe key-derivation cost/,
      );
    },
    SLOW,
  );
});

describe('rotatePassphrase', () => {
  it(
    'leaves existing notes readable — the point of wrapping a DEK',
    async () => {
      const record = await newVault();
      const before = await unlockVault(PASSPHRASE, record);
      const sealed = await before.seal('written under the old passphrase');

      const rotated = await rotatePassphrase(PASSPHRASE, 'a completely different passphrase', record);

      // Same key id, so contact_notes.key_id stays valid.
      expect(rotated.id).toBe(record.id);
      expect(rotated.wrappedDek).not.toBe(record.wrappedDek);

      const after = await unlockVault('a completely different passphrase', rotated);
      expect(await after.open(sealed)).toBe('written under the old passphrase');
    },
    SLOW * 2,
  );

  it(
    'stops the old passphrase working',
    async () => {
      const record = await newVault();
      const rotated = await rotatePassphrase(PASSPHRASE, 'a completely different passphrase', record);

      await expect(unlockVault(PASSPHRASE, rotated)).rejects.toThrow(VaultError);
    },
    SLOW * 2,
  );

  it(
    'requires the current passphrase',
    async () => {
      const record = await newVault();
      await expect(rotatePassphrase('not the current one', 'a new passphrase here', record)).rejects.toThrow(
        VaultError,
      );
    },
    SLOW,
  );
});
