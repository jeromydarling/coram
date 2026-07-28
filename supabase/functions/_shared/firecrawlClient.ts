/**
 * Shared Firecrawl API client for all worker edge functions.
 * Handles scrape, search, and map operations with timeout + error handling.
 */

const FIRECRAWL_BASE = "https://api.firecrawl.dev/v1";

export interface FirecrawlScrapeResult {
  ok: boolean;
  markdown?: string;
  html?: string;
  metadata?: Record<string, unknown>;
  error?: string;
  creditsUsed?: number;
}

export interface FirecrawlSearchResult {
  ok: boolean;
  results?: Array<{
    url: string;
    title?: string;
    description?: string;
    markdown?: string;
  }>;
  error?: string;
  creditsUsed?: number;
}

function getApiKey(): string | null {
  return Deno.env.get("FIRECRAWL_API_KEY") || Deno.env.get("FIRECRAWL_API_KEY_1") || null;
}

/**
 * Scrape a single URL for markdown content.
 */
export async function firecrawlScrape(
  url: string,
  options: { formats?: string[]; onlyMainContent?: boolean; timeoutMs?: number } = {},
): Promise<FirecrawlScrapeResult> {
  const apiKey = getApiKey();
  if (!apiKey) return { ok: false, error: "FIRECRAWL_API_KEY not configured" };

  try {
    const resp = await fetch(`${FIRECRAWL_BASE}/scrape`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url,
        formats: options.formats || ["markdown"],
        onlyMainContent: options.onlyMainContent ?? true,
      }),
      signal: AbortSignal.timeout(options.timeoutMs || 30_000),
    });

    const data = await resp.json();
    if (!resp.ok) {
      return { ok: false, error: data.error || `Firecrawl ${resp.status}` };
    }

    return {
      ok: true,
      markdown: data.data?.markdown || data.markdown,
      html: data.data?.html || data.html,
      metadata: data.data?.metadata || data.metadata,
      creditsUsed: data.creditsUsed,
    };
  } catch (err) {
    return { ok: false, error: `Firecrawl scrape failed: ${err instanceof Error ? err.message : String(err)}` };
  }
}

/**
 * Search the web via Firecrawl and optionally scrape results.
 */
export async function firecrawlSearch(
  query: string,
  options: { limit?: number; scrapeOptions?: { formats?: string[] }; timeoutMs?: number; lang?: string; country?: string; tbs?: string } = {},
): Promise<FirecrawlSearchResult> {
  const apiKey = getApiKey();
  if (!apiKey) return { ok: false, error: "FIRECRAWL_API_KEY not configured" };

  try {
    const resp = await fetch(`${FIRECRAWL_BASE}/search`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query,
        limit: options.limit || 10,
        lang: options.lang,
        country: options.country,
        tbs: options.tbs,
        scrapeOptions: options.scrapeOptions,
      }),
      signal: AbortSignal.timeout(options.timeoutMs || 45_000),
    });

    const data = await resp.json();
    if (!resp.ok) {
      return { ok: false, error: data.error || `Firecrawl search ${resp.status}` };
    }

    return {
      ok: true,
      results: data.data || [],
      creditsUsed: data.creditsUsed,
    };
  } catch (err) {
    return { ok: false, error: `Firecrawl search failed: ${err instanceof Error ? err.message : String(err)}` };
  }
}

/**
 * Normalize a URL for scraping.
 */
export function normalizeFirecrawlUrl(raw: string): string {
  let url = raw.trim();
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  try {
    return new URL(url).href;
  } catch {
    return url;
  }
}
