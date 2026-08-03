/**
 * /api/scriba/* — private AI (§5.10).
 *
 * Four tasks and no more: draft a message, summarise a segment, turn a meeting
 * into minutes, translate something already written. Not a chat box. The scope
 * guard refuses anything else, and the narrow surface is the reason redaction is
 * tractable — we know what the prompt contains because we assembled it.
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
import { redact, residualRisk, scrubInvented, type KnownValues } from '../../lib/redact';
import {withTenant, type Tx} from '../../lib/rls';
import { db } from '../../lib/db';

import { checkScope } from '../../lib/scope';
import { LANGUAGE_CODES, TRANSLATION_CAVEAT, languageFor } from '../../../shared/languages';

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

  // Step 3, for the user's text first — what came back decides what the system
  // prompt is allowed to say.
  const user = redact(input.intent, known);

  const STYLE =
    'You write short, plain messages for a grassroots organizing group. ' +
    'Active voice, short sentences, no exclamation points, no emoji. ' +
    'Do not use the words empower, amplify, disrupt, or revolutionize. ';

  /*
   * The placeholder instruction is only shown when there are placeholders.
   *
   * Describing the syntax to a model that has not been given any reads as
   * permission to use it: the first live draft had nothing redacted and Llama
   * still wrote "[PERSON_1] will lead the discussion." Say nothing about the
   * convention when it is not in play, and name no one when no one was removed.
   */
  const prompt: Message[] = [
    {
      role: 'system',
      content:
        STYLE +
        (Object.keys(user.map).length
          ? 'Square-bracketed placeholders such as [PERSON_1] are real details that were ' +
            'removed. Keep each one exactly as written. Never write a placeholder that is ' +
            'not already in the text you were given.'
          : 'Do not invent names, and do not write square-bracketed placeholders.'),
    },
    { role: 'user', content: user.text },
  ];

  // The system prompt is redacted too. It is static today, but it is the one
  // people forget when it stops being static.
  const system = redact(prompt[0].content, known);
  const map = { ...user.map, ...system.map };

  // Steps 4 and 5.
  const result = await dispatch(c.env, [
    { role: 'system', content: system.text },
    { role: 'user', content: user.text },
  ]);

  if (!result.ok) {
    return c.json(err(explain(result.kind), ERROR.INTERNAL, rid), 502);
  }

  // Step 5a. Whatever the prompt asked for, the output is checked.
  const draft = scrubInvented(result.content, map);

  await withTenant(sql, session, (tx) =>
    record(tx, { action: 'record.read', recordType: 'scriba_draft' }),
  );

  // Step 6. The map goes to the browser, never to the model.
  return c.json(
    ok(
      {
        draft: draft.text,
        redactions: map,
        removed: [user.removed, system.removed].reduce(
          (total, r) => total + Object.values(r).reduce((a, b) => a + b, 0),
          0,
        ),
        // Blanks the model made up, which the organizer has to fill in.
        invented: draft.invented,
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

  const summary = scrubInvented(result.content, map);

  return c.json(
    ok(
      { summary: summary.text, redactions: map, invented: summary.invented },
      { notice: NOTICE },
    ),
  );
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

  const minutes = scrubInvented(result.content, map);

  return c.json(
    ok(
      { minutes: minutes.text, redactions: map, invented: minutes.invented },
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

// ---------------------------------------------------------------------------
// POST /api/scriba/translate
//
// The highest-value thing a model does for a neighbourhood group, and the
// least glamorous. A tenants union whose block speaks Spanish, Cantonese and
// Vietnamese currently picks one, or pays for three translations it cannot
// afford, or — most often — sends the notice in English and wonders why half
// the building did not come.
//
// Two rules make it safe to ship:
//
//   Redaction still applies. A flyer usually carries no personal detail, but
//   "usually" is not a security property, and a campaign body pasted in here
//   routinely contains an organizer's phone number. Same pipeline as every
//   other route in this file.
//
//   The caveat is not dismissible and travels with the payload. A machine
//   translation of "you do not have to open the door" that lands slightly
//   wrong is not a typo. The product's job is to get a group most of the way
//   in seconds so a bilingual member spends two minutes instead of an hour.
// ---------------------------------------------------------------------------

const translateSchema = z.object({
  text: z.string().trim().min(1, 'Nothing to translate.').max(8_000),
  /** Closed list — see shared/languages.ts for why this is not free text. */
  languages: z
    .array(z.enum(LANGUAGE_CODES as [string, ...string[]]))
    .min(1, 'Pick at least one language.')
    .max(6, 'Six at a time. More than that and nobody checks any of them.'),
});

scriba.post('/translate', async (c) => {
  const rid = c.get('requestId');
  const session = c.get('session')!;

  const parsed = translateSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json(err(parsed.error.issues[0].message, ERROR.VALIDATION, rid), 400);
  }
  const input = parsed.data;

  // Step 1, as everywhere else in this file: refuse before anything happens.
  const scope = checkScope(input.text);
  if (!scope.allowed) {
    return c.json(ok({ refused: true, reason: scope.reason, response: scope.response }));
  }

  const sql = db(c);
  const known = await withTenant(sql, session, (tx) => rosterFor(tx));
  const source = redact(input.text, known);

  /*
   * One dispatch per language rather than one asking for all of them.
   *
   * A single call returning six blocks has to be parsed back apart, and the
   * failure mode is a model that merges two languages or drops one silently —
   * which nobody notices until a Vietnamese-speaking tenant gets a Korean
   * notice. Separate calls cost more and fail visibly, one language at a time.
   */
  const results = await Promise.all(
    input.languages.map(async (code) => {
      const language = languageFor(code)!;

      const messages: Message[] = [
        {
          role: 'system',
          content:
            `Translate the user's text into ${language.name}. ` +
            'Return only the translation, with no preamble, no notes, and no explanation. ' +
            'Keep the line breaks and the order of the original. ' +
            // The placeholders redaction inserted must survive the round trip,
            // or reinsertion in the browser puts the wrong name back — or none.
            'Any token in square brackets such as [PERSON_1] or [PHONE_2] is a placeholder: ' +
            'copy it through exactly as it appears and never translate or reword it. ' +
            'Do not invent placeholders that are not in the text. ' +
            'Use the register a neighbourhood organization would use writing to its members: ' +
            'plain, direct, and not formal officialese.',
        },
        { role: 'user', content: source.text },
      ];

      const result = await dispatch(c.env, messages);
      if (!result.ok) return { code, ok: false as const, error: explain(result.kind) };

      const cleaned = scrubInvented(result.content, source.map);
      return {
        code,
        ok: true as const,
        name: language.name,
        endonym: language.endonym,
        rtl: language.rtl ?? false,
        text: cleaned.text,
        invented: cleaned.invented,
      };
    }),
  );

  await withTenant(sql, session, (tx) =>
    record(tx, { action: 'record.read', recordType: 'scriba_translate' }),
  );

  return c.json(
    ok(
      {
        translations: results,
        redactions: source.map,
        removed: Object.values(source.removed).reduce((a, b) => a + b, 0),
        unverified: residualRisk(input.text),
      },
      { notice: NOTICE, caveat: TRANSLATION_CAVEAT },
    ),
  );
});
