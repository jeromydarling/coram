import { describe, expect, it, vi } from 'vitest';

import {
  hashPassword,
  mintOneTimeToken,
  needsRehash,
  sha256Hex,
  signJwt,
  timingSafeEqual,
  verifyJwt,
  verifyPassword,
  type JwtClaims,
} from './crypto';

const SECRET = 'test-signing-secret-not-used-anywhere-real';

// PBKDF2 at 600k iterations is intentionally slow.
const SLOW = 20_000;

describe('passwords', () => {
  it('round-trips', async () => {
    const hash = await hashPassword('correct horse battery staple');
    expect(await verifyPassword('correct horse battery staple', hash)).toBe(true);
  }, SLOW);

  it('rejects the wrong password', async () => {
    const hash = await hashPassword('correct horse battery staple');
    expect(await verifyPassword('Correct horse battery staple', hash)).toBe(false);
  }, SLOW);

  it('salts, so the same password hashes differently each time', async () => {
    const [a, b] = await Promise.all([hashPassword('same'), hashPassword('same')]);
    expect(a).not.toBe(b);
  }, SLOW);

  it('records its iteration count so it can be raised later', async () => {
    const hash = await hashPassword('whatever');
    expect(hash.startsWith('pbkdf2$sha256$600000$')).toBe(true);
    expect(needsRehash(hash)).toBe(false);
  }, SLOW);

  it('flags a hash made with a weaker iteration count for upgrade', () => {
    expect(needsRehash('pbkdf2$sha256$1000$c2FsdA==$aGFzaA==')).toBe(true);
  });

  it('returns false rather than throwing on a malformed stored hash', async () => {
    for (const bad of ['', 'nonsense', 'bcrypt$2a$10$abc', 'pbkdf2$sha256$notanumber$a$b']) {
      expect(await verifyPassword('x', bad)).toBe(false);
    }
  });
});

describe('session tokens', () => {
  const claims = (over: Partial<JwtClaims> = {}): JwtClaims => ({
    sub: 'a1b2c3',
    tid: 'tenant-1',
    sid: 'session-1',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
    ...over,
  });

  it('round-trips', async () => {
    const verified = await verifyJwt(await signJwt(claims(), SECRET), SECRET);
    expect(verified?.sub).toBe('a1b2c3');
    expect(verified?.tid).toBe('tenant-1');
  });

  it('rejects a token signed with a different secret', async () => {
    const token = await signJwt(claims(), SECRET);
    expect(await verifyJwt(token, 'a-different-secret')).toBeNull();
  });

  it('rejects a tampered payload', async () => {
    const token = await signJwt(claims(), SECRET);
    const [header, , sig] = token.split('.');
    const forged = btoa(JSON.stringify(claims({ tid: 'someone-elses-tenant' })))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    expect(await verifyJwt(`${header}.${forged}.${sig}`, SECRET)).toBeNull();
  });

  it('rejects an expired token', async () => {
    const token = await signJwt(claims({ exp: Math.floor(Date.now() / 1000) - 1 }), SECRET);
    expect(await verifyJwt(token, SECRET)).toBeNull();
  });

  it('rejects malformed input without throwing', async () => {
    for (const bad of ['', 'a', 'a.b', 'a.b.c.d', '...']) {
      expect(await verifyJwt(bad, SECRET)).toBeNull();
    }
  });

  /*
   * The claims deliberately carry no role. Postgres re-derives it from
   * memberships on every transaction, so a token minted before a demotion
   * cannot exercise the old role. If a role ever appears here, that guarantee
   * is gone and this test should be the thing that says so.
   */
  it('carries no role or turf claim', async () => {
    const verified = await verifyJwt(await signJwt(claims(), SECRET), SECRET);
    expect(verified).not.toHaveProperty('role');
    expect(verified).not.toHaveProperty('turf_ids');
  });
});

describe('one-time tokens', () => {
  it('returns a token and its hash, never storing the token itself', async () => {
    const { token, hash } = await mintOneTimeToken();
    expect(token).not.toBe(hash);
    expect(hash).toBe(await sha256Hex(token));
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('does not repeat', async () => {
    const tokens = await Promise.all(Array.from({ length: 25 }, () => mintOneTimeToken()));
    expect(new Set(tokens.map((t) => t.token)).size).toBe(25);
  });
});

describe('timingSafeEqual', () => {
  it('compares by value', () => {
    expect(timingSafeEqual(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 3]))).toBe(true);
    expect(timingSafeEqual(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 4]))).toBe(false);
  });

  it('is false for different lengths', () => {
    expect(timingSafeEqual(new Uint8Array([1]), new Uint8Array([1, 2]))).toBe(false);
  });
});

/*
 * Workers rejects any single PBKDF2 call above 100,000 iterations, so the
 * derivation runs in chained rounds. These pin the properties that matter:
 * every round must actually be performed, and the platform ceiling must never
 * be exceeded by a single call — which is what took down signup in production.
 */
describe('pbkdf2 chaining under the Workers 100k cap', () => {
  it('never asks the runtime for more than 100000 iterations in one call', async () => {
    const seen: number[] = [];
    const real = crypto.subtle.deriveBits.bind(crypto.subtle);
    const spy = vi
      .spyOn(crypto.subtle, 'deriveBits')
      .mockImplementation(((algo: Pbkdf2Params, key: CryptoKey, bits: number) => {
        seen.push(algo.iterations);
        return real(algo, key, bits);
      }) as typeof crypto.subtle.deriveBits);

    await hashPassword('a-password-for-the-chaining-test');
    spy.mockRestore();

    expect(seen.length).toBeGreaterThan(1);
    expect(Math.max(...seen)).toBeLessThanOrEqual(100_000);
    // The rounds must sum to the full cost, or the work factor silently drops.
    expect(seen.reduce((a, b) => a + b, 0)).toBe(600_000);
  });

  it('still round-trips and still rejects the wrong password', async () => {
    const stored = await hashPassword('chained-round-trip');
    expect(await verifyPassword('chained-round-trip', stored)).toBe(true);
    expect(await verifyPassword('chained-round-trip ', stored)).toBe(false);
  });
});
