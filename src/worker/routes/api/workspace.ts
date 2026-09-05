/**
 * /api/workspace/* — the workspace itself, its members, and the burn switch.
 */

import { Hono } from 'hono';
import { z } from 'zod';

import type { Env, Vars } from '../../env';
import { requireWorkspace, revokeAllSessions } from '../../lib/auth';
import { record, recordBefore } from '../../lib/audit';
import { mintOneTimeToken } from '../../lib/crypto';
import { ERROR, detailFor, err, ok, logFailure } from '../../lib/http';
import {isDenied, withTenant, withoutTenant} from '../../lib/rls';
import { db } from '../../lib/db';

import { ROLES } from '../../lib/schema';
import { email as emailSchema } from '../../../shared/schemas/auth';

export const workspace = new Hono<{ Bindings: Env; Variables: Vars }>();

workspace.use('*', requireWorkspace);

// ---------------------------------------------------------------------------
// GET /api/workspace
// ---------------------------------------------------------------------------

workspace.get('/', async (c) => {
  const session = c.get('session')!;
  const sql = db(c);

  const data = await withTenant(sql, session, async (tx) => {
    const [tenant] = await tx`
      SELECT id, name, slug, tier, contact_count, created_at FROM public.tenants
    `;
    const [me] = await tx`
      SELECT role, to_jsonb(turf_ids) AS turf_ids, display_name FROM public.memberships
      WHERE user_id = coram.current_user_id()
    `;
    return { tenant, me };
  });

  return c.json(ok(data));
});

// ---------------------------------------------------------------------------
// GET /api/workspace/members
//
// No audit entry. §3.6 logs access to records about *people we organize*;
// a roster of colleagues inside one's own workspace is not that, and logging
// every sidebar render would bury the entries that matter.
// ---------------------------------------------------------------------------

workspace.get('/members', async (c) => {
  const session = c.get('session')!;
  const sql = db(c);

  const members = await withTenant(
    sql,
    session,
    (tx) => tx`
      SELECT m.id, m.user_id, m.role, m.display_name, to_jsonb(m.turf_ids) AS turf_ids, m.created_at
      FROM public.memberships m
      ORDER BY m.created_at
    `,
  );

  return c.json(ok(members));
});

// ---------------------------------------------------------------------------
// GET /api/workspace/turfs
//
// Added because of a bug the browser suite caught: an organizer could not add
// a contact at all. contacts_insert admits an organizer only when the new row
// lands in a turf they hold — "so they cannot create a row they would then be
// unable to see", which is the right rule — and the form had no turf field
// because nothing in the product listed turfs. The insert was refused every
// time and the only sign was a toast.
//
// Names, ids and a count. Not `boundary`: the drawn polygon is a map of where
// a group organizes, it is large, and no picker needs it.
// ---------------------------------------------------------------------------

workspace.get('/turfs', async (c) => {
  const session = c.get('session')!;
  const sql = db(c);

  const turfs = await withTenant(
    sql,
    session,
    (tx) => tx`
      SELECT t.id, t.name,
             -- Counted through the caller's own RLS, so an organizer sees the
             -- size of their patch and not of everyone else's.
             (SELECT count(*) FROM public.contacts c WHERE c.turf_id = t.id)::int AS contacts,
             -- Whether this caller may file someone into it. A steward may use
             -- any; an organizer only the ones they hold.
             (coram.has_role('steward') OR t.id = ANY(coram.current_turf_ids())) AS mine
      FROM public.turfs t
      ORDER BY t.name
    `,
  );

  return c.json(ok(turfs));
});

// ---------------------------------------------------------------------------
// PATCH /api/workspace/members/:id — change a role
//
// Authorization is not checked here. The memberships_write policy admits only
// a steward, so a non-steward's UPDATE matches zero rows and returns a 404.
// That is the §4.1 arrangement working as intended: the TypeScript below is
// for the error message, not for the decision.
// ---------------------------------------------------------------------------

const roleChange = z.object({ role: z.enum(ROLES) });

workspace.patch('/members/:id', async (c) => {
  const rid = c.get('requestId');
  const session = c.get('session')!;

  const parsed = roleChange.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json(err('Choose one of the five roles.', ERROR.VALIDATION, rid), 400);
  }

  const memberId = c.req.param('id');
  const sql = db(c);

  try {
    const changed = await withTenant(sql, session, async (tx) => {
      // A steward demoting themselves while they are the only steward would
      // leave the workspace with no one who can manage billing or burn it.
      const [{ count }] = await tx`
        SELECT count(*)::int AS count FROM public.memberships
        WHERE role = 'steward' AND id <> ${memberId}::uuid
      `;
      if (parsed.data.role !== 'steward' && count === 0) return 'last_steward' as const;

      const rows = await tx`
        UPDATE public.memberships
        SET role = ${parsed.data.role},
            turf_ids = CASE WHEN ${parsed.data.role} = 'organizer' THEN turf_ids ELSE '{}'::uuid[] END
        WHERE id = ${memberId}::uuid
        RETURNING id
      `;
      if (!rows.length) return 'not_found' as const;

      await record(tx, { action: 'member.role_change', recordType: 'membership' });
      return 'ok' as const;
    });

    if (changed === 'last_steward') {
      return c.json(
        err('Promote another steward before stepping down from the last one.', ERROR.CONFLICT, rid),
        409,
      );
    }
    if (changed === 'not_found') {
      return c.json(err('No such member, or not yours to change.', ERROR.NOT_FOUND, rid), 404);
    }
    return c.json(ok());
  } catch (error) {
    logFailure('workspace', rid, error);
    return c.json(err('Could not change that role.', ERROR.INTERNAL, rid), 500);
  }
});

// ---------------------------------------------------------------------------
// Invites
//
// The other half of §4.1's five roles being able to change hands at all: until
// this, coram.create_workspace() made its creator the sole steward and nothing
// in the product ever added a second row to `memberships`. Every workspace was
// a single point of failure for an organization that, by nature, has high
// turnover, and there was no route that changed it.
//
// The link is handed back to the steward who asked for it rather than mailed,
// because nothing in this codebase sends outbound email yet (see the reset
// flow below, and 0020_workspace_invites.sql's header) — and because, unlike
// reset, there is no security reason not to: the steward already knows exactly
// who they mean to send it to, and for a small organizing group is at least as
// likely to send it over Signal as email.
// ---------------------------------------------------------------------------

const INVITE_TTL_DAYS = 7;

workspace.get('/invites', async (c) => {
  const session = c.get('session')!;
  const sql = db(c);

  const invites = await withTenant(
    sql,
    session,
    (tx) => tx`
      SELECT id, email, role, created_at, expires_at
      FROM public.workspace_invites
      ORDER BY created_at DESC
    `,
  );

  return c.json(ok(invites));
});

const inviteCreate = z.object({ email: emailSchema, role: z.enum(ROLES) });

workspace.post('/invites', async (c) => {
  const rid = c.get('requestId');
  const session = c.get('session')!;

  const parsed = inviteCreate.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json(err(parsed.error.issues[0].message, ERROR.VALIDATION, rid), 400);
  }
  const { email, role } = parsed.data;

  const sql = db(c);

  try {
    const result = await withTenant(sql, session, async (tx) => {
      const [already] = await tx`
        SELECT 1 FROM public.memberships m
        JOIN public.users u ON u.id = m.user_id
        WHERE lower(u.email) = lower(${email})
      `;
      if (already) return 'already_member' as const;

      // Re-inviting refreshes rather than errors on the unique (tenant_id,
      // lower(email)) index — a steward correcting a typo'd role should not
      // have to notice and revoke the old row first.
      await tx`DELETE FROM public.workspace_invites WHERE lower(email) = lower(${email})`;

      const { token, hash } = await mintOneTimeToken();
      const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();

      const [invite] = await tx`
        INSERT INTO public.workspace_invites (tenant_id, email, role, invited_by, token_hash, expires_at)
        VALUES (coram.current_tenant_id(), ${email}, ${role}, coram.current_user_id(), ${hash}, ${expiresAt}::timestamptz)
        RETURNING id, expires_at
      `;

      await record(tx, { action: 'member.invite', recordType: 'workspace_invite' });

      return { id: invite.id as string, expiresAt: invite.expires_at as string, token };
    });

    if (result === 'already_member') {
      return c.json(err('That person is already a member.', ERROR.CONFLICT, rid), 409);
    }

    // The path only. The Worker does not know its own public hostname any
    // more reliably than the browser that just called it does.
    return c.json(
      ok({
        id: result.id,
        email,
        role,
        expiresAt: result.expiresAt,
        path: `/app/invite/${result.token}`,
      }),
      201,
    );
  } catch (error) {
    /*
     * A denied INSERT raises rather than matching zero rows — see isDenied.
     * Without this, a member pressing "invite" the one time the button was
     * visible to them by mistake was told the invite had failed rather than
     * that it was not theirs to send.
     */
    if (isDenied(error)) {
      return c.json(err('Only a steward can invite someone.', ERROR.FORBIDDEN, rid), 403);
    }
    logFailure('workspace', rid, error);
    return c.json(err('Could not create that invite.', ERROR.INTERNAL, rid, detailFor(c.env, error)), 500);
  }
});

workspace.delete('/invites/:id', async (c) => {
  const rid = c.get('requestId');
  const session = c.get('session')!;
  const sql = db(c);

  const rows = await withTenant(
    sql,
    session,
    (tx) => tx`DELETE FROM public.workspace_invites WHERE id = ${c.req.param('id')}::uuid RETURNING id`,
  );

  if (!rows.length) {
    return c.json(err('No such invite, or not yours to revoke.', ERROR.NOT_FOUND, rid), 404);
  }
  return c.json(ok());
});

// ---------------------------------------------------------------------------
// POST /api/workspace/burn — §3.5
//
// Irreversible. No soft-delete, no undo window, no backup to restore from
// beyond the 24 hours our provider holds. A steward types the workspace name
// to confirm, and then it is gone.
//
// Order matters here, and it is chosen so that every failure mode leaves the
// workspace *more* destroyed rather than half-alive:
//
//   1. audit the attempt, in its own committed transaction
//   2. collect member ids while the rows still exist
//   3. delete the Postgres rows — one cascading DELETE, fast
//   4. revoke every session, so no one is left holding a live token
//   5. hand R2 to the queue, because listing objects is unbounded
//
// Steps 4 and 5 run after the response is sent. The rows are already gone by
// then; a token that survives a few more seconds can no longer read anything.
// ---------------------------------------------------------------------------

const burnConfirm = z.object({ confirm: z.string().min(1) });

workspace.post('/burn', async (c) => {
  const rid = c.get('requestId');
  const session = c.get('session')!;
  const tenantId = session.tenantId!;

  const parsed = burnConfirm.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json(err('Type the workspace name to confirm.', ERROR.VALIDATION, rid), 400);
  }

  const sql = db(c);

  const context = await withTenant(sql, session, async (tx) => {
    const [tenant] = await tx`SELECT name FROM public.tenants`;
    const [me] = await tx`
      SELECT role FROM public.memberships WHERE user_id = coram.current_user_id()
    `;
    const members = await tx`SELECT user_id FROM public.memberships`;
    return {
      name: tenant?.name as string | undefined,
      role: me?.role as string | undefined,
      memberIds: members.map((m) => m.user_id as string),
    };
  });

  if (context.role !== 'steward') {
    return c.json(err('Only a steward can destroy a workspace.', ERROR.FORBIDDEN, rid), 403);
  }
  if (parsed.data.confirm !== context.name) {
    return c.json(err('That name does not match. Nothing was deleted.', ERROR.VALIDATION, rid), 400);
  }

  await recordBefore(sql, session, { action: 'workspace.burn', recordType: 'workspace' });

  try {
    await withoutTenant(
      sql,
      (tx) => tx`SELECT coram.burn_workspace(${session.userId}::uuid, ${tenantId}::uuid)`,
    );
  } catch (error) {
    logFailure('workspace', rid, error);
    return c.json(err('Could not destroy the workspace. Nothing was deleted.', ERROR.INTERNAL, rid), 500);
  }

  c.executionCtx.waitUntil(
    Promise.all([
      ...context.memberIds.map((id) => revokeAllSessions(c.env, id)),
      c.env.Q_PURGE.send({ kind: 'burn.r2', tenantId, bucket: 'files' }),
      c.env.Q_PURGE.send({ kind: 'burn.r2', tenantId, bucket: 'exports' }),
      // Durable Object state is destroyed by the modules that own it. None
      // exist yet; Colloquium (§5.7) and Consilium (§5.8) register here when
      // they land, and neither may ship without doing so.
    ]).then(
      () => undefined,
      () => undefined,
    ),
  );

  return c.json(ok(undefined, { message: 'The workspace and everything in it is gone.' }));
});
