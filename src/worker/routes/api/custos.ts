/**
 * /api/custos/* — safety infrastructure (§5.9).
 *
 * Every route here except the two document endpoints is `legal` only, and that
 * includes being closed to the steward. The policies in 0009 do the enforcing;
 * this file turns the resulting empty result into an explanation.
 *
 * The panic wipe lives here too. It is the one endpoint in the product designed
 * to be used while something bad is happening, so it takes no confirmation
 * dialog, no password re-entry, and no options.
 */

import { Hono } from 'hono';
import { z } from 'zod';

import type { Env, Vars } from '../../env';
import { record } from '../../lib/audit';
import { clearedCookie, requireWorkspace, revokeAllSessions } from '../../lib/auth';
import { ERROR, err, ok } from '../../lib/http';
import { close, connect, withTenant } from '../../lib/rls';

export const custos = new Hono<{ Bindings: Env; Variables: Vars }>();

custos.use('*', requireWorkspace);

const jailCaseSchema = z.object({
  personName: z.string().trim().min(1, 'Who is being held?').max(200),
  facility: z.string().trim().max(200).optional(),
  bookingRef: z.string().trim().max(100).optional(),
  needsBailCents: z.number().int().min(0).optional(),
  nextHearingOn: z.string().date().optional(),
  notes: z.string().trim().max(5_000).optional(),
});

const observerReportSchema = z.object({
  narrative: z.string().trim().min(1, 'Describe what you saw.').max(20_000),
  /** A place name a person would say. Never coordinates (§3.7). */
  locationName: z.string().trim().max(200).optional(),
  occurredOn: z.string().date(),
  anonymous: z.boolean().default(false),
});

/** Same message whichever way it failed. See the note below. */
const NOT_LEGAL =
  'The Custos module is open to the legal role only. A steward can appoint someone to it, ' +
  'but cannot read it themselves.';

// ---------------------------------------------------------------------------
// Jail support
// ---------------------------------------------------------------------------

custos.get('/jail-support', async (c) => {
  const session = c.get('session')!;

  const sql = connect(c.env);
  c.executionCtx.waitUntil(close(sql));

  const rows = await withTenant(sql, session, async (tx) => {
    const found = await tx`
      SELECT id, person_name, facility, booking_ref, status,
             needs_bail_cents, next_hearing_on, notes,
             arrested_on, released_at, closed_at
      FROM public.jail_support_cases
      WHERE closed_at IS NULL
      ORDER BY arrested_on
    `;

    // Audited even though the reader is the legal role. Especially because:
    // this is the most sensitive table in the product, and a record that it
    // was read is the least a member is owed.
    if (found.length) {
      await record(tx, {
        action: 'record.read',
        recordType: 'jail_support_case',
        recordCount: found.length,
      });
    }
    return found;
  });

  return c.json(ok(rows));
});

custos.post('/jail-support', async (c) => {
  const rid = c.get('requestId');
  const session = c.get('session')!;

  const parsed = jailCaseSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json(err(parsed.error.issues[0].message, ERROR.VALIDATION, rid), 400);
  }
  const input = parsed.data;

  const sql = connect(c.env);
  c.executionCtx.waitUntil(close(sql));

  const created = await withTenant(sql, session, async (tx) => {
    const [row] = await tx`
      INSERT INTO public.jail_support_cases
        (tenant_id, person_name, facility, booking_ref, needs_bail_cents,
         next_hearing_on, notes, created_by)
      VALUES (
        coram.current_tenant_id(), ${input.personName}, ${input.facility ?? null},
        ${input.bookingRef ?? null}, ${input.needsBailCents ?? null},
        ${input.nextHearingOn ?? null}::date, ${input.notes ?? null},
        (SELECT m.id FROM public.memberships m
         WHERE m.user_id = coram.current_user_id() AND m.tenant_id = coram.current_tenant_id())
      )
      RETURNING id, person_name, status, arrested_on
    `;
    return row;
  });

  if (!created) return c.json(err(NOT_LEGAL, ERROR.FORBIDDEN, rid), 403);
  return c.json(ok(created), 201);
});

custos.post('/jail-support/:id/close', async (c) => {
  const rid = c.get('requestId');
  const session = c.get('session')!;

  const parsed = z
    .object({ status: z.enum(['released', 'transferred', 'unknown']) })
    .safeParse(await c.req.json().catch(() => null));

  if (!parsed.success) {
    return c.json(err('Close as released, transferred, or unknown.', ERROR.VALIDATION, rid), 400);
  }

  const sql = connect(c.env);
  c.executionCtx.waitUntil(close(sql));

  try {
    const [row] = await withTenant(
      sql,
      session,
      (tx) => tx`
        SELECT coram.close_jail_support_case(
          ${c.req.param('id')}::uuid, ${parsed.data.status}
        ) AS closed_at
      `,
    );

    return c.json(
      ok(
        { closedAt: row.closed_at },
        {
          // Stated at the moment of closing, because it is irreversible and
          // somebody may want to write something down first.
          message:
            'Closed. This case and everything on it is deleted permanently thirty days ' +
            'from now. There is no archive and no export.',
        },
      ),
    );
  } catch (error) {
    const code = (error as { code?: string })?.code;
    if (code === '42501') return c.json(err(NOT_LEGAL, ERROR.FORBIDDEN, rid), 403);
    if (code === 'P0002') return c.json(err('No such open case.', ERROR.NOT_FOUND, rid), 404);
    return c.json(err('Could not close that case.', ERROR.INTERNAL, rid), 500);
  }
});

// ---------------------------------------------------------------------------
// Legal observer intake
// ---------------------------------------------------------------------------

custos.post('/observer-reports', async (c) => {
  const rid = c.get('requestId');
  const session = c.get('session')!;

  const parsed = observerReportSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json(err(parsed.error.issues[0].message, ERROR.VALIDATION, rid), 400);
  }
  const input = parsed.data;

  const sql = connect(c.env);
  c.executionCtx.waitUntil(close(sql));

  const created = await withTenant(sql, session, async (tx) => {
    const [row] = await tx`
      INSERT INTO public.observer_reports (tenant_id, narrative, location_name, occurred_on, observer_id)
      VALUES (
        coram.current_tenant_id(), ${input.narrative}, ${input.locationName ?? null},
        ${input.occurredOn}::date,
        ${
          // Anonymous means the column is null, not that it is hidden behind a
          // flag. A "hide my name" boolean is a name we are still holding.
          input.anonymous
            ? null
            : tx`(SELECT m.id FROM public.memberships m
                  WHERE m.user_id = coram.current_user_id()
                    AND m.tenant_id = coram.current_tenant_id())`
        }
      )
      RETURNING id, occurred_on
    `;
    return row;
  });

  if (!created) return c.json(err(NOT_LEGAL, ERROR.FORBIDDEN, rid), 403);
  return c.json(ok(created), 201);
});

// ---------------------------------------------------------------------------
// Emergency contact trees
// ---------------------------------------------------------------------------

custos.get('/trees/:id', async (c) => {
  const rid = c.get('requestId');
  const session = c.get('session')!;

  const sql = connect(c.env);
  c.executionCtx.waitUntil(close(sql));

  const nodes = await withTenant(
    sql,
    session,
    (tx) => tx`
      SELECT id, parent_id, display_name, phone, email, role_note, position
      FROM public.contact_tree_nodes
      WHERE tree_id = ${c.req.param('id')}::uuid
      ORDER BY parent_id NULLS FIRST, position
    `,
  );

  if (!nodes.length) return c.json(err(NOT_LEGAL, ERROR.FORBIDDEN, rid), 403);

  return c.json(ok({ nodes, cascade: cascadeOrder(nodes as unknown as TreeNode[]) }));
});

// ---------------------------------------------------------------------------
// Documents — readable by the whole workspace
// ---------------------------------------------------------------------------

custos.get('/rights-guides', async (c) => {
  const session = c.get('session')!;
  const state = c.req.query('state');

  const sql = connect(c.env);
  c.executionCtx.waitUntil(close(sql));

  const rows = await withTenant(
    sql,
    session,
    (tx) => tx`
      SELECT id, state_code, title, body, updated_at FROM public.rights_guides
      WHERE ${state ? tx`state_code = ${state.toUpperCase()}` : tx`true`}
      ORDER BY state_code, title
    `,
  );

  return c.json(ok(rows));
});

custos.get('/briefings', async (c) => {
  const session = c.get('session')!;

  const sql = connect(c.env);
  c.executionCtx.waitUntil(close(sql));

  const rows = await withTenant(
    sql,
    session,
    (tx) => tx`
      SELECT id, event_id, title, body, created_at FROM public.risk_briefings
      WHERE closed_at IS NULL ORDER BY created_at DESC
    `,
  );

  return c.json(ok(rows));
});

// ---------------------------------------------------------------------------
// POST /api/custos/panic — §5.9
// ---------------------------------------------------------------------------

/**
 * Panic wipe.
 *
 * §5.9: "clears device-local cache and signs the user out of all sessions."
 *
 * No confirmation, no password re-entry, no options. This is the one endpoint
 * built to be used while something bad is happening, and a confirm dialog is a
 * second thing to do correctly under duress. Someone who triggers it by
 * accident signs in again; someone who needs it and is asked "are you sure?"
 * may not get a second chance.
 *
 * It is deliberately available to every role. A member at a protest needs it as
 * much as a legal observer does.
 *
 * What it cannot do: reach a device that is already off, or one that has been
 * taken. Sessions die here, but a phone already unlocked in someone's hand is
 * beyond anything a server can do — the client clears its own cache on the
 * response, and that is the half that has to happen locally.
 */
custos.post('/panic', async (c) => {
  const session = c.get('session')!;

  const revoked = await revokeAllSessions(c.env, session.userId);

  // Best effort, and after the revocation rather than before. If the audit
  // write fails, the sessions are still gone — which is the right order for an
  // endpoint someone is using because they are in trouble.
  const sql = connect(c.env);
  c.executionCtx.waitUntil(
    withTenant(sql, session, (tx) => record(tx, { action: 'session.end', recordType: 'session' }))
      .then(() => undefined, () => undefined)
      .finally(() => close(sql)),
  );

  c.header('Set-Cookie', clearedCookie(c.env));
  // Tells the client to drop caches and storage for this origin as well.
  c.header('Clear-Site-Data', '"cache", "cookies", "storage"');

  return c.json(
    ok(
      { sessionsRevoked: revoked },
      {
        message:
          `Signed out of ${revoked} session(s) everywhere and cleared this device. ` +
          'Nothing was deleted from the workspace.',
      },
    ),
  );
});

// ---------------------------------------------------------------------------

/**
 * Flatten a contact tree into call order: breadth-first from the roots.
 *
 * Breadth-first rather than depth-first on purpose. A cascade exists so that
 * one unanswered phone does not stall the whole chain — depth-first would walk
 * to the bottom of one branch before touching the second name on the list,
 * which is the opposite of what a call-down tree is for.
 */
interface TreeNode {
  id: string;
  parent_id: string | null;
  display_name: string;
  position: number;
}

function cascadeOrder(nodes: TreeNode[]): Array<{ id: string; displayName: string; depth: number }> {
  const children = new Map<string | null, TreeNode[]>();
  for (const node of nodes) {
    const key = node.parent_id ?? null;
    if (!children.has(key)) children.set(key, []);
    children.get(key)!.push(node);
  }
  for (const list of children.values()) {
    list.sort((a, b) => Number(a.position) - Number(b.position));
  }

  const order: Array<{ id: string; displayName: string; depth: number }> = [];
  let frontier = children.get(null) ?? [];
  let depth = 0;

  // Bounded by the node count, so a cycle in parent_id cannot hang this.
  while (frontier.length && order.length < nodes.length) {
    const next: TreeNode[] = [];
    for (const node of frontier) {
      order.push({ id: node.id, displayName: node.display_name, depth });
      next.push(...(children.get(node.id) ?? []));
    }
    frontier = next;
    depth++;
  }

  return order;
}
