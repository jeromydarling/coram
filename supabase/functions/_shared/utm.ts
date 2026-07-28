/**
 * UTM link rewriting for marketing email sends.
 *
 * WHAT: Appends utm_source / utm_medium / utm_campaign / utm_content query
 *       parameters to every http(s) link in a rendered email body so GA4
 *       (and any other analytics tool) can attribute the resulting web
 *       sessions back to the specific campaign and — via utm_content — to
 *       the specific recipient who clicked.
 * WHERE: Called from `gmail-campaign-send` and `outlook-send` after merge
 *        tags are resolved and before the CAN-SPAM footer is appended.
 * WHY: Email clients strip <script>, so there's no in-email GA tag; the
 *      only reliable attribution is a UTM-tagged link that lands on our
 *      site (where the app's GA4 tag runs).
 *
 * Defaults:
 *   utm_source   = "cros"            (overridable per campaign via metadata.utm.source)
 *   utm_medium   = "email"
 *   utm_campaign = slugified campaign name (or subject as fallback)
 *   utm_content  = short SHA-256 hash of (recipient_email + campaign_id)
 *                  — per-recipient click attribution without leaking PII.
 */

export interface UtmParams {
  source: string;
  medium: string;
  campaign: string;
  content?: string;
}

/** Lowercase, hyphenate, strip non-url-safe chars. */
export function slugify(input: string): string {
  return (input || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "campaign";
}

/**
 * Short, non-reversible per-recipient identifier for utm_content.
 * SHA-256(email + campaign_id), first 12 hex chars (~48 bits).
 * Stable for the same (email, campaign) pair, so click reports can be
 * joined back to `email_campaign_audience` server-side if needed.
 */
export async function recipientHash(
  email: string,
  campaignId: string,
): Promise<string> {
  const data = new TextEncoder().encode(`${email.toLowerCase()}|${campaignId}`);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .slice(0, 6)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Rewrite every http(s) href in `html` to include utm_* params.
 * - Preserves any existing query string / fragment.
 * - Does NOT overwrite utm_* params already present in the source link.
 * - Skips mailto:, tel:, #anchors, and any URL in `skipUrls`
 *   (used to keep the unsubscribe link untagged so click-tracking
 *   doesn't inflate "clicks" with opt-outs).
 */
export function rewriteLinksWithUtm(
  html: string,
  utm: UtmParams,
  skipUrls: string[] = [],
): string {
  if (!html) return html;
  const skip = new Set(skipUrls.filter(Boolean));

  return html.replace(
    /(<a\b[^>]*\bhref\s*=\s*)(["'])(https?:\/\/[^"'\s>]+)\2/gi,
    (_match, prefix: string, quote: string, url: string) => {
      if (skip.has(url)) return `${prefix}${quote}${url}${quote}`;
      try {
        const u = new URL(url);
        if (!u.searchParams.has("utm_source")) u.searchParams.set("utm_source", utm.source);
        if (!u.searchParams.has("utm_medium")) u.searchParams.set("utm_medium", utm.medium);
        if (!u.searchParams.has("utm_campaign")) u.searchParams.set("utm_campaign", utm.campaign);
        if (utm.content && !u.searchParams.has("utm_content")) {
          u.searchParams.set("utm_content", utm.content);
        }
        return `${prefix}${quote}${u.toString()}${quote}`;
      } catch {
        // Malformed URL — leave it alone rather than corrupt the message.
        return `${prefix}${quote}${url}${quote}`;
      }
    },
  );
}
