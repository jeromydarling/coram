/**
 * The watch list's rules, in one file that both sides import.
 *
 * ---------------------------------------------------------------------------
 * The rule this module is built around
 * ---------------------------------------------------------------------------
 *
 * A term match decides whether an item exists. A model's score decides only
 * where it sits in the list.
 *
 * That is not a performance decision, it is the difference between a tool and a
 * liability. A group that adds "eviction" and is shown nine hearings has been
 * told the truth. A group that adds "eviction" and is shown the six a model
 * thought were interesting has been told a lie of omission — they believe they
 * are covered, they are not, and nothing on the screen suggests otherwise. The
 * hearing that gets dropped will be the one with the boring title, which is
 * most of the ones that matter.
 *
 * So `matches()` below is plain string work with no model in it, every row it
 * returns is shown, and `relevance` is a sort key that is allowed to be null.
 */

export const SOURCE_KINDS = ['bills', 'feed'] as const;
export type SourceKind = (typeof SOURCE_KINDS)[number];

export const ITEM_STATES = ['new', 'kept', 'dismissed'] as const;
export type ItemState = (typeof ITEM_STATES)[number];

/**
 * Ceilings, so one workspace cannot turn the shared poller into its own
 * crawler. Twelve sources at six polls a day is seventy-two fetches, which is
 * a rounding error; a hundred sources is a product with a different risk.
 */
export const MAX_TOPICS = 12;
export const MAX_TERMS_PER_TOPIC = 24;
export const MAX_SOURCES = 12;

/** Matches the retention rule in schema/watch.ts. Shown to the user. */
export const ITEM_RETENTION_DAYS = 90;

/** Per fetch. A feed larger than this is a data dump, not an agenda. */
export const MAX_FEED_BYTES = 2_000_000;
/** Per poll, per source. Keeps one noisy upstream from filling the list. */
export const MAX_ITEMS_PER_POLL = 40;

/**
 * A term short enough to appear inside ordinary words is a term that matches
 * everything. "ADU" is three characters and legitimate, so the floor is three
 * rather than four, and `matches` requires a word boundary besides.
 */
export const MIN_TERM_LENGTH = 3;

export interface Topic {
  id: string;
  label: string;
  terms: string[];
  active: boolean;
}

export interface WatchSource {
  id: string;
  kind: SourceKind;
  label: string;
  jurisdiction: string | null;
  url: string | null;
  active: boolean;
  lastPolledAt: string | null;
  lastStatus: 'ok' | 'failed' | null;
  lastError: string | null;
  lastFound: number;
}

export interface WatchItem {
  id: string;
  sourceId: string;
  sourceLabel: string;
  title: string;
  url: string;
  publishedAt: string | null;
  summary: string | null;
  relevance: number | null;
  matchedTerms: string[];
  state: ItemState;
  convertedKind: 'event' | 'bill' | null;
  convertedId: string | null;
  firstSeenAt: string;
}

/** Lowercase, collapse whitespace, drop anything too short to be a term. */
export function normaliseTerms(raw: string[]): string[] {
  const seen = new Set<string>();
  for (const term of raw) {
    const clean = term.toLowerCase().replace(/\s+/g, ' ').trim();
    if (clean.length >= MIN_TERM_LENGTH) seen.add(clean);
  }
  return [...seen].slice(0, MAX_TERMS_PER_TOPIC);
}

/**
 * Which of a group's terms appear in a document.
 *
 * Word boundaries rather than `includes`, because "rent" inside "current" and
 * "ada" inside "Nevada" are the two failures that make a monitor useless in
 * opposite directions — one floods the list, and the flood is what makes people
 * stop reading it.
 *
 * A term containing a space is matched as a phrase with boundaries at each end,
 * so "rent board" does not match "rent boarding house" and does match "Rent
 * Board" and "rent  board" across a line break.
 */
export function matches(text: string, terms: string[]): string[] {
  const hay = text.toLowerCase().replace(/\s+/g, ' ');
  const hit: string[] = [];

  for (const term of terms) {
    // Escape before building the pattern: a group is allowed to watch for
    // "C.S.H.B. 1" and a bill number contains characters a regex cares about.
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // \b fails at the edge of a non-word character — "SB-442" ends in a digit
    // so \b is right there, but a term ending in "." would never match. Use an
    // explicit lookaround on word characters instead.
    if (new RegExp(`(^|[^a-z0-9])${escaped}($|[^a-z0-9])`, 'i').test(hay)) {
      hit.push(term);
    }
  }

  return hit;
}

/**
 * Whether a URL may be fetched by the Worker on a group's behalf.
 *
 * This is a URL an authenticated user types into a text box, and the Worker
 * fetches it with the Worker's own network position. The guard is deliberately
 * a small allow-list of shapes rather than a deny-list of hosts: https, default
 * port, a hostname with a dot in it, and nothing that looks like an address
 * literal. Everything else is refused with a reason the user can act on.
 *
 * Returning a string rather than throwing because the caller shows it to the
 * person who typed the URL, and "we only fetch https" is a better answer than
 * a 400.
 */
export function reasonUrlRefused(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return 'That does not look like a web address.';
  }

  if (url.protocol !== 'https:') {
    return 'Feeds must be https. We will not fetch over plain http, because anyone on the path could change what we read.';
  }
  if (url.port && url.port !== '443') {
    return 'Feeds must be on the standard https port.';
  }
  if (url.username || url.password) {
    return 'Credentials in the address are not supported. A feed we need a password for is a feed we should not be holding the password to.';
  }

  const host = url.hostname.toLowerCase();

  // Address literals, in either family. A hostname is required so that what we
  // fetch is something published under a name somebody can be accountable for.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.startsWith('[') || host.includes(':')) {
    return 'Give the address of a published feed rather than an IP address.';
  }
  if (!host.includes('.') || host.endsWith('.local') || host.endsWith('.internal')) {
    return 'That address is not reachable from the public internet.';
  }
  if (host === 'localhost' || host.endsWith('.localhost')) {
    return 'That address is not reachable from the public internet.';
  }

  return null;
}
