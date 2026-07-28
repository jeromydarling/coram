/**
 * Deterministic URL normalization for deduplication.
 * Used in both saved-search-mark-seen and saved-search-results.
 */

const TRACKING_PARAMS = new Set([
  "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
  "gclid", "fbclid", "mc_cid", "mc_eid",
]);

export function normalizeUrl(raw: string): string {
  if (!raw || typeof raw !== "string") return "";
  let url = raw.trim();
  if (!url) return "";

  // Ensure protocol
  if (!/^https?:\/\//i.test(url)) {
    url = "https://" + url;
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    // If unparseable, lowercase and return
    return url.toLowerCase();
  }

  // Lowercase scheme + host
  parsed.protocol = parsed.protocol.toLowerCase();
  parsed.hostname = parsed.hostname.toLowerCase();

  // Strip www.
  if (parsed.hostname.startsWith("www.")) {
    parsed.hostname = parsed.hostname.slice(4);
  }

  // Remove fragments
  parsed.hash = "";

  // Remove tracking params and sort remaining
  const params = new URLSearchParams();
  const entries: [string, string][] = [];
  parsed.searchParams.forEach((value, key) => {
    if (!TRACKING_PARAMS.has(key.toLowerCase())) {
      entries.push([key, value]);
    }
  });
  entries.sort((a, b) => a[0].localeCompare(b[0]));
  for (const [k, v] of entries) {
    params.set(k, v);
  }

  // Rebuild
  const search = params.toString();
  let pathname = parsed.pathname;

  // Remove trailing slash (except root)
  if (pathname.length > 1 && pathname.endsWith("/")) {
    pathname = pathname.slice(0, -1);
  }

  return `${parsed.protocol}//${parsed.hostname}${pathname}${search ? "?" + search : ""}`;
}
