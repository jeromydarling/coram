/**
 * Reading an RSS or Atom feed, without a dependency and without a DOM.
 *
 * ---------------------------------------------------------------------------
 * Why a hand parser
 * ---------------------------------------------------------------------------
 *
 * A Worker has no DOMParser and the XML libraries that run in one are all
 * larger than this file by an order of magnitude. What we need from a feed is
 * four fields per entry — title, link, date, summary — and everything else in
 * the format is noise we would discard. A regex-driven reader is the wrong tool
 * for XML in general and the right one for this: we are not validating a
 * document, we are extracting four strings from a text file we already refuse
 * to trust.
 *
 * The parser therefore assumes nothing. Entities are decoded, CDATA is
 * unwrapped, markup inside a summary is stripped rather than rendered, and
 * every field is length-capped before it leaves this file. What comes back is
 * plain text destined for a text column and a React text node — never markup,
 * never a URL we have not checked the scheme of.
 *
 * ---------------------------------------------------------------------------
 * What is deliberately not extracted
 * ---------------------------------------------------------------------------
 *
 * Author names. Council agendas and court calendars routinely carry a clerk's
 * name in <author> or <dc:creator>, and a local paper's feed carries a
 * reporter's. Neither is any use to a group deciding whether to turn up, and
 * ingesting them would put named third parties into a table whose whole
 * argument is that it contains no people. The tag is skipped, not blanked.
 */

import { MAX_ITEMS_PER_POLL } from '../../shared/watch';

export interface FeedEntry {
  /** The upstream's own id, for dedupe. GUID, Atom id, or the link. */
  id: string;
  title: string;
  url: string;
  /** ISO 8601, or null when the feed gave us something unparseable. */
  publishedAt: string | null;
  /** Plain text, markup stripped, capped. May be empty. */
  summary: string;
}

const MAX_TITLE = 300;
const MAX_SUMMARY = 1_200;

/** The five XML predefined entities, plus the numeric forms feeds actually use. */
function decode(text: string): string {
  return text
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => safeChar(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => safeChar(parseInt(dec, 10)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    // Ampersand last, so "&amp;lt;" decodes to "&lt;" and not to "<".
    .replace(/&amp;/g, '&');
}

function safeChar(code: number): string {
  // Lone surrogates and out-of-range values throw in fromCodePoint, and a feed
  // with a broken entity should lose one character rather than the whole poll.
  if (!Number.isFinite(code) || code < 0x20 || code > 0x10ffff) return ' ';
  if (code >= 0xd800 && code <= 0xdfff) return ' ';
  return String.fromCodePoint(code);
}

/** Markup out, whitespace collapsed. Summaries are frequently HTML. */
function plain(text: string, max: number): string {
  const stripped = decode(text)
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return stripped.length > max ? `${stripped.slice(0, max - 1).trimEnd()}…` : stripped;
}

function tag(block: string, ...names: string[]): string | null {
  for (const name of names) {
    const m = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i').exec(block);
    if (m) return m[1];
  }
  return null;
}

/**
 * Atom puts the link in an attribute, and puts several of them there. Prefer
 * rel="alternate" (or no rel, which means alternate) over rel="self", which
 * points at the feed rather than the document.
 */
function atomLink(block: string): string | null {
  const links = [...block.matchAll(/<link\b([^>]*)\/?>/gi)].map((m) => m[1]);
  const pick =
    links.find((a) => /rel\s*=\s*["']alternate["']/i.test(a)) ??
    links.find((a) => !/rel\s*=\s*["']/i.test(a)) ??
    null;
  if (!pick) return null;
  return /href\s*=\s*["']([^"']+)["']/i.exec(pick)?.[1] ?? null;
}

function when(raw: string | null): string | null {
  if (!raw) return null;
  const parsed = Date.parse(decode(raw).trim());
  if (Number.isNaN(parsed)) return null;
  // A feed that claims a document was published in 2087 is a feed with a broken
  // clock, and it would sit at the top of a date-sorted list forever.
  const at = new Date(parsed);
  const ahead = at.getTime() - Date.now();
  if (ahead > 400 * 24 * 60 * 60 * 1000) return null;
  return at.toISOString();
}

/**
 * Parse an RSS 2.0 or Atom feed into entries.
 *
 * Never throws. A feed we cannot read returns an empty array and the caller
 * records the poll as having found nothing, which is the honest outcome — the
 * alternative is a failed source the user is told to fix when the fault is that
 * a clerk published malformed XML.
 */
export function parseFeed(xml: string): FeedEntry[] {
  const blocks = [
    ...xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi),
    ...xml.matchAll(/<entry(?:\s[^>]*)?>([\s\S]*?)<\/entry>/gi),
  ].map((m) => m[1]);

  const entries: FeedEntry[] = [];

  for (const block of blocks) {
    if (entries.length >= MAX_ITEMS_PER_POLL) break;

    const title = plain(tag(block, 'title') ?? '', MAX_TITLE);
    const rawLink = tag(block, 'link') ?? atomLink(block) ?? tag(block, 'guid');
    const url = rawLink ? decode(rawLink).trim() : '';

    // A document with no title or no address is not something we can show
    // somebody, and a row of "Untitled — #" is worse than an absence.
    if (!title || !/^https?:\/\//i.test(url)) continue;

    const summary = plain(
      tag(block, 'description', 'summary', 'content:encoded', 'content') ?? '',
      MAX_SUMMARY,
    );

    entries.push({
      id: (tag(block, 'guid', 'id') ? decode(tag(block, 'guid', 'id')!).trim() : url).slice(0, 400),
      title,
      url,
      publishedAt: when(tag(block, 'pubDate', 'published', 'updated', 'dc:date')),
      summary,
    });
  }

  return entries;
}
