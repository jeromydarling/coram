/**
 * localPulseUtils — Shared utilities for Local Pulse signal density & reliability.
 *
 * WHAT: Domain filtering, safe Perplexity parsing, enhanced dedupe, query lane builders.
 * WHERE: Used by local-pulse-worker edge function.
 * WHY: Higher recall, stronger precision, resilient parsing — without increasing Firecrawl cost.
 */

// ── Domain allow/deny heuristics ──

const LIKELY_USEFUL_DOMAINS = new Set([
  "eventbrite.com", "mobilize.us", "galaxydigital.com", "volunteermatch.org",
  "idealist.org", "meetup.com", "facebook.com", "allevents.in",
  "patch.com", "nextdoor.com", "unitedway.org", "211.org",
  "feedingamerica.org", "salvationarmy.org", "ymca.org", "ywca.org",
  "habitat.org",
]);

const LIKELY_JUNK_DOMAINS = new Set([
  "pinterest.com", "amazon.com", "ebay.com", "etsy.com",
  "groupon.com", "couponfollow.com", "retailmenot.com",
  "yelp.com", "tripadvisor.com", "booking.com",
  "fiverr.com", "upwork.com",
]);

const JUNK_PATTERNS = [
  /coupon/i, /deal/i, /promo/i, /discount/i, /\bseo\b/i,
  /affiliate/i, /clickbank/i,
];

export function isLikelyUsefulDomain(url: string): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url.startsWith("http") ? url : `https://${url}`);
    const host = parsed.hostname.replace(/^www\./, "").toLowerCase();

    // Explicit deny
    if (LIKELY_JUNK_DOMAINS.has(host)) return false;
    for (const p of JUNK_PATTERNS) {
      if (p.test(host)) return false;
    }

    // Explicit allow
    if (LIKELY_USEFUL_DOMAINS.has(host)) return true;

    // Heuristic: .gov, .edu, .org are usually useful
    if (host.endsWith(".gov") || host.endsWith(".edu") || host.endsWith(".org")) return true;

    // Heuristic: local/regional news patterns
    if (/\.(us|city|county|state)\./i.test(host)) return true;

    // Default: allow (we don't want to over-filter)
    return true;
  } catch {
    return true; // If we can't parse, allow it
  }
}

// ── Safe Perplexity JSON parsing ──

export type ParseMode = "direct" | "object_extract" | "array_extract" | "citations_fallback" | "failed";

export interface SafeParseResult {
  results: Array<{ url: string; title: string; description: string; date?: string | null }>;
  parse_mode: ParseMode;
}

export function safeParsePerplexityResults(
  content: string,
  citations: string[] = [],
): SafeParseResult {
  if (!content || typeof content !== "string") {
    return citationsFallback(citations);
  }

  // Strategy 1: Direct parse
  try {
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed)) {
      return { results: normalizeResults(parsed), parse_mode: "direct" };
    }
    if (parsed && typeof parsed === "object" && Array.isArray(parsed.results || parsed.events || parsed.items)) {
      return { results: normalizeResults(parsed.results || parsed.events || parsed.items), parse_mode: "direct" };
    }
  } catch { /* continue */ }

  // Strategy 2: Extract first [...] block
  const arrayMatch = content.match(/\[[\s\S]*?\]/);
  if (arrayMatch) {
    try {
      const parsed = JSON.parse(arrayMatch[0]);
      if (Array.isArray(parsed)) {
        return { results: normalizeResults(parsed), parse_mode: "array_extract" };
      }
    } catch { /* continue */ }
  }

  // Strategy 3: Extract first {...} block (object with nested array)
  const objMatch = content.match(/\{[\s\S]*\}/);
  if (objMatch) {
    try {
      const parsed = JSON.parse(objMatch[0]);
      if (parsed && typeof parsed === "object") {
        const arr = parsed.results || parsed.events || parsed.items;
        if (Array.isArray(arr)) {
          return { results: normalizeResults(arr), parse_mode: "object_extract" };
        }
      }
    } catch { /* continue */ }
  }

  // Strategy 4: Citations fallback
  return citationsFallback(citations);
}

function citationsFallback(citations: string[]): SafeParseResult {
  if (!citations || citations.length === 0) {
    return { results: [], parse_mode: "failed" };
  }
  return {
    results: citations.map((url) => ({
      url,
      title: "Source",
      description: "",
    })),
    parse_mode: "citations_fallback",
  };
}

function normalizeResults(
  items: unknown[],
): Array<{ url: string; title: string; description: string; date?: string | null }> {
  return items
    .filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
    .map((item) => ({
      url: String(item.url || item.link || ""),
      title: String(item.title || item.name || ""),
      description: String(item.description || item.snippet || item.summary || ""),
      date: item.date ? String(item.date) : null,
    }))
    .filter((item) => item.url || item.title);
}

// ── Enhanced dedupe key generation ──

export function generateDedupeKey(
  url: string | null,
  title: string | null,
  snippet: string | null,
): string {
  // Prefer URL-based dedupe
  if (url) {
    return `url:${normalizeUrlForDedupe(url)}`;
  }

  // Title-based dedupe
  if (title) {
    const normTitle = title.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
    return `title:${normTitle}`;
  }

  // Snippet hash fallback
  if (snippet) {
    const normSnippet = snippet.slice(0, 120).toLowerCase().replace(/\s+/g, " ").trim();
    return `snippet:${simpleHash(normSnippet)}`;
  }

  return `rand:${crypto.randomUUID().slice(0, 8)}`;
}

function normalizeUrlForDedupe(raw: string): string {
  try {
    const url = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
    url.hash = "";
    // Strip tracking params
    const tracking = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "gclid", "fbclid"];
    for (const p of tracking) url.searchParams.delete(p);
    let path = url.pathname;
    if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
    return `${url.hostname.replace(/^www\./, "")}${path}${url.search}`.toLowerCase();
  } catch {
    return raw.toLowerCase();
  }
}

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

// ── Query lane builders ──

/** Service / Care lane queries */
const SERVICE_KEYWORDS = [
  "free clinic", "food pantry", "shelter", "reentry program",
  "addiction recovery", "eviction prevention", "mutual aid",
  "housing assistance", "community resource center",
];

/** Volunteer / Community Events lane queries */
const VOLUNTEER_KEYWORDS = [
  "volunteer opportunity", "service day", "community cleanup",
  "donation drive", "fundraiser", "community event",
];

export function buildServiceCareQueries(
  location: string,
  tenantKeywords: string[] = [],
  recencyFilter: "week" | "month" = "month",
): { queries: string[]; recencyFilter: "week" | "month" } {
  // Pick 2 keywords, incorporating tenant enrichment if available
  const pool = tenantKeywords.length > 0
    ? [...tenantKeywords.slice(0, 3), ...SERVICE_KEYWORDS.slice(0, 3)]
    : SERVICE_KEYWORDS;

  const selected = pool.slice(0, 2);
  return {
    queries: selected.map((kw) => `${kw} ${location}`),
    recencyFilter,
  };
}

export function buildVolunteerQueries(
  location: string,
  tenantKeywords: string[] = [],
  recencyFilter: "week" | "month" = "month",
): { queries: string[]; recencyFilter: "week" | "month" } {
  const pool = tenantKeywords.length > 0
    ? [...tenantKeywords.slice(0, 2), ...VOLUNTEER_KEYWORDS.slice(0, 3)]
    : VOLUNTEER_KEYWORDS;

  const selected = pool.slice(0, 2);
  return {
    queries: selected.map((kw) => `${kw} ${location}`),
    recencyFilter,
  };
}

/** Long-tail refresh query (stable services, annual) */
export function buildLongTailQuery(location: string): string {
  return `ongoing community services food pantry shelter clinic ${location}`;
}

/** Determine if long-tail refresh is due for a metro */
export function isLongTailRefreshDue(lastLongTailAt: string | null): boolean {
  if (!lastLongTailAt) return true;
  const ageMs = Date.now() - new Date(lastLongTailAt).getTime();
  const thirtyDays = 30 * 24 * 60 * 60 * 1000;
  return ageMs >= thirtyDays;
}
