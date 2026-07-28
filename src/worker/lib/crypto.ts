/**
 * crypto — password verifiers, session token signing, one-time tokens.
 *
 * Everything here is WebCrypto. Workers has no bcrypt/argon2 and we are not
 * shipping a WASM hash for it, so passwords use PBKDF2-HMAC-SHA256 at the
 * OWASP-recommended iteration count. That is a real tradeoff worth naming:
 * PBKDF2 is weaker than argon2id against GPU attack. It is chosen because the
 * alternative on this runtime is a hand-rolled or unaudited implementation,
 * which is worse. Revisit if Workers gains a native option.
 *
 * Note what this file does not contain: the client-side encryption for
 * organizer notes (§3.3). That key never reaches the Worker, so its code lives
 * in the SPA and arrives with Membra.
 */

const enc = new TextEncoder();

/** OWASP 2023 guidance for PBKDF2-HMAC-SHA256. */
const PBKDF2_ITERATIONS = 600_000;
const SALT_BYTES = 16;
const KEY_BITS = 256;

// ---------------------------------------------------------------------------
// Passwords
// ---------------------------------------------------------------------------

/**
 * Hash a password into a self-describing string:
 *   pbkdf2$sha256$<iterations>$<salt-b64>$<derived-b64>
 *
 * The iteration count travels with the hash so it can be raised later without
 * invalidating existing passwords — verify reads whatever the stored record
 * says, and `needsRehash` tells the login path when to upgrade one.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const derived = await pbkdf2(password, salt, PBKDF2_ITERATIONS);
  return `pbkdf2$sha256$${PBKDF2_ITERATIONS}$${b64(salt)}$${b64(derived)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 5 || parts[0] !== 'pbkdf2' || parts[1] !== 'sha256') return false;

  const iterations = Number(parts[2]);
  if (!Number.isInteger(iterations) || iterations < 1) return false;

  const salt = unb64(parts[3]);
  const expected = unb64(parts[4]);
  if (!salt.length || !expected.length) return false;

  const actual = await pbkdf2(password, salt, iterations, expected.length * 8);
  return timingSafeEqual(actual, expected);
}

/** True when a stored hash was made with fewer iterations than we now use. */
export function needsRehash(stored: string): boolean {
  const iterations = Number(stored.split('$')[2]);
  return !Number.isInteger(iterations) || iterations < PBKDF2_ITERATIONS;
}

async function pbkdf2(
  password: string,
  salt: Uint8Array,
  iterations: number,
  bits = KEY_BITS,
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, [
    'deriveBits',
  ]);
  const derived = await crypto.subtle.deriveBits(
    // The cast is TypeScript bookkeeping, not a runtime concern: since TS 5.7
    // Uint8Array is generic over its buffer, and WebCrypto's BufferSource
    // insists on a plain ArrayBuffer. These are never SharedArrayBuffer-backed.
    { name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations },
    key,
    bits,
  );
  return new Uint8Array(derived);
}

// ---------------------------------------------------------------------------
// Session tokens (compact JWT, HS256)
// ---------------------------------------------------------------------------

export interface JwtClaims {
  /** user id */
  sub: string;
  /** tenant id — absent on a session that has not chosen a workspace yet */
  tid?: string;
  /** issued at, seconds */
  iat: number;
  /** expiry, seconds */
  exp: number;
  /** session id, so a token can be revoked via KV without waiting for exp */
  sid: string;
}

/**
 * Sign claims. Note the claims deliberately do not carry role or turf: the
 * database re-derives both from `memberships` in set_request_context(). A token
 * that outlives a demotion therefore cannot exercise the old role.
 */
export async function signJwt(claims: JwtClaims, secret: string): Promise<string> {
  const header = b64url(enc.encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const payload = b64url(enc.encode(JSON.stringify(claims)));
  const body = `${header}.${payload}`;
  const sig = await hmac(body, secret);
  return `${body}.${b64url(sig)}`;
}

/** Verify signature and expiry. Returns null on any failure — never throws. */
export async function verifyJwt(token: string, secret: string): Promise<JwtClaims | null> {
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [header, payload, sig] = parts;
  const expected = await hmac(`${header}.${payload}`, secret);
  if (!timingSafeEqual(unb64url(sig), expected)) return null;

  let claims: JwtClaims;
  try {
    claims = JSON.parse(new TextDecoder().decode(unb64url(payload)));
  } catch {
    return null;
  }

  if (typeof claims.sub !== 'string' || typeof claims.exp !== 'number') return null;
  if (claims.exp * 1000 <= Date.now()) return null;

  return claims;
}

async function hmac(data: string, secret: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(data)));
}

// ---------------------------------------------------------------------------
// One-time tokens
// ---------------------------------------------------------------------------

/**
 * A verification or reset token. The caller emails `token` and stores `hash`;
 * the two are never both at rest, so a database disclosure yields no live
 * links.
 */
export async function mintOneTimeToken(): Promise<{ token: string; hash: string }> {
  const token = b64url(crypto.getRandomValues(new Uint8Array(32)));
  return { token, hash: await sha256Hex(token) };
}

export async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(input));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

/**
 * Constant-time comparison. Compares every byte regardless of mismatch so the
 * duration does not leak how much of the input was correct.
 */
export function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

function b64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

function unb64(s: string): Uint8Array {
  try {
    return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  } catch {
    return new Uint8Array(0);
  }
}

function b64url(bytes: Uint8Array): string {
  return b64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function unb64url(s: string): Uint8Array {
  const padded = s.replace(/-/g, '+').replace(/_/g, '/');
  return unb64(padded + '='.repeat((4 - (padded.length % 4)) % 4));
}
