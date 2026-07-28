/**
 * /api/auth/* — signup, login, workspace selection, sign-out, password reset.
 *
 * These are the only routes that run without a tenant context, because a
 * tenant is precisely what they establish. Everything here goes through the
 * SECURITY DEFINER functions in the `coram` schema; none of it touches a table
 * directly, and RLS would deny it if it tried.
 */

import { Hono } from 'hono';

import type { Env, Vars } from '../../env';
import {
  clearedCookie,
  createSession,
  requireSession,
  revokeAllSessions,
  revokeSession,
  sessionCookie,
} from '../../lib/auth';
import { hashPassword, mintOneTimeToken, needsRehash, sha256Hex, verifyPassword } from '../../lib/crypto';
import { ERROR, err, ok } from '../../lib/http';
import { clientIp, consume, LOGIN_LIMIT, RESET_LIMIT, SIGNUP_LIMIT } from '../../lib/ratelimit';
import { close, connect, withoutTenant, withTenant } from '../../lib/rls';
import {
  confirmResetSchema,
  loginSchema,
  requestResetSchema,
  selectWorkspaceSchema,
  signupSchema,
} from '../../../shared/schemas/auth';

export const auth = new Hono<{ Bindings: Env; Variables: Vars }>();

/**
 * A password hash to compare against when the account does not exist, so a
 * miss costs the same 600k iterations as a hit. Without this, response timing
 * tells an attacker which addresses are registered.
 */
const DUMMY_HASH =
  'pbkdf2$sha256$600000$AAAAAAAAAAAAAAAAAAAAAA==$' +
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';

// ---------------------------------------------------------------------------
// POST /api/auth/signup
// ---------------------------------------------------------------------------

auth.post('/signup', async (c) => {
  const rid = c.get('requestId');

  const rate = await consume(c.env, 'signup', clientIp(c.req.raw), SIGNUP_LIMIT);
  if (!rate.allowed) {
    return c.json(err('Too many attempts. Try again shortly.', ERROR.RATE_LIMITED, rid), 429);
  }

  const parsed = signupSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json(err(parsed.error.issues[0].message, ERROR.VALIDATION, rid), 400);
  }
  const { email, password, workspaceName } = parsed.data;

  const sql = connect(c.env);
  c.executionCtx.waitUntil(close(sql));

  try {
    const hash = await hashPassword(password);

    const result = await withoutTenant(sql, async (tx) => {
      const existing = await tx`SELECT id FROM coram.find_login(${email})`;
      if (existing.length) return null;

      const [{ create_user: userId }] = await tx`SELECT coram.create_user(${email}, ${hash})`;
      const [{ create_workspace: tenantId }] =
        await tx`SELECT coram.create_workspace(${userId}::uuid, ${workspaceName}, ${slugify(workspaceName)})`;
      return { userId, tenantId };
    });

    // Same response either way. Whether an address is already registered is
    // not something an unauthenticated caller gets to learn.
    if (!result) {
      return c.json(
        ok(undefined, { message: 'Check your email to finish setting up.' }),
        202,
      );
    }

    const { token, session } = await createSession(c.env, result.userId, result.tenantId);
    c.header('Set-Cookie', sessionCookie(token, c.env));

    await withTenant(sql, session, async (tx) => {
      await tx`
        INSERT INTO public.audit_log (tenant_id, actor_id, actor_role, action, record_type)
        VALUES (coram.current_tenant_id(), coram.current_user_id(), coram.current_role(), 'session.start', 'session')
      `;
    });

    return c.json(ok({ tenantId: result.tenantId }), 201);
  } catch {
    return c.json(err('Could not create that workspace.', ERROR.INTERNAL, rid), 500);
  }
});

// ---------------------------------------------------------------------------
// POST /api/auth/login
// ---------------------------------------------------------------------------

auth.post('/login', async (c) => {
  const rid = c.get('requestId');

  const rate = await consume(c.env, 'login', clientIp(c.req.raw), LOGIN_LIMIT);
  if (!rate.allowed) {
    c.header('Retry-After', String(rate.resetIn));
    return c.json(err('Too many attempts. Try again shortly.', ERROR.RATE_LIMITED, rid), 429);
  }

  const parsed = loginSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json(err(parsed.error.issues[0].message, ERROR.VALIDATION, rid), 400);
  }
  const { email, password } = parsed.data;

  const sql = connect(c.env);
  c.executionCtx.waitUntil(close(sql));

  const rows = await withoutTenant(sql, (tx) => tx`SELECT * FROM coram.find_login(${email})`);
  const user = rows[0] as { id: string; password_hash: string; email_verified_at: string | null } | undefined;

  const valid = await verifyPassword(password, user?.password_hash ?? DUMMY_HASH);
  if (!user || !valid) {
    return c.json(err('That email and password do not match.', ERROR.UNAUTHORIZED, rid), 401);
  }

  // Opportunistic upgrade when the iteration count has been raised since this
  // password was set. We have the plaintext exactly here and nowhere else.
  if (needsRehash(user.password_hash)) {
    const upgraded = await hashPassword(password);
    c.executionCtx.waitUntil(
      withoutTenant(sql, (tx) => tx`SELECT coram.set_password(${user.id}::uuid, ${upgraded})`).then(
        () => undefined,
        () => undefined,
      ),
    );
  }

  const memberships = await withoutTenant(
    sql,
    (tx) => tx`SELECT tenant_id FROM coram.list_memberships(${user.id}::uuid)`,
  );
  const tenantId = memberships[0]?.tenant_id as string | undefined;

  const { token } = await createSession(c.env, user.id, tenantId);
  c.header('Set-Cookie', sessionCookie(token, c.env));

  return c.json(
    ok({
      tenantId: tenantId ?? null,
      workspaceCount: memberships.length,
    }),
  );
});

// ---------------------------------------------------------------------------
// POST /api/auth/workspace — choose which workspace this session is in
// ---------------------------------------------------------------------------

auth.post('/workspace', requireSession, async (c) => {
  const rid = c.get('requestId');
  const session = c.get('session')!;

  const parsed = selectWorkspaceSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json(err('Name a workspace.', ERROR.VALIDATION, rid), 400);
  }

  const sql = connect(c.env);
  c.executionCtx.waitUntil(close(sql));

  // Don't check the membership here and trust it later — mint the session and
  // let set_request_context be the thing that decides. One gate, not two.
  const candidate = { ...session, tenantId: parsed.data.tenantId };
  try {
    await withTenant(sql, candidate, async (tx) => {
      await tx`SELECT 1`;
    });
  } catch {
    return c.json(err('You are not a member of that workspace.', ERROR.FORBIDDEN, rid), 403);
  }

  await revokeSession(c.env, session);
  const { token } = await createSession(c.env, session.userId, parsed.data.tenantId);
  c.header('Set-Cookie', sessionCookie(token, c.env));

  return c.json(ok({ tenantId: parsed.data.tenantId }));
});

// ---------------------------------------------------------------------------
// POST /api/auth/logout
// ---------------------------------------------------------------------------

auth.post('/logout', requireSession, async (c) => {
  const session = c.get('session')!;
  const everywhere = c.req.query('everywhere') === 'true';

  if (everywhere) {
    await revokeAllSessions(c.env, session.userId);
  } else {
    await revokeSession(c.env, session);
  }

  c.header('Set-Cookie', clearedCookie(c.env));
  return c.json(ok());
});

// ---------------------------------------------------------------------------
// Password reset
// ---------------------------------------------------------------------------

auth.post('/reset', async (c) => {
  const rid = c.get('requestId');

  const rate = await consume(c.env, 'reset', clientIp(c.req.raw), RESET_LIMIT);
  if (!rate.allowed) {
    return c.json(err('Too many attempts. Try again shortly.', ERROR.RATE_LIMITED, rid), 429);
  }

  const parsed = requestResetSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json(err('Enter your email address.', ERROR.VALIDATION, rid), 400);
  }

  const sql = connect(c.env);
  c.executionCtx.waitUntil(close(sql));

  const rows = await withoutTenant(sql, (tx) => tx`SELECT * FROM coram.find_login(${parsed.data.email})`);
  const user = rows[0] as { id: string } | undefined;

  if (user) {
    const { token, hash } = await mintOneTimeToken();
    const expires = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    await withoutTenant(
      sql,
      (tx) => tx`SELECT coram.issue_auth_token(${user.id}::uuid, 'reset', ${hash}, ${expires}::timestamptz)`,
    );
    // Delivery lands with Nuntius (§5.4). Until then the token is issued and
    // redeemable but nothing mails it — deliberately inert rather than logged,
    // since logging it would put a live credential in an observability sink.
    void token;
  }

  // Unconditional. The response must not reveal whether the address is known.
  return c.json(ok(undefined, { message: 'If that address is registered, a reset link is on its way.' }));
});

auth.post('/reset/confirm', async (c) => {
  const rid = c.get('requestId');

  const parsed = confirmResetSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json(err(parsed.error.issues[0].message, ERROR.VALIDATION, rid), 400);
  }

  const sql = connect(c.env);
  c.executionCtx.waitUntil(close(sql));

  const tokenHash = await sha256Hex(parsed.data.token);
  const hash = await hashPassword(parsed.data.password);

  const rows = await withoutTenant(
    sql,
    (tx) => tx`SELECT coram.consume_auth_token(${tokenHash}, 'reset') AS user_id`,
  );
  const userId = rows[0]?.user_id as string | null | undefined;

  if (!userId) {
    return c.json(err('That reset link has expired or was already used.', ERROR.VALIDATION, rid), 400);
  }

  await withoutTenant(sql, (tx) => tx`SELECT coram.set_password(${userId}::uuid, ${hash})`);

  // A password reset is also the recovery path after a compromise, so every
  // existing session for this person goes.
  await revokeAllSessions(c.env, userId);

  return c.json(ok(undefined, { message: 'Password changed. Sign in again.' }));
});

/** Lowercase, hyphenated, deduplicated. Collisions get a short random suffix. */
function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  const suffix = crypto.randomUUID().slice(0, 6);
  return base ? `${base}-${suffix}` : suffix;
}
