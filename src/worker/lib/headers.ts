/**
 * The response headers that are a security boundary rather than a nicety.
 *
 * They live here rather than inline in index.ts because a policy is only worth
 * having if it is asserted, and headers.test.ts asserts the shape of every
 * directive below. A CSP that quietly grew an 'unsafe-inline' on script-src is
 * indistinguishable from no CSP at all, and nothing about the deployed page
 * would look different.
 */

/**
 * Content-Security-Policy.
 *
 * `default-src 'none'` and then an explicit line per fetch directive the
 * product actually uses. The deny-by-default shape is the point: a future
 * module that starts loading something new fails visibly in the console on the
 * first request rather than silently widening what a page is allowed to fetch.
 *
 * Two directives deserve their reasoning written down.
 *
 * `script-src 'self'` with no 'unsafe-inline' and no nonce is possible because
 * of §10 — no external JS on any route, no analytics, no chat widget — and
 * because nothing here has an inline <script>. The SPA shell loads one module
 * from /assets, the marketing page loads /marketing/motion.js, and that is the
 * entire script surface. This is the directive that does the work, and it is
 * the one to defend if something later asks to be pasted into a page.
 *
 * `style-src 'unsafe-inline'` is a real concession and not a mistake. The
 * server-rendered pages carry their CSS in an inline <style> — marketing, the
 * published group page, the trust page — and the app sets style attributes for
 * anything computed, a fund's progress bar most of all. A nonce would cover the
 * <style> elements but not the attributes, so it would buy a partial policy at
 * the cost of threading a nonce through every server-rendered route. With
 * script-src closed, inline CSS is a narrow vector: it can exfiltrate the shape
 * of a page through selective background-image requests, and img-src below
 * confines even that to this origin.
 *
 * `img-src` carries data: and blob: because both are load-bearing in the
 * studio. A brand backdrop arrives as a data:image/ URI (see api/brand.ts) and
 * the flyer rasteriser draws an <img> whose src is a blob: of the composed SVG
 * (see app/lib/share.ts) — Safari will not decode a data: URI that long.
 *
 * There is no `upgrade-insecure-requests`: every subresource is same-origin, so
 * it would upgrade nothing in production and would break `wrangler dev` over
 * plain http, which is where this policy gets checked against a real browser.
 */
export const CSP = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "manifest-src 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "base-uri 'none'",
  "object-src 'none'",
].join('; ');

/**
 * HSTS: two years, subdomains included, and preload-eligible.
 *
 * `includeSubDomains` is safe here because §1.5 means there is one Worker and
 * no sibling service on a subdomain that could need plain http — the constraint
 * that usually makes this directive dangerous does not exist for us.
 *
 * `preload` is a claim to the browser vendors' hardcoded list and is close to
 * irreversible, so it is asserted only for the apex we actually control and
 * only over https; sending it from a local http dev server would be a lie that
 * a browser ignores today and might not tomorrow.
 */
export const HSTS = 'max-age=63072000; includeSubDomains; preload';

/**
 * Permissions-Policy: every powerful feature off.
 *
 * Nothing in Coram asks for a camera, a microphone or a location, and a group
 * whose whole argument is that we hold as little as possible should not be one
 * permission prompt away from that being untrue. An empty allowlist — `()` —
 * denies the feature to this document and every frame in it.
 */
export const PERMISSIONS_POLICY = [
  'accelerometer=()',
  'camera=()',
  'display-capture=()',
  'geolocation=()',
  'gyroscope=()',
  'magnetometer=()',
  'microphone=()',
  'payment=()',
  'usb=()',
].join(', ');

/**
 * Apply the set to a response.
 *
 * `secure` decides HSTS alone: a browser ignores the header over http anyway,
 * but emitting it there would make the local dev server claim something about
 * transport that is not true, and the assertion is cheaper than the argument.
 */
export function securityHeaders(secure: boolean): Record<string, string> {
  return {
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    // Redundant beside frame-ancestors for any browser from the last five
    // years, kept for the ones that are not.
    'X-Frame-Options': 'DENY',
    'Content-Security-Policy': CSP,
    'Permissions-Policy': PERMISSIONS_POLICY,
    ...(secure ? { 'Strict-Transport-Security': HSTS } : {}),
  };
}

/** https, or a proxy in front of us that terminated it. */
export function isSecure(request: Request): boolean {
  if (request.headers.get('x-forwarded-proto') === 'https') return true;
  try {
    return new URL(request.url).protocol === 'https:';
  } catch {
    return false;
  }
}
