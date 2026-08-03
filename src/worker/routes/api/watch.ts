/**
 * /api/watch/* — the watch list, which lives inside Petitio (§5.5).
 *
 * Not a twelfth module. §5 is a closed list of eleven, and knowing that the
 * rent board is meeting on Tuesday is the step before every other thing the
 * advocacy module does. It renders as a tab under /app/advocacy.
 *
 * ---------------------------------------------------------------------------
 * Three rules the API keeps
 * ---------------------------------------------------------------------------
 *
 *   1. A term match creates the row; a model only scores it. `POST /poll`
 *      writes every match before it asks a model anything, so a model outage
 *      degrades the list to titles and links rather than losing documents.
 *      See shared/watch.ts.
 *
 *   2. A URL is re-validated immediately before the socket opens, in
 *      lib/watch.ts, not only when it is saved here. Two checks because the
 *      one that matters is the last one.
 *
 *   3. Converting an item is the point of the feature and it is one write.
 *      A hearing becomes an event; a bill becomes a draft. The watch item then
 *      holds a pointer so three organizers do not make three events out of one
 *      agenda, and expires at ninety days while the thing they made does not.
 *
 * Nothing here writes to the audit log, for the same reason nothing in
 * petitio.ts does: the audit log records access to personal data, and this
 * module holds none. A trail of who-read-which-agenda would be a liability
 * without a corresponding protection.
 */

import { Hono } from 'hono';
import { z } from 'zod';

import type { Env, Vars } from '../../env';
import { requireWorkspace } from '../../lib/auth';
import { db } from '../../lib/db';
import { ERROR, detailFor, err, logFailure, ok } from '../../lib/http';
import { consume } from '../../lib/ratelimit';
import { withTenant, type Tx } from '../../lib/rls';
import { fetchBills, fetchFeed, matchCandidates, read, type Candidate } from '../../lib/watch';
import { PATHWAYS } from '../../../shared/legislative';
import {
  ITEM_RETENTION_DAYS,
  MAX_SOURCES,
  MAX_TERMS_PER_TOPIC,
  MAX_TOPICS,
  normaliseTerms,
  reasonUrlRefused,
} from '../../../shared/watch';

export const watch = new Hono<{ Bindings: Env; Variables: Vars }>();

watch.use('*', requireWorkspace);

const JURISDICTIONS = new Set(PATHWAYS.map((p) => p.code));

/** The membership doing the writing, for `created_by` and `dismissed_by`. */
const ME = `(SELECT m.id FROM public.memberships m
             WHERE m.user_id = coram.current_user_id()
               AND m.tenant_id = coram.current_tenant_id())`;

const topicSchema = z.object({
  label: z.string().trim().min(1, 'Give the topic a name.').max(80),
  terms: z
    .array(z.string().trim().max(120))
    .min(1, 'Give at least one word to watch for.')
    .max(MAX_TERMS_PER_TOPIC),
  active: z.boolean().optional(),
});

const sourceSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('bills'),
    label: z.string().trim().min(1).max(120),
    jurisdiction: z
      .string()
      .trim()
      .toUpperCase()
      .refine((v) => JURISDICTIONS.has(v), 'Pick one of the fifty states or DC.'),
  }),
  z.object({
    kind: z.literal('feed'),
    label: z.string().trim().min(1, 'Give the feed a name.').max(120),
    url: z.string().trim().max(2_000),
  }),
]);

// ---------------------------------------------------------------------------
// Topics — the group's own words
// ---------------------------------------------------------------------------

watch.get('/topics', async (c) => {
  const rid = c.get('requestId');
  try {
    const rows = await withTenant(db(c), c.get('session')!, (tx) => tx`
      SELECT id, label, terms, active, created_at
      FROM public.watch_topics
      ORDER BY active DESC, label
    `);
    return c.json(ok(rows));
  } catch (error) {
    logFailure('watch.topics.list', rid, error);
    return c.json(err('Could not load your topics.', ERROR.INTERNAL, rid, detailFor(c.env, error)), 500);
  }
});

watch.post('/topics', async (c) => {
  const rid = c.get('requestId');
  const parsed = topicSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json(err(parsed.error.issues[0].message, ERROR.VALIDATION, rid), 400);
  }

  const terms = normaliseTerms(parsed.data.terms);
  if (!terms.length) {
    return c.json(
      err(
        'Those words are all too short to watch for. Two letters would match half the agenda; ' +
          'give three or more.',
        ERROR.VALIDATION,
        rid,
      ),
      400,
    );
  }

  try {
    const created = await withTenant(db(c), c.get('session')!, async (tx) => {
      const [{ count }] = await tx<{ count: number }[]>`
        SELECT count(*)::int AS count FROM public.watch_topics
      `;
      if (count >= MAX_TOPICS) return null;

      const [row] = await tx`
        INSERT INTO public.watch_topics (tenant_id, label, terms, created_by)
        VALUES (coram.current_tenant_id(), ${parsed.data.label}, ${terms}, ${tx.unsafe(ME)})
        RETURNING id, label, terms, active, created_at
      `;
      return row;
    });

    if (!created) {
      return c.json(
        err(
          `That is ${MAX_TOPICS} topics, which is the ceiling. It is a cost ceiling on a shared ` +
            `poller rather than a tier — widen an existing topic's words instead.`,
          ERROR.CONFLICT,
          rid,
        ),
        409,
      );
    }
    return c.json(ok(created), 201);
  } catch (error) {
    logFailure('watch.topics.create', rid, error);
    return c.json(err('Could not save that topic.', ERROR.INTERNAL, rid, detailFor(c.env, error)), 500);
  }
});

watch.patch('/topics/:id', async (c) => {
  const rid = c.get('requestId');
  const id = c.req.param('id');
  const parsed = topicSchema.partial().safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json(err(parsed.error.issues[0].message, ERROR.VALIDATION, rid), 400);
  }

  const terms = parsed.data.terms ? normaliseTerms(parsed.data.terms) : undefined;
  if (terms && !terms.length) {
    return c.json(err('A topic needs at least one word of three letters or more.', ERROR.VALIDATION, rid), 400);
  }

  try {
    const row = await withTenant(db(c), c.get('session')!, async (tx) => {
      const [updated] = await tx`
        UPDATE public.watch_topics SET
          label  = COALESCE(${parsed.data.label ?? null}, label),
          terms  = COALESCE(${terms ?? null}::text[], terms),
          active = COALESCE(${parsed.data.active ?? null}, active)
        WHERE id = ${id}::uuid
        RETURNING id, label, terms, active
      `;
      return updated ?? null;
    });
    if (!row) return c.json(err('No such topic.', ERROR.NOT_FOUND, rid), 404);
    return c.json(ok(row));
  } catch (error) {
    logFailure('watch.topics.update', rid, error);
    return c.json(err('Could not save that change.', ERROR.INTERNAL, rid, detailFor(c.env, error)), 500);
  }
});

watch.delete('/topics/:id', async (c) => {
  const rid = c.get('requestId');
  try {
    await withTenant(db(c), c.get('session')!, (tx) => tx`
      DELETE FROM public.watch_topics WHERE id = ${c.req.param('id')}::uuid
    `);
    return c.json(ok({ deleted: true }));
  } catch (error) {
    logFailure('watch.topics.delete', rid, error);
    return c.json(err('Could not remove that topic.', ERROR.INTERNAL, rid, detailFor(c.env, error)), 500);
  }
});

// ---------------------------------------------------------------------------
// Sources — where to look
// ---------------------------------------------------------------------------

watch.get('/sources', async (c) => {
  const rid = c.get('requestId');
  try {
    const rows = await withTenant(db(c), c.get('session')!, (tx) => tx`
      SELECT s.id, s.kind, s.label, s.jurisdiction, s.url, s.active,
             s.last_polled_at, s.last_status, s.last_error, s.last_found,
             (SELECT count(*) FROM public.watch_items i WHERE i.source_id = s.id)::int AS items
      FROM public.watch_sources s
      ORDER BY s.active DESC, s.label
    `);
    return c.json(
      ok(rows, {
        // Whether bill sources can work at all on this deployment. Told to the
        // user before they add one rather than after it fails.
        billsConfigured: Boolean(c.env.OPENSTATES_API_KEY),
      }),
    );
  } catch (error) {
    logFailure('watch.sources.list', rid, error);
    return c.json(err('Could not load your sources.', ERROR.INTERNAL, rid, detailFor(c.env, error)), 500);
  }
});

watch.post('/sources', async (c) => {
  const rid = c.get('requestId');
  const parsed = sourceSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json(err(parsed.error.issues[0].message, ERROR.VALIDATION, rid), 400);
  }
  const input = parsed.data;

  // The first of the two URL checks. The second is in lib/watch.ts, immediately
  // before the fetch — see the header note.
  if (input.kind === 'feed') {
    const refused = reasonUrlRefused(input.url);
    if (refused) return c.json(err(refused, ERROR.VALIDATION, rid), 400);
  }

  try {
    const created = await withTenant(db(c), c.get('session')!, async (tx) => {
      const [{ count }] = await tx<{ count: number }[]>`
        SELECT count(*)::int AS count FROM public.watch_sources
      `;
      if (count >= MAX_SOURCES) return null;

      const [row] = await tx`
        INSERT INTO public.watch_sources (tenant_id, kind, label, jurisdiction, url, created_by)
        VALUES (
          coram.current_tenant_id(), ${input.kind}::coram.watch_source_kind, ${input.label},
          ${input.kind === 'bills' ? input.jurisdiction : null},
          ${input.kind === 'feed' ? input.url : null},
          ${tx.unsafe(ME)}
        )
        RETURNING id, kind, label, jurisdiction, url, active, last_polled_at, last_status,
                  last_error, last_found
      `;
      return row;
    });

    if (!created) {
      return c.json(
        err(
          `That is ${MAX_SOURCES} sources, which is the ceiling on a shared poller. Nothing is ` +
            `gated behind a payment.`,
          ERROR.CONFLICT,
          rid,
        ),
        409,
      );
    }
    return c.json(ok(created), 201);
  } catch (error) {
    logFailure('watch.sources.create', rid, error);
    return c.json(err('Could not save that source.', ERROR.INTERNAL, rid, detailFor(c.env, error)), 500);
  }
});

watch.delete('/sources/:id', async (c) => {
  const rid = c.get('requestId');
  try {
    await withTenant(db(c), c.get('session')!, (tx) => tx`
      DELETE FROM public.watch_sources WHERE id = ${c.req.param('id')}::uuid
    `);
    return c.json(ok({ deleted: true }));
  } catch (error) {
    logFailure('watch.sources.delete', rid, error);
    return c.json(err('Could not remove that source.', ERROR.INTERNAL, rid, detailFor(c.env, error)), 500);
  }
});

// ---------------------------------------------------------------------------
// The list
// ---------------------------------------------------------------------------

watch.get('/items', async (c) => {
  const rid = c.get('requestId');
  const state = c.req.query('state');
  const wanted = state === 'kept' || state === 'dismissed' ? state : 'new';

  try {
    const rows = await withTenant(db(c), c.get('session')!, (tx) => tx`
      SELECT i.id, i.source_id, s.label AS source_label, i.title, i.url, i.published_at,
             i.summary, i.relevance, i.matched_terms, i.state,
             i.converted_kind, i.converted_id, i.first_seen_at
      FROM public.watch_items i
      JOIN public.watch_sources s ON s.id = i.source_id
      WHERE i.state = ${wanted}::coram.watch_item_state
      -- Relevance first, then recency. Nulls last rather than first: an item a
      -- model never scored should not outrank one it scored 90.
      ORDER BY i.relevance DESC NULLS LAST, i.published_at DESC NULLS LAST, i.first_seen_at DESC
      LIMIT 200
    `);
    return c.json(ok(rows, { retentionDays: ITEM_RETENTION_DAYS }));
  } catch (error) {
    logFailure('watch.items.list', rid, error);
    return c.json(err('Could not load the watch list.', ERROR.INTERNAL, rid, detailFor(c.env, error)), 500);
  }
});

const stateSchema = z.object({ state: z.enum(['new', 'kept', 'dismissed']) });

watch.patch('/items/:id', async (c) => {
  const rid = c.get('requestId');
  const parsed = stateSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json(err('Say whether it is kept, dismissed, or back to new.', ERROR.VALIDATION, rid), 400);
  }

  try {
    const row = await withTenant(db(c), c.get('session')!, async (tx) => {
      const [updated] = await tx`
        UPDATE public.watch_items SET
          state = ${parsed.data.state}::coram.watch_item_state,
          dismissed_by = CASE WHEN ${parsed.data.state === 'dismissed'} THEN ${tx.unsafe(ME)} ELSE NULL END
        WHERE id = ${c.req.param('id')}::uuid
        RETURNING id, state
      `;
      return updated ?? null;
    });
    if (!row) return c.json(err('No such item.', ERROR.NOT_FOUND, rid), 404);
    return c.json(ok(row));
  } catch (error) {
    logFailure('watch.items.state', rid, error);
    return c.json(err('Could not save that.', ERROR.INTERNAL, rid, detailFor(c.env, error)), 500);
  }
});

// ---------------------------------------------------------------------------
// Converting — the point of the whole thing
// ---------------------------------------------------------------------------

const convertSchema = z.discriminatedUnion('as', [
  z.object({
    as: z.literal('event'),
    /** ISO 8601. The feed rarely says when the meeting is, only when it posted. */
    startsAt: z.string().datetime({ offset: true }),
    location: z.string().trim().max(200).optional(),
  }),
  z.object({
    as: z.literal('bill'),
    jurisdiction: z
      .string()
      .trim()
      .toUpperCase()
      .refine((v) => JURISDICTIONS.has(v), 'Pick one of the fifty states or DC.'),
  }),
]);

watch.post('/items/:id/convert', async (c) => {
  const rid = c.get('requestId');
  const id = c.req.param('id');

  const parsed = convertSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json(err(parsed.error.issues[0].message, ERROR.VALIDATION, rid), 400);
  }
  const input = parsed.data;

  try {
    const result = await withTenant(db(c), c.get('session')!, async (tx) => {
      const [item] = await tx<{ id: string; title: string; url: string; converted_id: string | null; converted_kind: string | null }[]>`
        SELECT id, title, url, converted_id, converted_kind
        FROM public.watch_items WHERE id = ${id}::uuid
      `;
      if (!item) return { kind: 'missing' as const };

      // Already converted. Return what it became rather than making a second
      // one — three organizers reading the same agenda on the same morning is
      // the normal case, not the exceptional one.
      if (item.converted_id) {
        return { kind: 'already' as const, convertedKind: item.converted_kind, convertedId: item.converted_id };
      }

      if (input.as === 'event') {
        const [event] = await tx<{ id: string }[]>`
          INSERT INTO public.events (tenant_id, title, starts_at, location, description, created_by)
          VALUES (
            coram.current_tenant_id(), ${item.title.slice(0, 200)}, ${input.startsAt}::timestamptz,
            ${input.location ?? null},
            -- The link, so whoever turns up can read the notice itself. The
            -- watch item expires in ninety days; the event does not, so the
            -- address has to travel with it.
            ${`From the watch list: ${item.url}`},
            ${tx.unsafe(ME)}
          )
          RETURNING id
        `;
        await tx`
          UPDATE public.watch_items
          SET converted_kind = 'event', converted_id = ${event.id}::uuid, state = 'kept'
          WHERE id = ${id}::uuid
        `;
        return { kind: 'converted' as const, convertedKind: 'event', convertedId: event.id };
      }

      const [bill] = await tx<{ id: string }[]>`
        INSERT INTO public.bills
          (tenant_id, working_name, jurisdiction, route, problem, created_by)
        VALUES (
          coram.current_tenant_id(), ${item.title.slice(0, 160)}, ${input.jurisdiction},
          'sponsor'::coram.bill_route,
          ${`Noticed on the watch list: ${item.url}`},
          ${tx.unsafe(ME)}
        )
        RETURNING id
      `;
      await tx`
        UPDATE public.watch_items
        SET converted_kind = 'bill', converted_id = ${bill.id}::uuid, state = 'kept'
        WHERE id = ${id}::uuid
      `;
      return { kind: 'converted' as const, convertedKind: 'bill', convertedId: bill.id };
    });

    if (result.kind === 'missing') return c.json(err('No such item.', ERROR.NOT_FOUND, rid), 404);
    if (result.kind === 'already') {
      return c.json(
        ok({ convertedKind: result.convertedKind, convertedId: result.convertedId, alreadyExisted: true }),
      );
    }
    return c.json(ok({ ...result, alreadyExisted: false }), 201);
  } catch (error) {
    logFailure('watch.items.convert', rid, error);
    return c.json(err('Could not turn that into anything.', ERROR.INTERNAL, rid, detailFor(c.env, error)), 500);
  }
});

// ---------------------------------------------------------------------------
// Polling
// ---------------------------------------------------------------------------

/*
 * Six manual polls a day, per workspace.
 *
 * The scheduled poll is the normal path and this exists for the moment somebody
 * adds a source and wants to see whether it works. The ceiling is on us going
 * out to somebody else's server on a button press, not on the group.
 */
const POLL_LIMIT = { limit: 6, windowSeconds: 24 * 60 * 60 };

watch.post('/poll', async (c) => {
  const rid = c.get('requestId');
  const session = c.get('session')!;

  const quota = await consume(c.env, 'watch-poll', session.tenantId ?? null, POLL_LIMIT);
  if (!quota.allowed) {
    return c.json(
      err(
        `That is six manual checks today. The scheduled check runs every six hours regardless, ` +
          `so nothing is missed — this ceiling is about how often we knock on somebody else's ` +
          `server, not about your plan.`,
        ERROR.CONFLICT,
        rid,
      ),
      429,
    );
  }

  try {
    const report = await withTenant(db(c), session, (tx) => pollTenant(c.env, tx, session.tenantId!));
    return c.json(ok(report));
  } catch (error) {
    logFailure('watch.poll', rid, error);
    return c.json(err('The check did not finish.', ERROR.INTERNAL, rid, detailFor(c.env, error)), 500);
  }
});

export interface PollReport {
  polled: number;
  found: number;
  failures: { source: string; error: string }[];
}

/**
 * Poll every active source for one workspace and store what matched.
 *
 * Exported because the scheduled handler runs exactly this, per tenant, with a
 * cron connection rather than a request one. The ordering — fetch, match,
 * store, then summarise — is the safety property described in the header of
 * lib/watch.ts, and it is why the model call sits after the INSERT.
 *
 * `tenantId` is passed rather than read from `coram.current_tenant_id()`,
 * because the cron connection has no tenant context — it is BYPASSRLS across
 * every workspace at once. On the request path the value comes from the
 * session and RLS's WITH CHECK still refuses a row for anyone else's tenant, so
 * the parameter widens nothing; on the cron path it is the only way to say
 * which workspace the row belongs to.
 */
export async function pollTenant(env: Env, tx: Tx, tenantId: string): Promise<PollReport> {
  const topics = await tx<{ label: string; terms: string[] }[]>`
    SELECT label, terms FROM public.watch_topics WHERE active
  `;

  const terms = [...new Set(topics.flatMap((t) => t.terms))];
  const labels = topics.map((t) => t.label);

  const sources = await tx<
    {
      id: string;
      kind: 'bills' | 'feed';
      label: string;
      jurisdiction: string | null;
      url: string | null;
      etag: string | null;
      last_modified: string | null;
      last_polled_at: string | null;
    }[]
  >`
    SELECT id, kind, label, jurisdiction, url, etag, last_modified, last_polled_at
    FROM public.watch_sources WHERE active
  `;

  const report: PollReport = { polled: 0, found: 0, failures: [] };

  // No topics means nothing can match, and polling anyway would mean fetching
  // somebody's agenda to throw all of it away.
  if (!terms.length || !sources.length) return report;

  for (const source of sources) {
    report.polled += 1;

    const since = source.last_polled_at
      ? new Date(source.last_polled_at)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const result =
      source.kind === 'feed'
        ? await fetchFeed(source.url!, { etag: source.etag, lastModified: source.last_modified })
        : await fetchBills(env, source.jurisdiction!, since);

    if (!result.ok) {
      report.failures.push({ source: source.label, error: result.error });
      await tx`
        UPDATE public.watch_sources
        SET last_polled_at = now(), last_status = 'failed', last_error = ${result.error}
        WHERE id = ${source.id}::uuid
      `;
      continue;
    }

    const matched = matchCandidates(result.candidates as Candidate[], terms);
    let stored = 0;

    for (const candidate of matched) {
      /*
       * Store first, summarise second.
       *
       * ON CONFLICT DO NOTHING rather than an upsert: an item already on the
       * list has been read, possibly kept, possibly converted, and rewriting
       * its summary because a council republished the same agenda would move
       * it back to the top of somebody's morning for no reason.
       */
      const [row] = await tx<{ id: string }[]>`
        INSERT INTO public.watch_items
          (tenant_id, source_id, external_id, title, url, published_at, matched_terms)
        VALUES (
          ${tenantId}::uuid, ${source.id}::uuid, ${candidate.externalId},
          ${candidate.title}, ${candidate.url},
          ${candidate.publishedAt}::timestamptz, ${candidate.matchedTerms}
        )
        ON CONFLICT (source_id, external_id) DO NOTHING
        RETURNING id
      `;
      if (!row) continue;

      stored += 1;

      const reading = await read(env, { title: candidate.title, abstract: candidate.abstract }, labels);
      if (reading.summary !== null || reading.relevance !== null) {
        await tx`
          UPDATE public.watch_items
          SET summary = ${reading.summary}, relevance = ${reading.relevance}
          WHERE id = ${row.id}::uuid
        `;
      }
    }

    report.found += stored;

    await tx`
      UPDATE public.watch_sources SET
        last_polled_at = now(), last_status = 'ok', last_error = NULL, last_found = ${stored},
        etag = ${result.etag ?? null}, last_modified = ${result.lastModified ?? null}
      WHERE id = ${source.id}::uuid
    `;
  }

  return report;
}
