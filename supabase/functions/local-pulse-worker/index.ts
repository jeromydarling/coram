/**
 * local-pulse-worker — Event discovery via Perplexity search + Firecrawl scraping.
 *
 * WHAT: Discovers local events using Perplexity for search discovery and Firecrawl for HTML/RSS scraping.
 * WHERE: Called manually or via scheduled automation for metro event discovery.
 * WHY: Seeds the Local Pulse event feed with community events.
 *
 * ENGINE SPLIT:
 * - Stream 1 (Auto-discovery): Perplexity sonar — web search for event URLs.
 *   Perplexity handles discovery queries (cheaper, no credit burn on Firecrawl).
 * - Stream 2 (User sources): Firecrawl — raw HTML/RSS scraping of user-added URLs.
 *   Firecrawl is required for DOM parsing, RSS feed extraction, calendar grid crawling.
 *
 * CACHING & FREQUENCY GOVERNANCE:
 * - Metro-level cooldown: Skips auto-discovery if a successful run completed within threshold.
 * - Source-level caching: Skips re-scrape if source was checked recently and had status 'ok'.
 * - Frequency adapts to metro activity: active metros (many sources) crawl more often.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { FirecrawlCreditTracker, recordWorkflowUsage } from "../_shared/intelligenceGovernance.ts";
import {
  isLikelyUsefulDomain,
  safeParsePerplexityResults,
  generateDedupeKey,
  buildServiceCareQueries,
  buildVolunteerQueries,
  buildLongTailQuery,
  isLongTailRefreshDue,
  type ParseMode,
} from "../_shared/localPulseUtils.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-key",
};

function jsonOk(data: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function jsonError(status: number, code: string, message: string) {
  return new Response(
    JSON.stringify({ ok: false, error: code, message }),
    { status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}

function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}

function authenticateRequest(req: Request): { ok: boolean; isService: boolean; token: string } {
  const enrichmentSecret = Deno.env.get("ENRICHMENT_WORKER_SECRET");
  const sharedSecret = Deno.env.get("N8N_SHARED_SECRET");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const authHeader = req.headers.get("authorization") ?? "";
  const apiKeyHeader = req.headers.get("x-api-key") ?? "";

  if (authHeader.startsWith("Bearer ") && serviceRoleKey) {
    if (authHeader.slice(7).trim() === serviceRoleKey) return { ok: true, isService: true, token: "" };
  }

  let token = "";
  if (apiKeyHeader) token = apiKeyHeader.trim();
  else if (authHeader.startsWith("Bearer ")) token = authHeader.slice(7).trim();
  if (!token) return { ok: false, isService: false, token: "" };

  const isServerSecret =
    (enrichmentSecret ? constantTimeCompare(token, enrichmentSecret) : false) ||
    (sharedSecret ? constantTimeCompare(token, sharedSecret) : false);
  if (isServerSecret) return { ok: true, isService: true, token: "" };

  return { ok: true, isService: false, token };
}

// ── Safety caps ──
const MAX_EVENTS_PER_RUN = 80;
const MAX_SCRAPED_PAGES_PER_SOURCE = 5;

// ── Frequency governance thresholds (hours) ──
const DISCOVERY_COOLDOWN_HOURS = 48; // Skip auto-discovery if last successful run < 48h ago
const SOURCE_CACHE_HOURS = 24;       // Skip re-scrape of ok sources checked within 24h
const ACTIVE_METRO_SOURCE_THRESHOLD = 5; // Metros with ≥5 sources get shorter cooldowns

// ── Date parsing — restrict to last 30 days through 1 year ahead ──
const DATE_MIN_DAYS_BACK = 30;
const DATE_MAX_DAYS_FORWARD = 365;

export function parseDate(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const d = new Date(raw);
    if (isNaN(d.getTime())) return null;
    const now = Date.now();
    if (d.getTime() < now - DATE_MIN_DAYS_BACK * 86400000) return null;
    if (d.getTime() > now + DATE_MAX_DAYS_FORWARD * 86400000) return null;
    return d.toISOString().slice(0, 10);
  } catch {
    return null;
  }
}

// Detect recurring event language
const RECURRING_PATTERNS = /\b(weekly|every\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)|bi-?weekly|monthly|every\s+month|recurring|ongoing)\b/i;

export function detectRecurring(text: string): boolean {
  return RECURRING_PATTERNS.test(text);
}

// Fingerprint for dedup
export function eventFingerprint(title: string, date: string): string {
  const norm = title.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 60);
  return `${norm}:${date}`;
}

// Dynamic auto-discovery queries based on metro region
export function buildSearchQueries(metroName: string, state: string | null): string[] {
  const location = state ? `${metroName} ${state}` : metroName;
  const queries = [
    `community events ${location} 2026`,
    `nonprofit events ${location}`,
    `library events ${location}`,
  ];

  // Adaptive layer based on region
  const regionLower = (state ?? "").toLowerCase();
  if (["mn", "wi", "ia", "il", "mi", "oh", "in", "nd", "sd", "ne", "ks", "mo"].includes(regionLower)) {
    queries.push(`digital inclusion events ${location}`);
    queries.push(`workforce development events ${location}`);
  } else {
    queries.push(`resource fair ${location}`);
    queries.push(`digital equity events ${location}`);
  }

  // Cap at 6 queries
  return queries.slice(0, 6);
}

// Module-level credit tracker — reset per invocation in handler
let _lpTracker: FirecrawlCreditTracker;

// ── Perplexity-powered event discovery (replaces Firecrawl Search) ──
// Uses sonar model for fast, cheap web search. Returns URLs + snippets.
// Now with safe JSON parsing, domain filtering, and citation fallback.
async function perplexityEventSearch(
  apiKey: string,
  query: string,
  recencyFilter: "week" | "month" | "year" = "month",
): Promise<{
  results: Array<{ url: string; title: string; description: string }>;
  parseMode: ParseMode;
}> {
  try {
    const resp = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "sonar",
        messages: [
          {
            role: "system",
            content: "You are a local event discovery assistant. Return ONLY a JSON array of events you find. Each object must have: title, url, description (1-2 sentences), date (YYYY-MM-DD if found, null otherwise). Return at most 10 results. No commentary, just the JSON array.",
          },
          { role: "user", content: query },
        ],
        temperature: 0.1,
        search_recency_filter: recencyFilter,
      }),
      signal: AbortSignal.timeout(20000),
    });

    if (!resp.ok) {
      console.error(`Perplexity search error: ${resp.status}`);
      return { results: [], parseMode: "failed" };
    }

    const data = await resp.json();
    const content = data.choices?.[0]?.message?.content ?? "";
    const citations: string[] = data.citations ?? [];

    // Use safe parser with fallback chain
    const parsed = safeParsePerplexityResults(content, citations);

    if (parsed.parse_mode !== "direct") {
      console.warn(`[local-pulse] Perplexity parse fallback: ${parsed.parse_mode} for query: ${query}`);
    }

    // Domain filtering
    const filtered = parsed.results.filter((r) => isLikelyUsefulDomain(r.url));
    const rejected = parsed.results.length - filtered.length;
    if (rejected > 0) {
      console.log(`[local-pulse] Domain filter rejected ${rejected} results`);
    }

    return {
      results: filtered.map((r) => ({
        url: r.url,
        title: r.title,
        description: r.description,
      })),
      parseMode: parsed.parse_mode,
    };
  } catch (e) {
    console.error("Perplexity search failed:", e);
    return { results: [], parseMode: "failed" };
  }
}

// Scrape a single URL via Firecrawl — returns { rawHtml, markdown }
interface ScrapeResult { rawHtml: string; markdown: string }

async function firecrawlScrape(apiKey: string, url: string, opts?: { onlyMainContent?: boolean; waitFor?: number }): Promise<ScrapeResult> {
  const onlyMain = opts?.onlyMainContent ?? true;
  const wait = opts?.waitFor ?? 8000;
  try {
    const resp = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url,
        formats: ["markdown", "rawHtml"],
        onlyMainContent: onlyMain,
        waitFor: wait,
        timeout: 30000,
      }),
      signal: AbortSignal.timeout(40000),
    });
    if (!resp.ok) return { rawHtml: "", markdown: "" };
    const data = await resp.json();
    _lpTracker.track(data); // scrape = 1 credit
    return {
      rawHtml: (data.data?.rawHtml ?? "") as string,
      markdown: (data.data?.markdown ?? data.markdown ?? "") as string,
    };
  } catch {
    return { rawHtml: "", markdown: "" };
  }
}

// Scrape with automatic retry: if first pass yields thin content, retry with full page
async function firecrawlScrapeWithRetry(apiKey: string, url: string): Promise<ScrapeResult> {
  const result = await firecrawlScrape(apiKey, url);
  // If markdown is very short (< 500 chars), JS may not have rendered — retry with full page + longer wait
  if (result.markdown.length < 500) {
    console.log(`[local-pulse] Thin content (${result.markdown.length} chars) for ${url}, retrying with full page`);
    return firecrawlScrape(apiKey, url, { onlyMainContent: false, waitFor: 10000 });
  }
  return result;
}

// ── RSS/Atom XML parsing ──
interface RssItem {
  title: string;
  link: string | null;
  description: string | null;
  pubDate: string | null;
  eventDate: string | null; // from bc:start_date, ev:startdate, etc.
}

function extractTag(xml: string, tag: string): string | null {
  // Handles both <tag>...</tag> and <tag><![CDATA[...]]></tag>
  // Also handles namespaced tags like bc:start_date
  const escapedTag = tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`<${escapedTag}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?</${escapedTag}>`, "i");
  const m = xml.match(re);
  return m ? m[1].trim() : null;
}

function isRssFeed(content: string): boolean {
  const head = content.slice(0, 500).toLowerCase();
  return head.includes("<rss") || head.includes("<feed") || head.includes("<channel>");
}

// Extract event start date from common calendar-aware RSS extensions
function extractEventDate(block: string): string | null {
  // BiblioCommons: <bc:start_date>, <bc:start_date_local>
  const bcDate = extractTag(block, "bc:start_date_local") ?? extractTag(block, "bc:start_date");
  if (bcDate) return bcDate;

  // Eventbrite / generic: <ev:startdate>
  const evDate = extractTag(block, "ev:startdate");
  if (evDate) return evDate;

  // Google Calendar: <gd:when> with startTime attribute
  const gdMatch = block.match(/<gd:when[^>]+startTime="([^"]+)"/i);
  if (gdMatch) return gdMatch[1];

  // xCal: <xcal:dtstart>
  const xcal = extractTag(block, "xcal:dtstart");
  if (xcal) return xcal;

  return null;
}

function parseRssItems(xml: string): RssItem[] {
  const items: RssItem[] = [];

  // RSS 2.0: <item>...</item>
  const rssItemRegex = /<item[\s>]([\s\S]*?)<\/item>/gi;
  let match: RegExpExecArray | null;
  while ((match = rssItemRegex.exec(xml)) !== null) {
    const block = match[1];
    items.push({
      title: extractTag(block, "title") ?? "",
      link: extractTag(block, "link"),
      description: extractTag(block, "description") ?? extractTag(block, "summary"),
      pubDate: extractTag(block, "pubDate") ?? extractTag(block, "dc:date") ?? extractTag(block, "published"),
      eventDate: extractEventDate(block),
    });
  }

  // Atom: <entry>...</entry> (if no RSS items found)
  if (items.length === 0) {
    const atomRegex = /<entry[\s>]([\s\S]*?)<\/entry>/gi;
    while ((match = atomRegex.exec(xml)) !== null) {
      const block = match[1];
      // Atom <link> is self-closing: <link href="..." />
      const linkMatch = block.match(/<link[^>]+href="([^"]+)"/i);
      items.push({
        title: extractTag(block, "title") ?? "",
        link: linkMatch ? linkMatch[1] : null,
        description: extractTag(block, "summary") ?? extractTag(block, "content"),
        pubDate: extractTag(block, "published") ?? extractTag(block, "updated"),
        eventDate: extractEventDate(block),
      });
    }
  }

  return items;
}

// Simple title-based event candidate extraction (no AI — fast discovery only)
interface RawCandidate {
  title: string;
  start_date: string | null;
  location: string | null;
  source_url: string | null;
  description: string | null;
  host_organization: string | null;
  is_recurring: boolean;
  _html_source?: boolean;
  _calendar_detail?: boolean;
}

// ── Calendar grid detection + detail URL extraction ──
const CALENDAR_DETAIL_PATTERNS = [
  /https?:\/\/[^\s)]+\/events?\/(details?|view)\b[^\s)]*/gi,
  /https?:\/\/[^\s)]+\/event-calendar\/Details\/[^\s)]*/gi,
  /https?:\/\/[^\s)]+\/External\/WCPages\/WCEvents\/EventDetail\.aspx[^\s)]*/gi,
  /https?:\/\/[^\s)]+\/calendar\/event\/[^\s)]*/gi,
  /https?:\/\/[^\s)]+\/event\/detail\/\?event_id=\d+[^\s)]*/gi,
  /https?:\/\/[^\s)]+\.galaxydigital\.com\/event\/detail\/[^\s)]*/gi,
];

const MAX_CALENDAR_DETAIL_PAGES = 15;

function isCalendarGridPage(markdown: string): boolean {
  const indicators = [
    /\b(Sun|Mon|Tue|Wed|Thu|Fri|Sat)\b.*\b(Sun|Mon|Tue|Wed|Thu|Fri|Sat)\b/i,
    /Powered By GrowthZone/i,
    /event-calendar\/Details\//i,
    /EventDetail\.aspx/i,
    /galaxydigital\.com/i,
    /event\/detail\/\?event_id=/i,
  ];
  const matched = indicators.filter(p => p.test(markdown)).length;
  let detailLinkCount = 0;
  for (const pattern of CALENDAR_DETAIL_PATTERNS) {
    const matches = markdown.match(new RegExp(pattern.source, pattern.flags));
    detailLinkCount += matches?.length ?? 0;
  }
  return matched >= 1 && detailLinkCount >= 3;
}

function extractCalendarDetailUrls(markdown: string): string[] {
  const urls = new Set<string>();
  for (const pattern of CALENDAR_DETAIL_PATTERNS) {
    const matches = markdown.matchAll(new RegExp(pattern.source, pattern.flags));
    for (const m of matches) {
      const cleaned = m[0].replace(/[)\]>]+$/, "");
      try {
        new URL(cleaned); // validate
        urls.add(cleaned);
      } catch { /* skip invalid */ }
    }
  }
  return [...urls];
}

function extractCandidatesFromSearchResults(
  results: Array<{ url: string; title: string; description: string }>,
): RawCandidate[] {
  const candidates: RawCandidate[] = [];
  for (const r of results) {
    if (!r.title || r.title.length < 3) continue;
    const text = `${r.title} ${r.description}`;
    const isRecurring = detectRecurring(text);

    // Try to extract a date from the description
    const dateMatch = text.match(/\b(20\d{2}[-/]\d{1,2}[-/]\d{1,2})\b/);
    const parsedDate = dateMatch ? parseDate(dateMatch[1].replace(/\//g, "-")) : null;

    candidates.push({
      title: r.title.slice(0, 255),
      start_date: parsedDate,
      location: null,
      source_url: r.url,
      description: r.description?.slice(0, 500) || null,
      host_organization: null,
      is_recurring: isRecurring,
    });
  }
  return candidates;
}

// ── Frequency governance helpers ──

/** Check if auto-discovery should be skipped based on last successful run age. */
async function shouldSkipDiscovery(
  supabase: ReturnType<typeof createClient>,
  metroId: string,
  sourceCount: number,
): Promise<{ skip: boolean; lastRunAge: number | null }> {
  const { data: lastRun } = await supabase
    .from("local_pulse_runs")
    .select("completed_at, status")
    .eq("metro_id", metroId)
    .eq("status", "completed")
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!lastRun?.completed_at) return { skip: false, lastRunAge: null };

  const ageMs = Date.now() - new Date(lastRun.completed_at).getTime();
  const ageHours = ageMs / (1000 * 60 * 60);

  // Active metros (many sources) get a shorter cooldown (24h vs 48h)
  const cooldown = sourceCount >= ACTIVE_METRO_SOURCE_THRESHOLD
    ? DISCOVERY_COOLDOWN_HOURS / 2
    : DISCOVERY_COOLDOWN_HOURS;

  return { skip: ageHours < cooldown, lastRunAge: Math.round(ageHours) };
}

/** Check if a source should be skipped based on its last check. */
function shouldSkipSource(source: Record<string, unknown>): boolean {
  const lastChecked = source.last_checked_at as string | null;
  const lastStatus = source.last_status as string | null;
  if (!lastChecked || lastStatus !== "ok") return false; // Never checked or failed → always re-check

  const ageMs = Date.now() - new Date(lastChecked).getTime();
  const ageHours = ageMs / (1000 * 60 * 60);
  return ageHours < SOURCE_CACHE_HOURS;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonError(405, "METHOD_NOT_ALLOWED", "Only POST");

  const auth = authenticateRequest(req);
  if (!auth.ok) return jsonError(401, "UNAUTHORIZED", "Invalid credentials");

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY");
  const perplexityKey = Deno.env.get("PERPLEXITY_API_KEY");

  let userId: string | null = null;

  if (!auth.isService) {
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: `Bearer ${auth.token}` } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return jsonError(401, "UNAUTHORIZED", "Invalid token");
    userId = user.id;
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // Reset Firecrawl credit tracker for this invocation
  _lpTracker = new FirecrawlCreditTracker();

  try {
    const body = await req.json().catch(() => ({}));
    let metroId = body.metro_id as string | undefined;
    const runKind = (body.run_kind as string) || "manual";
    const singleSourceId = body.source_id as string | undefined;
    const forceRun = body.force === true; // Bypass frequency governance
    const isDryRun = body.dry_run === true; // Dry run: stats only, no inserts
    const requestedTenantId = body.tenant_id as string | undefined;
    let effectiveTenantId: string | null = requestedTenantId ?? null;

    if (!effectiveTenantId && userId) {
      const { data: tenantLink } = await supabase
        .from("tenant_users")
        .select("tenant_id")
        .eq("user_id", userId)
        .limit(1)
        .maybeSingle();
      effectiveTenantId = tenantLink?.tenant_id ?? null;
    }

    if (!metroId && userId) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("home_metro_id")
        .eq("user_id", userId)
        .single();
      metroId = (profile as Record<string, unknown>)?.home_metro_id as string | undefined;
    }

    if (!metroId) return jsonError(400, "NO_METRO", "No metro_id provided and no home metro set");

    const { data: metro } = await supabase
      .from("metros")
      .select("id, metro, region_id, regions:region_id(name)")
      .eq("id", metroId)
      .single();

    if (!metro) return jsonError(404, "METRO_NOT_FOUND", "Metro not found");

    const metroName = metro.metro;
    const state = (metro as any).regions?.name as string | null;

    // ── Pre-fetch sources for frequency governance ──
    let sourcesQuery = supabase
      .from("local_pulse_sources")
      .select("*")
      .eq("metro_id", metroId)
      .eq("enabled", true);
    if (singleSourceId) {
      sourcesQuery = sourcesQuery.eq("id", singleSourceId);
    }
    const { data: sources } = await sourcesQuery;
    const sourceCount = (sources ?? []).length;

    // ── Frequency governance: check if we should skip auto-discovery ──
    let discoverySkipped = false;
    if (!forceRun && !singleSourceId && runKind !== "manual") {
      const { skip, lastRunAge } = await shouldSkipDiscovery(supabase, metroId, sourceCount);
      if (skip) {
        discoverySkipped = true;
        console.log(`[local-pulse] Skipping auto-discovery for ${metroName}: last run ${lastRunAge}h ago`);
      }
    }

    // Create run record
    const { data: run, error: runErr } = await supabase
      .from("local_pulse_runs")
      .insert({
        metro_id: metroId,
        user_id: userId,
        run_kind: runKind,
        status: "running",
        stats: {},
      })
      .select("id")
      .single();

    if (runErr) return jsonError(500, "DB_ERROR", runErr.message);
    const runId = run.id;

    const queries = buildSearchQueries(metroName, state);

    // ── Determine recency filter based on metro activity + archetype ──
    const isActiveMetro = sourceCount >= ACTIVE_METRO_SOURCE_THRESHOLD;
    const defaultRecency: "week" | "month" = isActiveMetro ? "week" : "month";

    // ── Collect tenant keywords for this metro ──
    // Manual runs should prioritize the active tenant's keywords.
    // Scheduled/system runs without a tenant context aggregate home-tenant keywords.
    let tenantKeywords: string[] = [];
    try {
      if (effectiveTenantId) {
        // Specific tenant: use their keywords
        const { data: t } = await supabase
          .from("tenants")
          .select("search_keywords")
          .eq("id", effectiveTenantId)
          .single();
        if (t?.search_keywords && Array.isArray(t.search_keywords)) {
          tenantKeywords = t.search_keywords as string[];
        }
      } else {
        // Aggregate: get keywords from all tenants whose home territory maps to this metro
        const { data: homeTerritories } = await supabase
          .from("tenant_territories")
          .select("tenant_id, territories!inner(metro_id)")
          .eq("is_home", true)
          .eq("territories.metro_id", metroId);
        if (homeTerritories && homeTerritories.length > 0) {
          const tIds = homeTerritories.map((ht: any) => ht.tenant_id);
          const { data: tenants } = await supabase
            .from("tenants")
            .select("search_keywords")
            .in("id", tIds);
          if (tenants) {
            const allKw = tenants.flatMap((t: any) =>
              Array.isArray(t.search_keywords) ? t.search_keywords : []
            );
            // Deduplicate, cap at 15
            tenantKeywords = [...new Set(allKw)].slice(0, 15);
          }
        }
      }
      if (tenantKeywords.length > 0) {
        console.log(`[local-pulse] Using ${tenantKeywords.length} tenant keywords for ${metroName}: ${tenantKeywords.slice(0, 5).join(", ")}…`);
      }
    } catch (kwErr) {
      console.warn("[local-pulse] Could not fetch tenant keywords, continuing with defaults:", kwErr);
    }

    const serviceLane = buildServiceCareQueries(
      state ? `${metroName} ${state}` : metroName, tenantKeywords, defaultRecency,
    );
    const volunteerLane = buildVolunteerQueries(
      state ? `${metroName} ${state}` : metroName, tenantKeywords, defaultRecency,
    );

    const allQueries = discoverySkipped ? [] : [
      ...queries.map((q) => ({ query: q, recency: defaultRecency })),
      ...serviceLane.queries.map((q) => ({ query: q, recency: serviceLane.recencyFilter })),
      ...volunteerLane.queries.map((q) => ({ query: q, recency: volunteerLane.recencyFilter })),
    ];

    // ── Long-tail refresh: once per month, stable services with yearly recency ──
    let longTailIncluded = false;
    if (!discoverySkipped && !singleSourceId && perplexityKey) {
      // Check last long-tail run from run stats
      const { data: lastLtRun } = await supabase
        .from("local_pulse_runs")
        .select("stats, completed_at")
        .eq("metro_id", metroId)
        .eq("status", "completed")
        .order("completed_at", { ascending: false })
        .limit(10);

      const lastLongTail = (lastLtRun ?? []).find(
        (r: Record<string, unknown>) => (r.stats as Record<string, unknown>)?.long_tail_included === true,
      );
      const lastLtAt = lastLongTail?.completed_at as string | null;

      if (isLongTailRefreshDue(lastLtAt)) {
        const ltQuery = buildLongTailQuery(state ? `${metroName} ${state}` : metroName);
        allQueries.push({ query: ltQuery, recency: "year" });
        longTailIncluded = true;
        console.log(`[local-pulse] Long-tail refresh included for ${metroName}`);
      }
    }

    const stats = {
      auto_discovery_results: 0,
      user_source_results: 0,
      events_inserted: 0,
      events_skipped_duplicate: 0,
      events_pending_extraction: 0,
      events_low_confidence: 0,
      sources_checked: 0,
      sources_cached: 0,
      queries_used: allQueries.map((q) => q.query),
      discovery_engine: discoverySkipped ? "skipped" : (perplexityKey ? "perplexity" : "none"),
      errors: 0,
      capped: false,
      // New density + reliability stats
      perplexity_parse_failures: 0,
      perplexity_citations_fallback: 0,
      domains_rejected: 0,
      dedupe_prevented: 0,
      long_tail_included: longTailIncluded,
    };

    const allCandidates: RawCandidate[] = [];
    const seenFingerprints = new Set<string>();
    const seenDedupeKeys = new Set<string>();
    let perplexityCallCount = 0;

    // ── STREAM 1: Auto-discovery via Perplexity Search (with new lanes) ──
    if (!discoverySkipped && !singleSourceId && perplexityKey) {
      for (const { query, recency } of allQueries) {
        try {
          const { results, parseMode } = await perplexityEventSearch(perplexityKey, query, recency as "week" | "month" | "year");

          // Track parse reliability
          if (parseMode !== "direct") stats.perplexity_parse_failures++;
          if (parseMode === "citations_fallback") stats.perplexity_citations_fallback++;

          const candidates = extractCandidatesFromSearchResults(results);
          stats.auto_discovery_results += candidates.length;
          allCandidates.push(...candidates);
          perplexityCallCount++;
        } catch (e) {
          console.error(`Auto-discovery query failed: ${query}`, e);
          stats.errors++;
        }
      }
    }

    // ── STREAM 2: User-added URLs (RSS direct fetch + Firecrawl for HTML) ──
    for (const source of (sources ?? []).filter((s: Record<string, unknown>) => s.source_type === "url" && s.url)) {
      // ── Source-level caching: skip if recently checked and ok ──
      if (!forceRun && !singleSourceId && shouldSkipSource(source)) {
        stats.sources_cached++;
        console.log(`[local-pulse] Cache hit for source ${source.url}: skipping (last ok ${source.last_checked_at})`);
        continue;
      }

      stats.sources_checked++;
      try {
        const sourceUrl = source.url as string;

        // ── Detect RSS/Atom feed URLs and fetch directly (no Firecrawl needed) ──
        const isLikelyRssUrl = /\/(feed|rss|atom)\/?$|\.rss$|\.xml$|\.atom$|\/events\/feed\/?$/i.test(sourceUrl);

        if (isLikelyRssUrl) {
          console.log(`[local-pulse] Direct RSS fetch for ${sourceUrl}`);
          try {
            const rssResp = await fetch(sourceUrl, {
              headers: {
                "User-Agent": "CROS-LocalPulse/1.0 (RSS reader)",
                "Accept": "application/rss+xml, application/xml, application/atom+xml, text/xml, */*",
              },
              signal: AbortSignal.timeout(15000),
            });

            if (!rssResp.ok) {
              console.error(`[local-pulse] RSS fetch failed for ${sourceUrl}: ${rssResp.status}`);
              await supabase.from("local_pulse_sources").update({
                last_checked_at: new Date().toISOString(),
                last_status: "failed",
                last_error: `HTTP ${rssResp.status} fetching RSS feed`,
              } as Record<string, unknown>).eq("id", source.id);
              continue;
            }

            const rssContent = await rssResp.text();
            if (!rssContent || rssContent.length < 50) {
              await supabase.from("local_pulse_sources").update({
                last_checked_at: new Date().toISOString(),
                last_status: "failed",
                last_error: "RSS feed returned empty content",
              } as Record<string, unknown>).eq("id", source.id);
              continue;
            }

            // Check if it's actually RSS/Atom XML
            if (isRssFeed(rssContent)) {
              const rssItems = parseRssItems(rssContent);
              console.log(`[local-pulse] RSS feed parsed for ${sourceUrl}: ${rssItems.length} items`);

              let itemCount = 0;
              for (const item of rssItems) {
                if (itemCount >= MAX_EVENTS_PER_RUN) break;
                if (!item.title || item.title.length < 3) continue;

                const text = `${item.title} ${item.description ?? ""}`;
                const eventDate = item.eventDate ? parseDate(item.eventDate) : null;
                const pubDateParsed = item.pubDate ? parseDate(item.pubDate) : null;
                const fallbackDateMatch = text.match(/\b(20\d{2}[-/]\d{1,2}[-/]\d{1,2})\b/);
                const fallbackDate = fallbackDateMatch ? parseDate(fallbackDateMatch[1].replace(/\//g, "-")) : null;
                const finalDate = eventDate ?? pubDateParsed ?? fallbackDate;

                allCandidates.push({
                  title: item.title.slice(0, 255),
                  start_date: finalDate,
                  location: null,
                  source_url: item.link || sourceUrl,
                  description: item.description?.slice(0, 500) || null,
                  host_organization: null,
                  is_recurring: detectRecurring(text),
                });
                itemCount++;
              }
              stats.user_source_results += itemCount;

              await supabase.from("local_pulse_sources").update({
                last_checked_at: new Date().toISOString(),
                last_status: "ok",
                detected_feed_type: "rss",
                last_error: null,
              } as Record<string, unknown>).eq("id", source.id);
            } else {
              // URL looked like RSS but content isn't — treat as HTML, send to extraction
              console.log(`[local-pulse] URL ${sourceUrl} is not RSS despite path, treating as HTML (${rssContent.length} chars)`);
              allCandidates.push({
                title: (source.label as string) || sourceUrl,
                start_date: null,
                location: null,
                source_url: sourceUrl,
                description: rssContent.slice(0, 30000),
                host_organization: null,
                is_recurring: false,
                _html_source: true,
              });
              stats.user_source_results++;

              await supabase.from("local_pulse_sources").update({
                last_checked_at: new Date().toISOString(),
                last_status: "ok",
                detected_feed_type: "html",
                last_error: null,
              } as Record<string, unknown>).eq("id", source.id);
            }
            continue; // Skip Firecrawl path for this source
          } catch (rssErr) {
            console.error(`[local-pulse] Direct RSS fetch error for ${sourceUrl}:`, rssErr);
            // Fall through to Firecrawl as backup
          }
        }

        // ── Firecrawl path (HTML pages, non-RSS URLs) ──
        if (!firecrawlKey) continue;

        const scrapeResult = await firecrawlScrapeWithRetry(firecrawlKey, sourceUrl);
        if (!scrapeResult.rawHtml && !scrapeResult.markdown) {
          await supabase.from("local_pulse_sources").update({
            last_checked_at: new Date().toISOString(),
            last_status: "failed",
            last_error: "Could not extract content from URL",
          } as Record<string, unknown>).eq("id", source.id);
          continue;
        }

        // Detect RSS/Atom feeds using rawHtml, parse individual items
        if (scrapeResult.rawHtml && isRssFeed(scrapeResult.rawHtml)) {
          const rssItems = parseRssItems(scrapeResult.rawHtml);
          console.log(`RSS feed detected for ${sourceUrl}: ${rssItems.length} items`);

          let itemCount = 0;
          for (const item of rssItems) {
            if (itemCount >= MAX_EVENTS_PER_RUN) break;
            if (!item.title || item.title.length < 3) continue;

            const text = `${item.title} ${item.description ?? ""}`;
            const eventDate = item.eventDate ? parseDate(item.eventDate) : null;
            const pubDateParsed = item.pubDate ? parseDate(item.pubDate) : null;
            const fallbackDateMatch = text.match(/\b(20\d{2}[-/]\d{1,2}[-/]\d{1,2})\b/);
            const fallbackDate = fallbackDateMatch ? parseDate(fallbackDateMatch[1].replace(/\//g, "-")) : null;
            const finalDate = eventDate ?? pubDateParsed ?? fallbackDate;

            allCandidates.push({
              title: item.title.slice(0, 255),
              start_date: finalDate,
              location: null,
              source_url: item.link || sourceUrl,
              description: item.description?.slice(0, 500) || null,
              host_organization: null,
              is_recurring: detectRecurring(text),
            });
            itemCount++;
          }
          stats.user_source_results += itemCount;

          await supabase.from("local_pulse_sources").update({
            last_checked_at: new Date().toISOString(),
            last_status: "ok",
            detected_feed_type: "rss",
          } as Record<string, unknown>).eq("id", source.id);

        } else {
          // HTML page — use rendered markdown for AI extraction
          const markdown = scrapeResult.markdown?.trim();
          const content = (markdown && markdown.length > 100) ? markdown : scrapeResult.rawHtml;
          const contentType = (markdown && markdown.length > 100) ? "markdown" : "rawHtml";
          console.log(`HTML page scraped for ${sourceUrl}: ${content.length} chars (${contentType})`);

          // ── Calendar grid detection: scrape individual event detail pages ──
          if (firecrawlKey && isCalendarGridPage(content)) {
            const detailUrls = extractCalendarDetailUrls(content);
            console.log(`Calendar grid detected for ${sourceUrl}: ${detailUrls.length} detail URLs found, crawling up to ${MAX_CALENDAR_DETAIL_PAGES}`);

            let detailsCrawled = 0;
            for (const detailUrl of detailUrls.slice(0, MAX_CALENDAR_DETAIL_PAGES)) {
              try {
                const detailResult = await firecrawlScrape(firecrawlKey, detailUrl);
                const detailContent = detailResult.markdown?.trim() || detailResult.rawHtml;
                if (!detailContent || detailContent.length < 50) continue;

                allCandidates.push({
                  title: (source.label as string) || detailUrl,
                  start_date: null,
                  location: null,
                  source_url: detailUrl,
                  description: detailContent.slice(0, 30000),
                  host_organization: null,
                  is_recurring: false,
                  _html_source: true,
                  _calendar_detail: true,
                });
                detailsCrawled++;
              } catch (e) {
                console.error(`Detail page scrape failed for ${detailUrl}:`, e);
              }
            }
            stats.user_source_results += detailsCrawled;
            console.log(`Calendar crawl complete: ${detailsCrawled} detail pages scraped`);

            await supabase.from("local_pulse_sources").update({
              last_checked_at: new Date().toISOString(),
              last_status: "ok",
              detected_feed_type: "html",
              last_error: null,
            } as Record<string, unknown>).eq("id", source.id);

          } else {
            // Standard HTML page — send full content for multi-event extraction
            allCandidates.push({
              title: (source.label as string) || sourceUrl,
              start_date: null,
              location: null,
              source_url: sourceUrl,
              description: content.slice(0, 30000),
              host_organization: null,
              is_recurring: false,
              _html_source: true,
            });
            stats.user_source_results++;

            await supabase.from("local_pulse_sources").update({
              last_checked_at: new Date().toISOString(),
              last_status: "ok",
              detected_feed_type: "html",
            } as Record<string, unknown>).eq("id", source.id);
          }
        }

      } catch (e) {
        console.error(`Source ${source.url} failed:`, e);
        stats.errors++;
        await supabase.from("local_pulse_sources").update({
          last_checked_at: new Date().toISOString(),
          last_status: "failed",
          last_error: e instanceof Error ? e.message : "Unknown error",
        } as Record<string, unknown>).eq("id", source.id);
      }
    }

    // ── DEDUPE + INSERT (with extraction_status='pending') ──
    const today = new Date().toISOString().slice(0, 10);
    const { data: existingEvents } = await supabase
      .from("events")
      .select("event_name, event_date")
      .eq("metro_id", metroId)
      .eq("is_local_pulse", true)
      .gte("event_date", today)
      .limit(500);

    const existingFp = new Set(
      (existingEvents ?? [])
        .filter((e: Record<string, unknown>) => e.event_date)
        .map((e: Record<string, unknown>) =>
          eventFingerprint(e.event_name as string, e.event_date as string)
        ),
    );

    const toInsert: Array<Record<string, unknown>> = [];

    for (const candidate of allCandidates) {
      // Enforce safety cap
      if (toInsert.length >= MAX_EVENTS_PER_RUN) {
        console.warn(`Ingestion cap reached: ${MAX_EVENTS_PER_RUN} events`);
        stats.capped = true;
        break;
      }

      const hasDate = !!candidate.start_date;
      const isHtmlSource = !!(candidate as any)._html_source;
      const isLowConfidence = !hasDate && (candidate.is_recurring || isHtmlSource);

      // Skip if no date AND not recurring AND not an HTML source needing extraction
      if (!hasDate && !candidate.is_recurring && !isHtmlSource) {
        continue;
      }

      // Enhanced dedupe: fingerprint + URL-based dedupe key
      const dedupeKey = generateDedupeKey(candidate.source_url, candidate.title, candidate.description);
      if (seenDedupeKeys.has(dedupeKey)) {
        stats.events_skipped_duplicate++;
        stats.dedupe_prevented++;
        continue;
      }
      seenDedupeKeys.add(dedupeKey);

      // Legacy fingerprint dedupe for dated events
      if (hasDate) {
        const fp = eventFingerprint(candidate.title, candidate.start_date!);
        if (seenFingerprints.has(fp) || existingFp.has(fp)) {
          stats.events_skipped_duplicate++;
          stats.dedupe_prevented++;
          continue;
        }
        seenFingerprints.add(fp);
      }

      if (isLowConfidence) stats.events_low_confidence++;

      const discoveryType = candidate.source_url && (sources ?? []).some((s: Record<string, unknown>) => s.url === candidate.source_url)
        ? "manual_url" : "auto";

      toInsert.push({
        event_id: `lp-${crypto.randomUUID().slice(0, 8)}`,
        event_name: candidate.title,
        event_date: candidate.start_date, // nullable for low-confidence
        metro_id: metroId,
        tenant_id: effectiveTenantId,
        city: candidate.location,
        host_organization: candidate.host_organization,
        url: candidate.source_url,
        description: candidate.description,
        is_local_pulse: true,
        is_recurring: candidate.is_recurring,
        extraction_status: "pending",
        date_confidence: isLowConfidence ? "low" : "high",
        needs_review: isLowConfidence,
        metadata: {
          source: "local_pulse",
          run_id: runId,
          narrative_weight: "high",
          discovery_type: discoveryType,
        },
      });
    }

    // ── Dry run: return sample + stats without inserting ──
    if (isDryRun) {
      const sampleResults = toInsert.slice(0, 10).map((r) => ({
        title: r.event_name,
        date: r.event_date,
        url: r.url,
        source: (r.metadata as Record<string, unknown>)?.discovery_type,
      }));

      await supabase.from("local_pulse_runs").update({
        status: "completed",
        completed_at: new Date().toISOString(),
        run_kind: "dry_run",
        stats: { ...stats, dry_run: true, sample_count: sampleResults.length },
      }).eq("id", runId);

      return jsonOk({
        ok: true,
        dry_run: true,
        run_id: runId,
        metro: metroName,
        sample: sampleResults,
        stats: {
          ...stats,
          dry_run: true,
          firecrawl_credits: _lpTracker.totalCredits,
          perplexity_calls: perplexityCallCount,
        },
      });
    }

    // Batch insert (max 50 at a time)
    for (let i = 0; i < toInsert.length; i += 50) {
      const batch = toInsert.slice(i, i + 50);
      const { error: insertErr } = await supabase.from("events").insert(batch);
      if (insertErr) {
        console.error("Event insert error:", insertErr);
        stats.errors++;
      } else {
        stats.events_inserted += batch.length;
        stats.events_pending_extraction += batch.length;
      }
    }

    // Update run record
    await supabase.from("local_pulse_runs").update({
      status: stats.errors > 0 && stats.events_inserted === 0 ? "failed" : "completed",
      completed_at: new Date().toISOString(),
      stats,
    }).eq("id", runId);

    // Fire local-pulse-extract asynchronously (best-effort)
    if (stats.events_pending_extraction > 0) {
      try {
        const fnUrl = Deno.env.get("SUPABASE_URL");
        if (fnUrl) {
          fetch(`${fnUrl}/functions/v1/local-pulse-extract`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${serviceRoleKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ metro_id: metroId, run_id: runId }),
          }).catch(e => console.error("Extract dispatch error:", e));
        }
      } catch (e) {
        console.error("Extract dispatch error:", e);
      }
    }

    // ── Flush usage tracking ──
    if (effectiveTenantId && _lpTracker.totalCalls > 0) {
      await _lpTracker.flush(supabase, effectiveTenantId, 'local_pulse')
        .catch((e: unknown) => console.warn('[local-pulse] Firecrawl credit flush failed (non-fatal):', e));
    }

    // Track Perplexity usage
    if (effectiveTenantId && perplexityCallCount > 0) {
      await recordWorkflowUsage(supabase, effectiveTenantId, 'local_pulse_discovery', 'perplexity', 'deep', perplexityCallCount)
        .catch((e: unknown) => console.warn('[local-pulse] Perplexity usage flush failed (non-fatal):', e));
    }

    return jsonOk({
      ok: true,
      run_id: runId,
      metro: metroName,
      stats: {
        ...stats,
        firecrawl_credits: _lpTracker.totalCredits,
        perplexity_calls: perplexityCallCount,
      },
    });
  } catch (e) {
    console.error("local-pulse-worker error:", e);
    return jsonError(500, "INTERNAL_ERROR", e instanceof Error ? e.message : "Unknown error");
  }
});
