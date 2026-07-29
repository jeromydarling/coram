/**
 * /api/scriba/* — private AI (§5.10).
 *
 * Three tasks and no more: draft a message, summarise a segment, turn a meeting
 * into minutes. Not a chat box. The scope guard refuses anything else, and the
 * narrow surface is the reason redaction is tractable — we know what the prompt
 * contains because we assembled it.
 *
 * The order of operations here is the whole module, and it does not vary:
 *
 *   1. scope check       — refuse before anything else happens
 *   2. gather            — read the workspace data under RLS
 *   3. redact            — replace every known value and every pattern
 *   4. assert            — inside dispatch, refuse to open a socket otherwise
 *   5. dispatch          — to INFERENCE_ENDPOINT
 *   6. return with map   — the client reinserts (§3.8)
 *
 * Step 6 is why the response carries a `redactions` object. That map goes to
 * the browser and never to the model, and the SPA puts the real names back
 * before anyone reads the draft.
 */

import { Hono } from 'hono';
import { z } from 'zod';

import type { Env, Vars } from '../../env';
import { record } from '../../lib/audit';
import { requireWorkspace } from '../../lib/auth';
import { ERROR, err, ok } from '../../lib/http';
import { dispatch, explain, type Message } from '../../lib/inference';
import { redact, residualRisk, type KnownValues } from '../../lib/redact';
import {withTenant, type Tx} from '../../lib/rls';
import { db } from '../../lib/db';

import { checkScope } from '../../lib/scope';

export const scriba = new Hono<{ Bindings: Env; Variables: Vars }>();

scriba.use('*', requireWorkspace);

/**
 * Stated on every response (§5.10: "No training on tenant data, ever. State
 * this in the UI at point of use."). Returned with the payload rather than left
 * to the front-end, so it cannot be styled away in a redesign.
 */
const NOTICE =
  'This went to a private model. Names and contact details were removed before it was sent ' +
  'and put back in your browser. Nothing here trains anything.';

const draftSchema = z.object({
  /** What the organizer wants to say, in their words. */
  intent: z.string().trim().min(1, 'Say what you want to write.').max(2_000),
  channel: z.enum(['email', 'sms']).default('email'),
  segmentId: z.string().uuid().optional(),
});

const summariseSchema = z.object({
  eventId: z.string().uuid(),
});

const minutesSchema = z.object({
  proposalId: z.string().uuid(),
});

// ---------------------------------------------------------------------------
// POST /api/scriba/draft
// ---------------------------------------------------------------------------

scriba.post('/draft', async (c) => {
  const rid = c.get('requestId');
  const session = c.get('session')!;

  const parsed = draftSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json(err(parsed.error.issues[0].message, ERROR.VALIDATION, rid), 400);
  }
  const input = parsed.data;

  // Step 1. Before the database is touched, before anything is assembled.
  const scope = checkScope(input.intent);
  if (!scope.allowed) {
    return c.json(ok({ refused: true, reason: scope.reason, response: scope.response }));
  }

  const sql = db(c);

  // Step 2. The roster is what makes name redaction work at all — no pattern
  // finds "Ada Okonkwo" in prose, but the list of people this workspace
  // organizes with does.
  const known = await withTenant(sql, session, (tx) => rosterFor(tx));

  const prompt: Message[] = [
    {
      role: 'system',
      content:
        'You write short, plain messages for a grassroots organizing group. ' +
        'Active voice, short sentences, no exclamation points, no emoji. ' +
        'Do not use the words empower, amplify, disrupt, or revolutionize. ' +
        'Placeholders like [PERSON_1] are real names that were removed; keep them exactly as ' +
        'written and do not invent others.',
    },
    { role: 'user', content: input.intent },
  ];

  // Step 3. Every message, including the system prompt.
  const redacted = prompt.map((m) => ({ role: m.role, ...redact(m.content, known) }));
  const map = Object.assign({}, ...redacted.map((r) => r.map));

  // Steps 4 and 5.
  const result = await dispatch(
    c.env,
    redacted.map((r) => ({ role: r.role, content: r.text })),
  );

  if (!result.ok) {
    return c.json(err(explain(result.kind), ERROR.INTERNAL, rid), 502);
  }

  await withTenant(sql, session, (tx) =>
    record(tx, { action: 'record.read', recordType: 'scriba_draft' }),
  );

  // Step 6. The map goes to the browser, never to the model.
  return c.json(
    ok(
      {
        draft: result.content,
        redactions: map,
        removed: redacted.reduce(
          (total, r) => total + Object.values(r.removed).reduce((a, b) => a + b, 0),
          0,
        ),
        // What redaction could not verify. Shown to the user before they send.
        unverified: residualRisk(input.intent),
      },
      { notice: NOTICE },
    ),
  );
});

// ---------------------------------------------------------------------------
// POST /api/scriba/summarise — an event
// ---------------------------------------------------------------------------

scriba.post('/summarise', async (c) => {
  const rid = c.get('requestId');
  const session = c.get('session')!;

  const parsed = summariseSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json(err('Which event?', ERROR.VALIDATION, rid), 400);

  const sql = db(c);

  const gathered = await withTenant(sql, session, async (tx) => {
    const [event] = await tx`
      SELECT title, starts_at, location_name FROM public.events
      WHERE id = ${parsed.data.eventId}::uuid
    `;
    if (!event) return null;

    /*
     * Counts, not names.
     *
     * Summarising an event does not require a list of who came, so this asks
     * for numbers. That is not only minimization — it means the prompt is short
     * and there is far less for redaction to get wrong.
     */
    const [counts] = await tx`
      SELECT
        (SELECT count(*) FROM public.rsvps r
         WHERE r.event_id = ${parsed.data.eventId}::uuid AND r.status = 'going')::int AS rsvps,
        (SELECT count(*) FROM public.check_ins ci
         WHERE ci.event_id = ${parsed.data.eventId}::uuid)::int AS attended
    `;

    return { event, counts };
  });

  if (!gathered) return c.json(err('No such event.', ERROR.NOT_FOUND, rid), 404);

  const known = await withTenant(sql, session, (tx) => rosterFor(tx));

  const factual =
    `Event: ${gathered.event.title}. ` +
    `Held ${new Date(gathered.event.starts_at as string).toDateString()}` +
    (gathered.event.location_name ? ` at ${gathered.event.location_name}` : '') +
    `. ${gathered.counts.rsvps} said they would come; ${gathered.counts.attended} checked in.`;

  const prompt: Message[] = [
    {
      role: 'system',
      content:
        'Summarise what happened at an organizing event in three or four plain sentences. ' +
        'State only what the figures support. Do not speculate about why people did or did ' +
        'not attend.',
    },
    { role: 'user', content: factual },
  ];

  const redacted = prompt.map((m) => ({ role: m.role, ...redact(m.content, known) }));
  const map = Object.assign({}, ...redacted.map((r) => r.map));

  const result = await dispatch(
    c.env,
    redacted.map((r) => ({ role: r.role, content: r.text })),
  );

  if (!result.ok) return c.json(err(explain(result.kind), ERROR.INTERNAL, rid), 502);

  return c.json(ok({ summary: result.content, redactions: map }, { notice: NOTICE }));
});

// ---------------------------------------------------------------------------
// POST /api/scriba/minutes — from a proposal and its ballot
// ---------------------------------------------------------------------------

scriba.post('/minutes', async (c) => {
  const rid = c.get('requestId');
  const session = c.get('session')!;

  const parsed = minutesSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json(err('Which proposal?', ERROR.VALIDATION, rid), 400);

  const sql = db(c);

  const gathered = await withTenant(sql, session, async (tx) => {
    const [proposal] = await tx`
      SELECT title, body, status FROM public.proposals WHERE id = ${parsed.data.proposalId}::uuid
    `;
    if (!proposal) return null;

    const [ballot] = await tx`
      SELECT method, result, eligible_count FROM public.ballots
      WHERE proposal_id = ${parsed.data.proposalId}::uuid ORDER BY created_at DESC LIMIT 1
    `;
    const [comments] = await tx`
      SELECT count(*)::int AS n FROM public.proposal_comments
      WHERE proposal_id = ${parsed.data.proposalId}::uuid
    `;

    return { proposal, ballot, comments };
  });

  if (!gathered) return c.json(err('No such proposal.', ERROR.NOT_FOUND, rid), 404);

  const known = await withTenant(sql, session, (tx) => rosterFor(tx));

  /*
   * The discussion itself is not sent.
   *
   * Comments are attributed, and a deliberation is exactly the kind of text
   * that carries names redaction has never seen — someone referring to a member
   * by a nickname, or to a person who is not in the CRM at all. Minutes are
   * generated from the decision and its shape, and a human writes what was
   * argued. §5.8 asks for automatic generation, not automatic authorship.
   */
  const factual =
    `Proposal: ${gathered.proposal.title}. ` +
    `Outcome: ${gathered.proposal.status}. ` +
    (gathered.ballot
      ? `Decided by ${gathered.ballot.method} among ${gathered.ballot.eligible_count} eligible ` +
        `members; result ${gathered.ballot.result ?? 'pending'}. `
      : 'No ballot was held. ') +
    `${gathered.comments.n} comments were made in discussion.`;

  const prompt: Message[] = [
    {
      role: 'system',
      content:
        'Write minutes for one item of a meeting. Say what was proposed, how it was decided, ' +
        'and what the outcome was. Do not characterise the discussion — you have not seen it.',
    },
    { role: 'user', content: factual },
  ];

  const redacted = prompt.map((m) => ({ role: m.role, ...redact(m.content, known) }));
  const map = Object.assign({}, ...redacted.map((r) => r.map));

  const result = await dispatch(
    c.env,
    redacted.map((r) => ({ role: r.role, content: r.text })),
  );

  if (!result.ok) return c.json(err(explain(result.kind), ERROR.INTERNAL, rid), 502);

  return c.json(
    ok(
      { minutes: result.content, redactions: map },
      {
        notice: NOTICE,
        message: 'A draft. Nothing is minuted until someone adopts it.',
      },
    ),
  );
});

// ---------------------------------------------------------------------------

/**
 * The workspace's own names and contact details, for redaction pass 1.
 *
 * Bounded at 5,000 — beyond that the redaction pass gets slow and a workspace
 * that large should be summarising a segment rather than everything. The bound
 * is a real limitation on a big list and is reported by `residualRisk` rather
 * than hidden.
 *
 * Runs under the caller's RLS, so an organizer's roster is their turf. That is
 * correct for access, and worth noticing for redaction: a name outside their
 * turf will not be redacted by pass 1. Pass 2 still catches structured values,
 * and the review step catches the rest.
 */
async function rosterFor(tx: Tx): Promise<KnownValues> {
  const rows = await tx`
    SELECT display_name, email, phone, postal_code FROM public.contacts LIMIT 5000
  `;

  return {
    names: rows.map((r) => r.display_name as string).filter(Boolean),
    emails: rows.map((r) => r.email as string).filter(Boolean),
    phones: rows.map((r) => r.phone as string).filter(Boolean),
    postalCodes: rows.map((r) => r.postal_code as string).filter(Boolean),
  };
}
