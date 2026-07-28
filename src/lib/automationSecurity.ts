/**
 * Shared automation security helpers.
 * Used by n8n-dispatch for HMAC signing, URL normalization, and payload scoping.
 * Browser-safe (uses SubtleCrypto).
 */

/**
 * Compute HMAC SHA-256 hex digest.
 * Matches the n8n-dispatch edge function signing logic exactly.
 */
export async function hmacSha256Hex(secret: string, body: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(body));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Stable JSON stringification — uses JSON.stringify for exact parity
 * with the dispatch function. Does NOT sort keys.
 */
export function stableStringify(obj: unknown): string {
  return JSON.stringify(obj);
}

/**
 * Normalize a URL: trim whitespace, prepend https:// if no protocol,
 * validate via URL constructor. Returns null for invalid URLs.
 */
export function normalizeUrl(raw: unknown): string | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  let url = raw.trim();
  if (!/^https?:\/\//i.test(url)) url = "https://" + url;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
    return parsed.href;
  } catch {
    return null;
  }
}
