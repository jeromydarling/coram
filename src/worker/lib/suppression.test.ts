import { describe, expect, it } from 'vitest';

import type { Env } from '../env';
import { contactHashes, hashIdentifier, normalizeEmail, normalizePhone } from './suppression';

const env = { SUPPRESSION_PEPPER: 'test-pepper-not-used-anywhere-real' } as Env;
const other = { SUPPRESSION_PEPPER: 'a different pepper entirely' } as Env;

describe('normalizeEmail', () => {
  it('lowercases and trims', () => {
    expect(normalizeEmail('  Ada@Example.ORG ')).toBe('ada@example.org');
  });

  // Deliberate. Stripping dots or plus-tags is a provider-specific guess, and
  // guessing wrong suppresses an address whose owner never opted out.
  it('leaves plus-tags and dots alone', () => {
    expect(normalizeEmail('a.b+union@example.org')).toBe('a.b+union@example.org');
  });
});

describe('normalizePhone', () => {
  it('reduces the ways one number can be written to one', () => {
    const forms = ['+1 (555) 013-4567', '+1-555-013-4567', '+15550134567', '+1 555 013 4567'];
    const normalized = new Set(forms.map(normalizePhone));

    // If these disagreed, a STOP from one form would not stop a send addressed
    // in another — the ledger would fail open.
    expect(normalized.size).toBe(1);
    expect([...normalized][0]).toBe('+15550134567');
  });

  it('keeps a leading + but not other punctuation', () => {
    expect(normalizePhone('(555) 013-4567')).toBe('5550134567');
    expect(normalizePhone('+44 20 7946 0000')).toBe('+442079460000');
  });
});

describe('hashIdentifier', () => {
  it('is stable for the same input', async () => {
    const a = await hashIdentifier(env, 'email', 'ada@example.org');
    const b = await hashIdentifier(env, 'email', '  ADA@Example.org  ');
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it('reveals nothing about the address', async () => {
    const hash = await hashIdentifier(env, 'email', 'ada@example.org');
    expect(hash).not.toContain('ada');
    expect(hash).not.toContain('example');
  });

  /*
   * The property the whole ledger rests on. A do-not-call recorded by the
   * phone bank has to stop a text to the same number, which can only work if
   * both look up the same stored hash. If this ever fails, someone who said
   * "stop calling me" keeps getting texts.
   */
  it('gives sms and phone the same hash for one number', async () => {
    const [sms, phone] = await Promise.all([
      hashIdentifier(env, 'sms', '+1 555 013 4567'),
      hashIdentifier(env, 'phone', '(555) 013-4567'.replace(/^/, '+1 ')),
    ]);
    expect(sms).toBe(phone);
  });

  it('does not let an email collide with a phone', async () => {
    const [email, phone] = await Promise.all([
      hashIdentifier(env, 'email', '5550134567'),
      hashIdentifier(env, 'sms', '5550134567'),
    ]);
    expect(email).not.toBe(phone);
  });

  // The pepper is a Worker secret precisely so a database disclosure cannot be
  // used to test candidate addresses. That only holds if the hash depends on it.
  it('depends on the pepper', async () => {
    const [a, b] = await Promise.all([
      hashIdentifier(env, 'email', 'ada@example.org'),
      hashIdentifier(other, 'email', 'ada@example.org'),
    ]);
    expect(a).not.toBe(b);
  });

  it('refuses an empty identifier rather than hashing nothing', async () => {
    await expect(hashIdentifier(env, 'email', '   ')).rejects.toThrow();
  });
});

describe('contactHashes', () => {
  it('hashes whichever of the two are present', async () => {
    const both = await contactHashes(env, { email: 'a@b.org', phone: '555 0134' });
    expect(both.emailHash).toMatch(/^[0-9a-f]{64}$/);
    expect(both.phoneHash).toMatch(/^[0-9a-f]{64}$/);

    const emailOnly = await contactHashes(env, { email: 'a@b.org', phone: null });
    expect(emailOnly.phoneHash).toBeNull();
  });

  // The update path COALESCEs on these, so returning null for an absent field
  // is what stops editing a phone number from blanking the email hash and
  // detaching someone from their own opt-out.
  it('returns null for absent fields rather than an empty hash', async () => {
    expect(await contactHashes(env, {})).toEqual({ emailHash: null, phoneHash: null });
  });
});
