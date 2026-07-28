/**
 * /api/workspace/* — the workspace itself, its members, and the burn switch.
 */

import { Hono } from 'hono';
import { z } from 'zod';

import type { Env, Vars } from '../../env';
import { requireWorkspace, revokeAllSessions } from '../../lib/auth';
import { record, recordBefore } from '../../lib/audit';
import { ERROR, err, ok } from '../../lib/http';
import { close, connect, withTenant, withoutTenant } from '../../lib/rls';
import { ROLES } from '../../lib/schema';

export const workspace = new Hono<{ Bindings: Env; Variables: Vars }>();

workspace.use('*', requireWorkspace);

// ---------------------------------------------------------------------------
// GET /api/workspace
// ---------------------------------------------------------------------------

workspace.get('/', async (c) => {
  const session = c.get('session')!;
  const sql = connect(c.env);
  c.executionCtx.waitUntil(close(sql));

  const data = await withTenant(sql, session, async (tx) => {
    const [tenant] = await tx`
      SELECT id, name, slug, tier, contact_count, created_at FROM public.tenants
    `;
    const [me] = await tx`
      SELECT role, turf_ids, display_name FROM public.memberships
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
  const sql = connect(c.env);
  c.executionCtx.waitUntil(close(sql));

  const members = await withTenant(
    sql,
    session,
    (tx) => tx`
      SELECT m.id, m.user_id, m.role, m.display_name, m.turf_ids, m.created_at
      FROM public.memberships m
      ORDER BY m.created_at
    `,
  );

  return c.json(ok(members));
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
  const sql = connect(c.env);
  c.executionCtx.waitUntil(close(sql));

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
  } catch {
    return c.json(err('Could not change that role.', ERROR.INTERNAL, rid), 500);
  }
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

  const sql = connect(c.env);
  c.executionCtx.waitUntil(close(sql));

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
  } catch {
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
