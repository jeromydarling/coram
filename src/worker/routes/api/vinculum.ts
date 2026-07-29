/**
 * /api/vinculum/* — relational organizing (§5.2).
 *
 * The follow-up queue is the surface an organizer actually lives in, so most of
 * this file is about making that queue honest: what is due, what has been
 * snoozed too often, and what has gone past the person who was meant to do it.
 */

import { Hono } from 'hono';
import { z } from 'zod';

import type { Env, Vars } from '../../env';
import { record } from '../../lib/audit';
import { requireWorkspace } from '../../lib/auth';
import { ERROR, err, ok } from '../../lib/http';
import {withTenant} from '../../lib/rls';
import { db } from '../../lib/db';


export const vinculum = new Hono<{ Bindings: Env; Variables: Vars }>();

vinculum.use('*', requireWorkspace);

const logOneToOneSchema = z.object({
  contactId: z.string().uuid(),
  outcomeCodeId: z.string().uuid().optional(),
  /** What was agreed. About the work, not about the person. */
  nextStep: z.string().trim().max(500).optional(),
  movedToRungId: z.string().uuid().optional(),
  closesFollowUpId: z.string().uuid().optional(),
  nextFollowUpAt: z.string().datetime({ offset: true }).optional(),
  nextFollowUpReason: z.string().trim().max(200).optional(),
});

const followUpSchema = z.object({
  contactId: z.string().uuid(),
  reason: z.string().trim().min(1, 'Why is this owed?').max(200),
  dueAt: z.string().datetime({ offset: true }),
  membershipId: z.string().uuid().optional(),
});

const edgeSchema = z.object({
  sourceType: z.enum(['contact', 'event', 'fund', 'turf']),
  sourceId: z.string().uuid(),
  targetType: z.enum(['contact', 'event', 'fund', 'turf']),
  targetId: z.string().uuid(),
  edgeReason: z.string().trim().min(1).max(60),
});

// ---------------------------------------------------------------------------
// GET /api/vinculum/queue — the follow-up queue
// ---------------------------------------------------------------------------

vinculum.get('/queue', async (c) => {
  const session = c.get('session')!;
  const mine = c.req.query('mine') !== 'false';

  const sql = db(c);

  const rows = await withTenant(
    sql,
    session,
    (tx) => tx`
      SELECT f.id, f.reason, f.due_at, f.snoozed_until, f.snooze_count,
             f.escalated_at, f.membership_id,
             c.id AS contact_id, c.display_name, c.email, c.phone,
             -- Effective date: a snoozed item is due when the snooze ends.
             coalesce(f.snoozed_until, f.due_at) AS effective_due_at,
             (coalesce(f.snoozed_until, f.due_at) < now()) AS overdue
      FROM public.follow_ups f
      JOIN public.contacts c ON c.id = f.contact_id
      WHERE f.status = 'open'
        AND ${
          mine
            ? tx`f.membership_id = (SELECT m.id FROM public.memberships m
                                    WHERE m.user_id = coram.current_user_id()
                                      AND m.tenant_id = coram.current_tenant_id())`
            : tx`true`
        }
      ORDER BY coalesce(f.snoozed_until, f.due_at)
      LIMIT 200
    `,
  );

  return c.json(
    ok(rows, {
      // Surfaced because a queue full of thrice-snoozed items is not a queue,
      // it is a list of things nobody is going to do. Better to see that than
      // to keep pushing them a week at a time.
      repeatedlySnoozed: rows.filter((r) => Number(r.snooze_count) >= 3).length,
      overdue: rows.filter((r) => r.overdue).length,
    }),
  );
});

// ---------------------------------------------------------------------------
// POST /api/vinculum/one-to-ones
// ---------------------------------------------------------------------------

vinculum.post('/one-to-ones', async (c) => {
  const rid = c.get('requestId');
  const session = c.get('session')!;

  const parsed = logOneToOneSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json(err(parsed.error.issues[0].message, ERROR.VALIDATION, rid), 400);
  }
  const input = parsed.data;

  const sql = db(c);

  try {
    // One call, one transaction: log the conversation, move the ladder, close
    // the follow-up that prompted it, open the next one. Doing these as
    // separate requests is how a queue ends up showing a conversation as still
    // owed after it happened.
    const [row] = await withTenant(
      sql,
      session,
      (tx) => tx`
        SELECT coram.log_one_to_one(
          ${input.contactId}::uuid,
          ${input.outcomeCodeId ?? null}::uuid,
          ${input.nextStep ?? null},
          ${input.movedToRungId ?? null}::uuid,
          ${input.closesFollowUpId ?? null}::uuid,
          ${input.nextFollowUpAt ?? null}::timestamptz,
          ${input.nextFollowUpReason ?? null}
        ) AS id
      `,
    );

    return c.json(ok({ id: row.id }), 201);
  } catch (error) {
    if ((error as { code?: string })?.code === '42501') {
      return c.json(
        err('No such contact, or not one you can see.', ERROR.FORBIDDEN, rid),
        403,
      );
    }
    return c.json(err('Could not log that conversation.', ERROR.INTERNAL, rid), 500);
  }
});

vinculum.get('/contacts/:id/one-to-ones', async (c) => {
  const session = c.get('session')!;

  const sql = db(c);

  const rows = await withTenant(sql, session, async (tx) => {
    const found = await tx`
      SELECT o.id, o.occurred_at, o.next_step, o.organizer_id,
             oc.code AS outcome_code, oc.label AS outcome_label, oc.is_positive,
             r.name AS moved_to_rung
      FROM public.one_to_ones o
      LEFT JOIN public.outcome_codes oc ON oc.id = o.outcome_code_id
      LEFT JOIN public.ladder_rungs r ON r.id = o.moved_to_rung_id
      WHERE o.contact_id = ${c.req.param('id')}::uuid
      ORDER BY o.occurred_at DESC
      LIMIT 100
    `;
    if (found.length) {
      await record(tx, { action: 'record.read', recordType: 'one_to_one', recordCount: found.length });
    }
    return found;
  });

  return c.json(ok(rows));
});

// ---------------------------------------------------------------------------
// Follow-ups
// ---------------------------------------------------------------------------

vinculum.post('/follow-ups', async (c) => {
  const rid = c.get('requestId');
  const session = c.get('session')!;

  const parsed = followUpSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json(err(parsed.error.issues[0].message, ERROR.VALIDATION, rid), 400);
  }
  const input = parsed.data;

  const sql = db(c);

  const created = await withTenant(sql, session, async (tx) => {
    const [row] = await tx`
      INSERT INTO public.follow_ups (tenant_id, contact_id, membership_id, reason, due_at)
      VALUES (
        coram.current_tenant_id(), ${input.contactId}::uuid,
        coalesce(
          ${input.membershipId ?? null}::uuid,
          (SELECT m.id FROM public.memberships m
           WHERE m.user_id = coram.current_user_id() AND m.tenant_id = coram.current_tenant_id())
        ),
        ${input.reason}, ${input.dueAt}::timestamptz
      )
      RETURNING id, due_at
    `;
    return row;
  });

  if (!created) {
    return c.json(err('No such contact, or not one you can see.', ERROR.NOT_FOUND, rid), 404);
  }
  return c.json(ok(created), 201);
});

vinculum.post('/follow-ups/:id/snooze', async (c) => {
  const rid = c.get('requestId');
  const session = c.get('session')!;

  const body = (await c.req.json().catch(() => null)) as { until?: string } | null;
  const until = body?.until;
  if (!until) return c.json(err('Snooze until when?', ERROR.VALIDATION, rid), 400);

  const sql = db(c);

  // snooze_count increments and is never reset. That is deliberate: it is the
  // only signal that distinguishes "not yet" from "never", and resetting it on
  // completion would erase the evidence that a queue is not working.
  const updated = await withTenant(
    sql,
    session,
    async (tx) =>
      (
        await tx`
          UPDATE public.follow_ups
          SET snoozed_until = ${until}::timestamptz, snooze_count = snooze_count + 1
          WHERE id = ${c.req.param('id')}::uuid AND status = 'open'
          RETURNING id, snoozed_until, snooze_count
        `
      )[0],
  );

  if (!updated) return c.json(err('No such open follow-up.', ERROR.NOT_FOUND, rid), 404);

  return c.json(
    ok(updated, {
      ...(Number(updated.snooze_count) >= 3
        ? {
            message:
              'Snoozed three times or more. It may be worth dropping this or handing it to someone else.',
          }
        : {}),
    }),
  );
});

vinculum.post('/follow-ups/:id/escalate', async (c) => {
  const rid = c.get('requestId');
  const session = c.get('session')!;

  const sql = db(c);

  const [row] = await withTenant(
    sql,
    session,
    (tx) => tx`SELECT coram.escalate_follow_up(${c.req.param('id')}::uuid) AS escalated_to`,
  );

  if (!row?.escalated_to) {
    return c.json(
      err(
        'Nobody to escalate to — this organizer does not report to anyone.',
        ERROR.CONFLICT,
        rid,
      ),
      409,
    );
  }

  return c.json(
    ok(
      { escalatedTo: row.escalated_to },
      {
        // Said explicitly because the opposite would be a reasonable guess.
        message: 'Their lead can now see this is overdue. The follow-up stays with you.',
      },
    ),
  );
});

vinculum.post('/follow-ups/:id/close', async (c) => {
  const rid = c.get('requestId');
  const session = c.get('session')!;

  const body = (await c.req.json().catch(() => ({}))) as { dropped?: boolean };

  const sql = db(c);

  const closed = await withTenant(
    sql,
    session,
    async (tx) =>
      (
        await tx`
          UPDATE public.follow_ups
          SET status = ${body.dropped ? 'dropped' : 'done'}, closed_at = now()
          WHERE id = ${c.req.param('id')}::uuid AND status = 'open'
          RETURNING id, status
        `
      ).length,
  );

  if (!closed) return c.json(err('No such open follow-up.', ERROR.NOT_FOUND, rid), 404);
  return c.json(ok());
});

// ---------------------------------------------------------------------------
// Relationship graph
// ---------------------------------------------------------------------------

vinculum.get('/contacts/:id/graph', async (c) => {
  const session = c.get('session')!;
  const id = c.req.param('id');

  const sql = db(c);

  /*
   * One hop only.
   *
   * Deeper traversal would let an organizer map a whole network out from one
   * contact in their turf, which is exactly the shape of thing a hostile
   * subpoena would ask for and exactly what turf bounds exist to prevent. The
   * RLS policy already hides edges whose far end is invisible; the depth limit
   * means nobody can walk around it a hop at a time.
   */
  const edges = await withTenant(
    sql,
    session,
    (tx) => tx`
      SELECT e.id, e.source_type, e.source_id, e.target_type, e.target_id, e.edge_reason,
             e.created_at
      FROM public.relationship_edges e
      WHERE (e.source_type = 'contact' AND e.source_id = ${id}::uuid)
         OR (e.target_type = 'contact' AND e.target_id = ${id}::uuid)
      ORDER BY e.created_at DESC
      LIMIT 200
    `,
  );

  return c.json(ok(edges, { depth: 1 }));
});

vinculum.post('/edges', async (c) => {
  const rid = c.get('requestId');
  const session = c.get('session')!;

  const parsed = edgeSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json(err(parsed.error.issues[0].message, ERROR.VALIDATION, rid), 400);
  }
  const input = parsed.data;

  const sql = db(c);

  // Idempotent on the unique constraint carried over from CROS, so repeated
  // ingestion of the same observation does not duplicate the graph.
  const created = await withTenant(
    sql,
    session,
    async (tx) =>
      (
        await tx`
          INSERT INTO public.relationship_edges
            (tenant_id, source_type, source_id, target_type, target_id, edge_reason)
          VALUES (
            coram.current_tenant_id(), ${input.sourceType}, ${input.sourceId}::uuid,
            ${input.targetType}, ${input.targetId}::uuid, ${input.edgeReason}
          )
          ON CONFLICT (tenant_id, source_type, source_id, target_type, target_id) DO NOTHING
          RETURNING id
        `
      )[0],
  );

  // Already present, or one end is not visible to this caller. Both mean the
  // same to the client: nothing new was written.
  return c.json(ok(created ?? null), created ? 201 : 200);
});

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

vinculum.get('/config', async (c) => {
  const session = c.get('session')!;

  const sql = db(c);

  const config = await withTenant(sql, session, async (tx) => {
    const codes = await tx`
      SELECT id, code, label, is_positive, sort_order FROM public.outcome_codes
      WHERE retired_at IS NULL ORDER BY sort_order, label
    `;
    const ladders = await tx`
      SELECT l.id, l.name,
             coalesce(
               (SELECT jsonb_agg(jsonb_build_object('id', r.id, 'name', r.name, 'position', r.position)
                                 ORDER BY r.position)
                FROM public.ladder_rungs r WHERE r.ladder_id = l.id),
               '[]'::jsonb
             ) AS rungs
      FROM public.ladders l ORDER BY l.name
    `;
    return { outcomeCodes: codes, ladders };
  });

  return c.json(ok(config));
});
