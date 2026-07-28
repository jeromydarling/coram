/**
 * federationTracking — Helpers for Gardener CROS Federation email tracking.
 *
 * WHAT: SHA-256 email hashing, base64url encoding for tracked click URLs,
 *       HTML rewriting (link tracking + open pixel), Propria UTM injection.
 * WHERE: Used by gmail-campaign-send (rewrite HTML), track-click (decode),
 *        federation-signup-ingest (match by email_hash), gardener-campaign-import-csv.
 * WHY: One canonical implementation so the wire format never drifts.
 */

export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function emailHash(email: string): Promise<string> {
  return sha256Hex(email.trim().toLowerCase());
}

export function base64UrlEncode(input: string): string {
  const bytes = new TextEncoder().encode(input);
  const bin = String.fromCharCode(...bytes);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function base64UrlDecode(input: string): string {
  const b64 = input.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((input.length + 3) % 4);
  const bin = atob(b64);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/**
 * Domains that count as "the Propria app" for UTM injection. Extend per-app.
 */
export const FEDERATION_APP_DOMAINS: Record<string, string[]> = {
  propria: ["propria.land", "www.propria.land", "propria.app", "www.propria.app", "propria.lovable.app"],
};

export function isFederationAppUrl(urlStr: string, appSlug: string): boolean {
  try {
    const url = new URL(urlStr);
    const domains = FEDERATION_APP_DOMAINS[appSlug] || [];
    return domains.includes(url.hostname.toLowerCase());
  } catch {
    return false;
  }
}

export function appendUtmParams(
  urlStr: string,
  params: { campaign_id: string; send_id: string },
): string {
  try {
    const u = new URL(urlStr);
    if (!u.searchParams.has("utm_source")) u.searchParams.set("utm_source", "cros_federation");
    if (!u.searchParams.has("utm_medium")) u.searchParams.set("utm_medium", "email");
    if (!u.searchParams.has("utm_campaign")) u.searchParams.set("utm_campaign", params.campaign_id);
    u.searchParams.set("cros_sid", params.send_id);
    return u.toString();
  } catch {
    return urlStr;
  }
}

export interface RewriteHtmlOptions {
  html: string;
  sendId: string;
  campaignId: string;
  federationAppSlug: string;
  supabaseUrl: string;
  disclosePixel: boolean;
}

/**
 * Rewrites <a href="..."> to route through /functions/v1/track-click and
 * injects an open pixel <img> before </body>. Federation-app URLs also get
 * UTM + cros_sid appended so the destination app can attribute the recipient.
 */
export function rewriteHtmlForTracking(opts: RewriteHtmlOptions): string {
  const { html, sendId, campaignId, federationAppSlug, supabaseUrl, disclosePixel } = opts;

  // 1) Rewrite <a href="...">
  const rewritten = html.replace(
    /(<a\b[^>]*\shref\s*=\s*["'])([^"']+)(["'])/gi,
    (_match, pre, urlRaw, post) => {
      const url = String(urlRaw);
      // Skip mailto/tel/anchor/javascript
      if (/^(mailto:|tel:|#|javascript:|data:)/i.test(url)) {
        return `${pre}${url}${post}`;
      }
      // Skip if it already points at our tracking endpoints (unsubscribe, etc.)
      if (url.includes("/functions/v1/track-click") || url.includes("/functions/v1/unsubscribe")) {
        return `${pre}${url}${post}`;
      }

      // If the link targets the federation app, append UTMs BEFORE encoding
      const finalUrl = isFederationAppUrl(url, federationAppSlug)
        ? appendUtmParams(url, { campaign_id: campaignId, send_id: sendId })
        : url;

      const tracked = `${supabaseUrl}/functions/v1/track-click?sid=${encodeURIComponent(sendId)}&u=${encodeURIComponent(base64UrlEncode(finalUrl))}`;
      return `${pre}${tracked}${post}`;
    },
  );

  // 2) Append open pixel + optional disclosure
  const pixel = `<img src="${supabaseUrl}/functions/v1/track-open?sid=${encodeURIComponent(sendId)}" width="1" height="1" style="display:none;border:0;" alt="" />`;
  const disclosure = disclosePixel
    ? `<div style="margin-top:8px;font-size:11px;color:#bbb;text-align:center;">This message contains an invisible pixel used to know if it was opened.</div>`
    : "";
  const injection = `${disclosure}${pixel}`;

  if (/<\/body>/i.test(rewritten)) {
    return rewritten.replace(/<\/body>/i, `${injection}</body>`);
  }
  return rewritten + injection;
}
