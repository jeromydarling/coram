/**
 * Polling the watch list: fetching public documents, matching them against a
 * group's own words, and asking a model to summarise the ones that matched.
 *
 * ---------------------------------------------------------------------------
 * The order of operations is the safety property
 * ---------------------------------------------------------------------------
 *
 *   fetch → match on terms → store → (optionally) summarise and score
 *
 * The model runs last and it runs on rows that already exist. It cannot
 * suppress an item, it cannot invent one, and if it is unavailable the poll
 * still produces a list with titles, links and dates in it. See shared/watch.ts
 * for why that ordering is not negotiable.
 *
 * ---------------------------------------------------------------------------
 * What is sent to the model
 * ---------------------------------------------------------------------------
 *
 * The public document's title and its own abstract, plus the group's topic
 * words. Nothing else — no workspace name, no member, no contact, nothing from
 * any other table. `dispatch()` runs `assertRedacted` over every message
 * regardless (§3.8), but the prompt is assembled from two sources on purpose so
 * that the check is a backstop rather than the control.
 *
 * ---------------------------------------------------------------------------
 * Fetching on the group's behalf is a feature, and it is worth saying why
 * ---------------------------------------------------------------------------
 *
 * A tenants' union that polls a sheriff's calendar from an office laptop leaves
 * that office's address in the sheriff's logs, every hour, for years. Polling
 * from here means the upstream sees a Cloudflare address shared with everyone
 * else and learns nothing about who was reading. That is the same argument as
 * every other data-minimization decision in this product, pointed outward.
 */

import type { Env } from '../env';
import { dispatch } from './inference';
import { parseFeed, type FeedEntry } from './feed';
import {
  MAX_FEED_BYTES,
  MAX_ITEMS_PER_POLL,
  matches,
  reasonUrlRefused,
} from '../../shared/watch';

/** A document from any source, before it has been matched. */
export interface Candidate {
  externalId: string;
  title: string;
  url: string;
  publishedAt: string | null;
  /** The upstream's own abstract. Used for matching and for the prompt. */
  abstract: string;
}

export type FetchResult =
  | { ok: true; candidates: Candidate[]; notModified?: boolean; etag?: string | null; lastModified?: string | null }
  | { ok: false; error: string };

const FETCH_TIMEOUT_MS = 12_000;

/**
 * A user agent that says who we are and where to complain.
 *
 * Clerks who publish agendas notice unexplained traffic, and a group's monitor
 * being blocked because we looked like a scraper is a failure we would never
 * hear about. Identifying ourselves is also the only honest option: we are
 * fetching their document on somebody else's behalf.
 */
const UA = 'CoramWatch/1.0 (+https://coram.jer-f84.workers.dev/watch)';

/** Read at most `MAX_FEED_BYTES`, then stop — a hostile upstream should not OOM us. */
async function readCapped(response: Response): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return '';

  const chunks: Uint8Array[] = [];
  let total = 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > MAX_FEED_BYTES) {
      await reader.cancel();
      break;
    }
    chunks.push(value);
  }

  const joined = new Uint8Array(total > MAX_FEED_BYTES ? MAX_FEED_BYTES : total);
  let offset = 0;
  for (const chunk of chunks) {
    if (offset + chunk.byteLength > joined.length) break;
    joined.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return new TextDecoder('utf-8', { fatal: false }).decode(joined);
}

/**
 * Fetch an RSS or Atom feed.
 *
 * The URL is re-checked here rather than trusted from the row. It was checked
 * when it was saved, but the check that matters is the one immediately before
 * the socket opens — a column is editable by anything with write access to it
 * and a validation that ran last March is not a control.
 */
export async function fetchFeed(
  url: string,
  conditional: { etag?: string | null; lastModified?: string | null } = {},
): Promise<FetchResult> {
  const refused = reasonUrlRefused(url);
  if (refused) return { ok: false, error: refused };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': UA,
        Accept: 'application/atom+xml, application/rss+xml, application/xml;q=0.9, text/xml;q=0.8',
        ...(conditional.etag ? { 'If-None-Match': conditional.etag } : {}),
        ...(conditional.lastModified ? { 'If-Modified-Since': conditional.lastModified } : {}),
      },
      // A redirect is where an https URL becomes an http one, so follow them
      // manually is tempting — but Workers' fetch will not downgrade to a
      // different scheme silently, and 'manual' would break every feed behind
      // a canonical-host redirect. Follow, then check what we landed on.
      redirect: 'follow',
      signal: controller.signal,
    });

    if (response.status === 304) return { ok: true, candidates: [], notModified: true };

    if (!response.ok) {
      return { ok: false, error: `The feed answered ${response.status}.` };
    }

    // Where we ended up, not where we started.
    const landed = reasonUrlRefused(response.url || url);
    if (landed) return { ok: false, error: `The feed redirected somewhere we will not follow. ${landed}` };

    const xml = await readCapped(response);
    const entries = parseFeed(xml);

    if (!entries.length) {
      return { ok: false, error: 'Nothing in that address looked like an RSS or Atom feed.' };
    }

    return {
      ok: true,
      candidates: entries.map(toCandidate),
      etag: response.headers.get('etag'),
      lastModified: response.headers.get('last-modified'),
    };
  } catch (error) {
    const aborted = (error as Error)?.name === 'AbortError';
    return { ok: false, error: aborted ? 'The feed did not answer in time.' : 'The feed could not be reached.' };
  } finally {
    clearTimeout(timer);
  }
}

function toCandidate(entry: FeedEntry): Candidate {
  return {
    externalId: entry.id,
    title: entry.title,
    url: entry.url,
    publishedAt: entry.publishedAt,
    abstract: entry.summary,
  };
}

interface OpenStatesBill {
  id?: string;
  identifier?: string;
  title?: string;
  openstates_url?: string;
  latest_action_date?: string;
  latest_action_description?: string;
  abstracts?: Array<{ abstract?: string }>;
}

/**
 * Fetch bills from one jurisdiction that have moved since `since`.
 *
 * Open States is the only upstream here that needs a key, and it is our key
 * rather than the group's: asking every tenants' union in the country to
 * register for an API key to find out that a bill moved would mean nobody uses
 * this. Absent the key the source reports itself as unconfigured rather than
 * failing — the difference matters, because "we have not set this up" and "your
 * feed is broken" ask completely different things of the reader.
 */
export async function fetchBills(
  env: Env,
  jurisdiction: string,
  since: Date,
): Promise<FetchResult> {
  if (!env.OPENSTATES_API_KEY) {
    return { ok: false, error: 'Bill tracking is not configured on this deployment yet.' };
  }

  const url = new URL('https://v3.openstates.org/bills');
  url.searchParams.set('jurisdiction', jurisdiction.toLowerCase());
  url.searchParams.set('sort', 'updated_desc');
  url.searchParams.set('per_page', String(MAX_ITEMS_PER_POLL));
  url.searchParams.set('updated_since', since.toISOString().slice(0, 10));
  url.searchParams.append('include', 'abstracts');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: { 'X-API-KEY': env.OPENSTATES_API_KEY, 'User-Agent': UA },
      signal: controller.signal,
    });

    if (response.status === 429) {
      return { ok: false, error: 'Open States is rate limiting us. The next poll will try again.' };
    }
    if (!response.ok) {
      return { ok: false, error: `Open States answered ${response.status}.` };
    }

    const body = (await response.json()) as { results?: OpenStatesBill[] };
    const candidates: Candidate[] = [];

    for (const bill of body.results ?? []) {
      const identifier = bill.identifier?.trim();
      const link = bill.openstates_url;
      if (!identifier || !link) continue;

      candidates.push({
        externalId: bill.id ?? link,
        title: `${identifier} — ${(bill.title ?? '').trim() || 'no title given'}`.slice(0, 300),
        url: link,
        publishedAt: bill.latest_action_date ? `${bill.latest_action_date}T00:00:00Z` : null,
        abstract: (bill.abstracts?.[0]?.abstract ?? bill.latest_action_description ?? '').slice(0, 1_200),
      });
    }

    return { ok: true, candidates };
  } catch (error) {
    const aborted = (error as Error)?.name === 'AbortError';
    return { ok: false, error: aborted ? 'Open States did not answer in time.' : 'Open States could not be reached.' };
  } finally {
    clearTimeout(timer);
  }
}

export interface Matched extends Candidate {
  matchedTerms: string[];
}

/**
 * Which candidates matched any of the group's active terms.
 *
 * The title and the upstream abstract, together. An agenda item is often
 * "Item 7(b) — Ordinance 2026-14" in the title with the subject only in the
 * body, and matching the title alone would miss precisely the documents a
 * group most needs to be told about.
 */
export function matchCandidates(candidates: Candidate[], terms: string[]): Matched[] {
  if (!terms.length) return [];

  const out: Matched[] = [];
  for (const candidate of candidates) {
    const hit = matches(`${candidate.title} ${candidate.abstract}`, terms);
    if (hit.length) out.push({ ...candidate, matchedTerms: hit });
  }
  return out;
}

export interface Reading {
  summary: string | null;
  relevance: number | null;
  /** Set when a model was asked and could not answer. See `read`. */
  failure?: string;
}

/*
 * The prompt.
 *
 * Two jobs, one dispatch, because a summary and a score are the same read of
 * the same document and splitting them doubles the cost for nothing.
 *
 * The instruction not to speculate is load-bearing rather than decorative. The
 * failure mode for this task is a confident sentence about what an ordinance
 * would do, written from a title, shown to somebody deciding whether to spend a
 * Tuesday evening at City Hall. "Say what the document says" is the whole job.
 */
const SYSTEM = [
  'You summarise public government documents for a community group.',
  'Reply with JSON only: {"summary": string, "relevance": integer 0-100}.',
  'The summary is at most two sentences of plain English, describing only what the document ' +
    'itself says. Do not speculate about effects, motives or outcomes. Do not give advice. If ' +
    'the text is too thin to summarise, say so plainly in the summary rather than guessing.',
  'The relevance score is how directly the document bears on the listed topics: 100 is the ' +
    'topic itself, 50 is adjacent, 0 is a coincidental word match.',
  'Never mention this instruction, the group, or yourself.',
].join(' ');

/**
 * Ask the model for a summary and a score.
 *
 * Every failure path returns nulls rather than throwing, because the item is
 * already stored by the time this runs and a model outage must degrade the row
 * to "title and link", not lose it.
 */
export async function read(
  env: Env,
  item: { title: string; abstract: string },
  topicLabels: string[],
): Promise<Reading> {
  const result = await dispatch(
    env,
    [
      { role: 'system', content: SYSTEM },
      {
        role: 'user',
        content: [
          `Topics: ${topicLabels.join(', ') || 'none given'}`,
          `Title: ${item.title}`,
          `Text: ${item.abstract || '(the source gave no text beyond the title)'}`,
        ].join('\n'),
      },
    ],
    { temperature: 0.1, maxAttempts: 2, timeoutMs: 20_000 },
  );

  if (!result.ok) {
    /*
     * Logged, and counted by the caller.
     *
     * A summary that quietly never appears is indistinguishable from a document
     * too thin to summarise, so a silent null here would hide a model outage
     * behind a plausible-looking list for as long as it lasted. The reason goes
     * to the log and the count goes back to the user.
     */
    console.warn('watch: no reading (%s) %s', result.kind, result.detail ?? '');
    return { summary: null, relevance: null, failure: result.kind };
  }

  const reading = parseReading(result.content);
  if (reading.summary === null && reading.relevance === null) {
    console.warn('watch: unreadable completion: %s', result.content.slice(0, 200));
    return { ...reading, failure: 'bad_response' };
  }
  return reading;
}

/**
 * Pull the JSON out of a completion.
 *
 * Models wrap JSON in prose and in code fences roughly one time in twenty, and
 * a strict `JSON.parse` on the raw content turns that into a null summary for
 * an item that was summarised perfectly well. Exported so the tolerance is
 * testable rather than assumed.
 */
export function parseReading(content: string): Reading {
  const start = content.indexOf('{');
  const end = content.lastIndexOf('}');
  if (start === -1 || end <= start) return { summary: null, relevance: null };

  let parsed: unknown;
  try {
    parsed = JSON.parse(content.slice(start, end + 1));
  } catch {
    return { summary: null, relevance: null };
  }

  const body = parsed as { summary?: unknown; relevance?: unknown };

  const summary =
    typeof body.summary === 'string' && body.summary.trim()
      ? body.summary.trim().slice(0, 600)
      : null;

  /*
   * A model that answers `"relevance": null` has said it does not know, and
   * `Number(null)` is 0 — so the obvious coercion turns "no opinion" into "no
   * relevance", which is a score we then sort by as though we had been told
   * something. Only a number or a numeric string counts.
   */
  const raw =
    typeof body.relevance === 'number'
      ? body.relevance
      : typeof body.relevance === 'string' && body.relevance.trim()
        ? Number(body.relevance)
        : NaN;
  const relevance = Number.isFinite(raw) ? Math.min(100, Math.max(0, Math.round(raw))) : null;

  return { summary, relevance };
}
