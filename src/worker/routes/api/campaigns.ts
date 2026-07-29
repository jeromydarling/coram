/**
 * /api/campaigns/* — the email and SMS composer (§5.4).
 *
 * The audience is resolved from a saved segment at send time, never stored as
 * a list of names. Two reasons: a stored list ages out of step with the
 * contacts it names, and a second copy of "who is on this list" is a second
 * thing to purge and a second thing to hand over.
 *
 * On the opt-out ledger: the queries below filter with NOT
 * coram.is_suppressed(...) so a suppressed contact is skipped cleanly and the
 * organizer is told how many were held back. The BEFORE INSERT trigger in 0004
 * is what actually guarantees it — this filter is the good error message, the
 * trigger is the promise. If they ever disagree, the trigger wins and the
 * insert fails, which is the right way round.
 */

import { Hono } from 'hono';
import { z } from 'zod';

import type { Env, Vars } from '../../env';
import { record } from '../../lib/audit';
import { requireWorkspace } from '../../lib/auth';
import { mintOneTimeToken } from '../../lib/crypto';
import { ERROR, err, ok, logFailure } from '../../lib/http';
import {withTenant, type Tx} from '../../lib/rls';
import { db } from '../../lib/db';

import { unknownMergeFields } from '../../lib/sender';

export const campaigns = new Hono<{ Bindings: Env; Variables: Vars }>();

campaigns.use('*', requireWorkspace);

/**
 * A segment definition, as stored in `segments.definition`.
 *
 * Structured and closed rather than a query fragment. A segment is written by
 * a user; letting it carry SQL — even "just a WHERE clause" — would make every
 * saved segment an injection vector aimed at the one table that matters most.
 */
const segmentDefinition = z
  .object({
    tagIds: z.array(z.string().uuid()).max(20).optional(),
    turfIds: z.array(z.string().uuid()).max(50).optional(),
    hasEmail: z.boolean().optional(),
    hasPhone: z.boolean().optional(),
    postalPrefix: z.string().trim().max(6).optional(),
  })
  .strict();

const createCampaignSchema = z.object({
  name: z.string().trim().min(1, 'Name the campaign.').max(200),
  channel: z.enum(['email', 'sms']),
  subject: z.string().trim().max(300).optional(),
  body: z.string().trim().min(1, 'Write something.').max(50_000),
  segmentId: z.string().uuid().optional(),
});

// ---------------------------------------------------------------------------
// GET /api/campaigns
// ---------------------------------------------------------------------------

campaigns.get('/', async (c) => {
  const session = c.get('session')!;

  const sql = db(c);

  const rows = await withTenant(
    sql,
    session,
    (tx) => tx`
      SELECT c.id, c.name, c.channel, c.subject, c.status, c.scheduled_at, c.sent_at, c.created_at,
             (SELECT count(*) FROM public.campaign_sends s WHERE s.campaign_id = c.id)::int AS recipients,
             (SELECT count(*) FROM public.campaign_sends s
              WHERE s.campaign_id = c.id AND s.status IN ('bounced','complained','failed'))::int AS problems
      FROM public.campaigns c
      ORDER BY c.created_at DESC
      LIMIT 100
    `,
  );

  return c.json(ok(rows));
});

// ---------------------------------------------------------------------------
// POST /api/campaigns
// ---------------------------------------------------------------------------

campaigns.post('/', async (c) => {
  const rid = c.get('requestId');
  const session = c.get('session')!;

  const parsed = createCampaignSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json(err(parsed.error.issues[0].message, ERROR.VALIDATION, rid), 400);
  }
  const input = parsed.data;

  if (input.channel === 'email' && !input.subject) {
    return c.json(err('An email needs a subject line.', ERROR.VALIDATION, rid), 400);
  }

  // Warn, do not block. A composer that refuses to save because of a typo in a
  // placeholder is a composer people work around by not using placeholders.
  const unknown = unknownMergeFields(input.body);

  const sql = db(c);

  const created = await withTenant(sql, session, async (tx) => {
    const [row] = await tx`
      INSERT INTO public.campaigns
        (tenant_id, name, channel, subject, body, segment_id, status, created_by)
      VALUES (
        coram.current_tenant_id(), ${input.name}, ${input.channel},
        ${input.subject ?? null}, ${input.body}, ${input.segmentId ?? null}::uuid,
        'draft', coram.current_user_id()
      )
      RETURNING id, name, channel, status
    `;
    return row;
  });

  return c.json(ok(created, unknown.length ? { unknownMergeFields: unknown } : undefined), 201);
});

// ---------------------------------------------------------------------------
// GET /api/campaigns/:id/audience — who would receive this, and who would not
// ---------------------------------------------------------------------------

campaigns.get('/:id/audience', async (c) => {
  const rid = c.get('requestId');
  const session = c.get('session')!;
  const id = c.req.param('id');

  const sql = db(c);

  const result = await withTenant(sql, session, async (tx) => {
    const [campaign] = await tx`
      SELECT c.id, c.channel, c.segment_id, s.definition
      FROM public.campaigns c
      LEFT JOIN public.segments s ON s.id = c.segment_id
      WHERE c.id = ${id}::uuid
    `;
    if (!campaign) return null;

    const definition = parseDefinition(campaign.definition);
    const channel = campaign.channel as 'email' | 'sms';

    const [counts] = await tx`
      SELECT
        count(*)::int AS matched,
        count(*) FILTER (WHERE ${reachable(tx, channel)})::int AS reachable,
        count(*) FILTER (
          WHERE ${reachable(tx, channel)} AND coram.is_suppressed(c.id, ${channel})
        )::int AS opted_out
      FROM public.contacts c
      WHERE ${segmentFilter(tx, definition)}
    `;

    return {
      matched: Number(counts.matched),
      // Held back because they opted out. Shown to the organizer as a number,
      // never as a list — the point of an opt-out is not to become a segment.
      optedOut: Number(counts.opted_out),
      willReceive: Number(counts.reachable) - Number(counts.opted_out),
      unreachable: Number(counts.matched) - Number(counts.reachable),
    };
  });

  if (!result) return c.json(err('No such campaign.', ERROR.NOT_FOUND, rid), 404);
  return c.json(ok(result));
});

// ---------------------------------------------------------------------------
// POST /api/campaigns/:id/send
// ---------------------------------------------------------------------------

campaigns.post('/:id/send', async (c) => {
  const rid = c.get('requestId');
  const session = c.get('session')!;
  const id = c.req.param('id');

  const sql = db(c);

  try {
    const result = await withTenant(sql, session, async (tx) => {
      const [campaign] = await tx`
        SELECT c.id, c.channel, c.status, s.definition
        FROM public.campaigns c
        LEFT JOIN public.segments s ON s.id = c.segment_id
        WHERE c.id = ${id}::uuid
        FOR UPDATE OF c
      `;
      if (!campaign) return { kind: 'not_found' as const };
      if (campaign.status !== 'draft') return { kind: 'already' as const, status: campaign.status };

      const definition = parseDefinition(campaign.definition);
      const channel = campaign.channel as 'email' | 'sms';

      // One statement. Every recipient is chosen and every send row created in
      // the same transaction that flips the campaign to 'sending', so a
      // crash halfway cannot leave a half-sent campaign that would be
      // re-sent from the top.
      const queued = await tx`
        INSERT INTO public.campaign_sends (tenant_id, campaign_id, contact_id, status)
        SELECT coram.current_tenant_id(), ${id}::uuid, c.id, 'queued'
        FROM public.contacts c
        WHERE ${segmentFilter(tx, definition)}
          AND ${reachable(tx, channel)}
          AND NOT coram.is_suppressed(c.id, ${channel})
        ON CONFLICT (campaign_id, contact_id) DO NOTHING
        RETURNING id
      `;

      await tx`
        UPDATE public.campaigns SET status = 'sending', sent_at = now() WHERE id = ${id}::uuid
      `;

      await record(tx, {
        action: 'record.export',
        recordType: 'campaign_send',
        recordCount: queued.length,
      });

      return { kind: 'queued' as const, count: queued.length };
    });

    if (result.kind === 'not_found') {
      return c.json(err('No such campaign.', ERROR.NOT_FOUND, rid), 404);
    }
    if (result.kind === 'already') {
      return c.json(
        err(`This campaign is already ${result.status}.`, ERROR.CONFLICT, rid),
        409,
      );
    }

    // Delivery happens on the queue. The rows exist and are marked queued, so
    // a failure to enqueue is recoverable by re-driving rather than lost.
    c.executionCtx.waitUntil(
      c.env.Q_SEND.send({ kind: 'campaign', campaignId: id }).catch(() => undefined),
    );

    return c.json(ok({ queued: result.count }));
  } catch (error) {
    logFailure('campaigns', rid, error);
    return c.json(err('Could not send that campaign.', ERROR.INTERNAL, rid), 500);
  }
});

// ---------------------------------------------------------------------------
// GET /api/campaigns/:id/deliverability — §5.4 dashboard
// ---------------------------------------------------------------------------

campaigns.get('/:id/deliverability', async (c) => {
  const session = c.get('session')!;
  const id = c.req.param('id');

  const sql = db(c);

  const rows = await withTenant(
    sql,
    session,
    (tx) => tx`
      SELECT status, count(*)::int AS count
      FROM public.campaign_sends
      WHERE campaign_id = ${id}::uuid
      GROUP BY status
    `,
  );

  const byStatus = Object.fromEntries(rows.map((r) => [r.status as string, Number(r.count)]));
  const total = Object.values(byStatus).reduce((n, v) => n + v, 0);
  const bounced = byStatus.bounced ?? 0;
  const complained = byStatus.complained ?? 0;

  return c.json(
    ok({
      total,
      byStatus,
      // Rates rather than raw counts, because the number that matters for
      // deliverability is proportional and the thresholds people are judged
      // against (roughly 2% bounce, 0.1% complaint) are proportional too.
      bounceRate: total ? bounced / total : 0,
      complaintRate: total ? complained / total : 0,
    }),
  );
});

// ---------------------------------------------------------------------------
// Unsubscribe links
// ---------------------------------------------------------------------------

/**
 * Mint a one-time unsubscribe token for a contact. Called by the send job for
 * every outbound email — a link that identifies the person without putting
 * their address in a URL that will end up in referrer headers and server logs.
 */
export async function mintUnsubscribeToken(tx: Tx, contactId: string): Promise<string> {
  const { token, hash } = await mintOneTimeToken();
  await tx`
    INSERT INTO public.unsubscribe_tokens (tenant_id, contact_id, token_hash)
    VALUES (coram.current_tenant_id(), ${contactId}::uuid, ${hash})
  `;
  return token;
}

// ---------------------------------------------------------------------------

type Definition = z.infer<typeof segmentDefinition>;

/** A missing or malformed definition means the whole workspace, not a crash. */
function parseDefinition(raw: unknown): Definition {
  const parsed = segmentDefinition.safeParse(raw ?? {});
  return parsed.success ? parsed.data : {};
}

/**
 * Build the audience predicate from a structured definition.
 *
 * Every value goes in as a bind parameter; nothing from the segment is
 * interpolated into SQL text.
 */
function segmentFilter(tx: Tx, d: Definition) {
  return tx`
    ${d.tagIds?.length
      ? tx`EXISTS (SELECT 1 FROM public.contact_tags ct
                   WHERE ct.contact_id = c.id AND ct.tag_id = ANY(${d.tagIds}::uuid[]))`
      : tx`true`}
    AND ${d.turfIds?.length ? tx`c.turf_id = ANY(${d.turfIds}::uuid[])` : tx`true`}
    AND ${d.hasEmail ? tx`c.email IS NOT NULL` : tx`true`}
    AND ${d.hasPhone ? tx`c.phone IS NOT NULL` : tx`true`}
    AND ${d.postalPrefix ? tx`c.postal_code ILIKE ${d.postalPrefix + '%'}` : tx`true`}
  `;
}

/** You cannot email someone with no email address. */
function reachable(tx: Tx, channel: 'email' | 'sms') {
  return channel === 'email' ? tx`c.email IS NOT NULL` : tx`c.phone IS NOT NULL`;
}
