/**
 * auth — sessions.
 *
 * Coram issues its own sessions. A session is a signed JWT in an httpOnly
 * cookie, plus a KV record that must still exist for the token to be accepted.
 * Carrying both means a token is revocable the moment a steward removes
 * someone, rather than at its natural expiry — which is what makes the Custos
 * panic wipe (§5.9) able to promise "signs the user out of all sessions".
 *
 * The JWT carries user, workspace and session id. It does not carry role or
 * turf. Postgres re-derives those from `memberships` on every transaction, so
 * a token minted before a demotion cannot exercise the old role.
 */

import type { Env, Vars } from '../env';
import { signJwt, verifyJwt, type JwtClaims } from './crypto';

export const SESSION_COOKIE = 'coram_session';

/** Eight hours. Long enough for a canvassing shift, short enough to matter. */
const SESSION_TTL_SECONDS = 8 * 60 * 60;

export interface Session {
  userId: string;
  /** Absent until the user picks a workspace. */
  tenantId?: string;
  sessionId: string;
}

/**
 * KV key. The user id sits in the prefix so every session for one person can
 * be listed and revoked in a single pass — see `revokeAllSessions`.
 */
function sessionKey(userId: string, sessionId: string): string {
  return `session:${userId}:${sessionId}`;
}

export async function createSession(
  env: Env,
  userId: string,
  tenantId?: string,
): Promise<{ token: string; session: Session }> {
  const sessionId = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);

  const claims: JwtClaims = {
    sub: userId,
    tid: tenantId,
    sid: sessionId,
    iat: now,
    exp: now + SESSION_TTL_SECONDS,
  };

  // KV first. A token whose KV record failed to write would be rejected on the
  // next request anyway, but writing first means we never hand out a cookie
  // that was dead on arrival.
  await env.KV_SESSIONS.put(
    sessionKey(userId, sessionId),
    JSON.stringify({ tenantId: tenantId ?? null }),
    { expirationTtl: SESSION_TTL_SECONDS },
  );

  const token = await signJwt(claims, env.AUTH_JWT_SECRET);
  return { token, session: { userId, tenantId, sessionId } };
}

/**
 * Validate a token. Returns null for anything wrong — bad signature, expired,
 * or revoked — without distinguishing between them to the caller.
 */
export async function readSession(env: Env, token: string): Promise<Session | null> {
  const claims = await verifyJwt(token, env.AUTH_JWT_SECRET);
  if (!claims?.sid) return null;

  const record = await env.KV_SESSIONS.get(sessionKey(claims.sub, claims.sid));
  if (record === null) return null;

  return { userId: claims.sub, tenantId: claims.tid, sessionId: claims.sid };
}

export async function revokeSession(env: Env, session: Session): Promise<void> {
  await env.KV_SESSIONS.delete(sessionKey(session.userId, session.sessionId));
}

/**
 * Every session for one person, gone. Backs both "sign out everywhere" and the
 * Custos panic wipe.
 */
export async function revokeAllSessions(env: Env, userId: string): Promise<number> {
  let cursor: string | undefined;
  let revoked = 0;

  do {
    const page = await env.KV_SESSIONS.list({ prefix: `session:${userId}:`, cursor });
    await Promise.all(page.keys.map((k) => env.KV_SESSIONS.delete(k.name)));
    revoked += page.keys.length;
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);

  return revoked;
}

// ---------------------------------------------------------------------------
// Cookies
// ---------------------------------------------------------------------------

export function sessionCookie(token: string, env: Env): string {
  const parts = [
    `${SESSION_COOKIE}=${token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${SESSION_TTL_SECONDS}`,
  ];
  // Secure would make the cookie invisible over plain http on localhost.
  if (env.ENVIRONMENT === 'production') parts.push('Secure');
  return parts.join('; ');
}

export function clearedCookie(env: Env): string {
  const parts = [`${SESSION_COOKIE}=`, 'Path=/', 'HttpOnly', 'SameSite=Lax', 'Max-Age=0'];
  if (env.ENVIRONMENT === 'production') parts.push('Secure');
  return parts.join('; ');
}

export function readCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const pair of header.split(';')) {
    const eq = pair.indexOf('=');
    if (eq === -1) continue;
    if (pair.slice(0, eq).trim() === name) return pair.slice(eq + 1).trim();
  }
  return null;
}

// ---------------------------------------------------------------------------
// Hono middleware
// ---------------------------------------------------------------------------

type Ctx = {
  req: { header(name: string): string | undefined };
  env: Env;
  set: <K extends keyof Vars>(key: K, value: Vars[K]) => void;
  get: <K extends keyof Vars>(key: K) => Vars[K];
  json: (body: unknown, status?: number) => Response;
};

/**
 * Attaches the session when there is a valid one. Does not reject — route
 * groups declare their own requirement with `requireSession` / `requireWorkspace`
 * so that a public route and a private one cannot be told apart by accident.
 */
export async function attachSession(c: Ctx, next: () => Promise<void>): Promise<void> {
  const token = readCookie(c.req.header('Cookie') ?? null, SESSION_COOKIE);
  if (token) {
    const session = await readSession(c.env, token);
    if (session) c.set('session', session);
  }
  await next();
}

/** 401 unless signed in. Does not require a workspace to be chosen. */
export async function requireSession(c: Ctx, next: () => Promise<void>): Promise<Response | void> {
  if (!c.get('session')) {
    return c.json({ ok: false, error: 'Sign in required.', code: 'unauthorized' }, 401);
  }
  await next();
}

/** 401/409 unless signed in *and* inside a workspace. Every /api data route wants this. */
export async function requireWorkspace(c: Ctx, next: () => Promise<void>): Promise<Response | void> {
  const session = c.get('session');
  if (!session) {
    return c.json({ ok: false, error: 'Sign in required.', code: 'unauthorized' }, 401);
  }
  if (!session.tenantId) {
    return c.json({ ok: false, error: 'No workspace selected.', code: 'no_workspace' }, 409);
  }
  await next();
}
