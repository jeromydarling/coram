/**
 * marketingPaths — Single source of truth for non-tenant routes.
 *
 * WHAT: Helper to decide whether a given pathname is a public/marketing
 *       route (or otherwise lives outside the `/:tenantSlug/` shell) and
 *       should NOT be tenant-prefix-redirected.
 * WHERE: Imported by LegacyPathRedirect, TenantRouteGuard, and any future
 *        guard that needs to discriminate marketing vs tenant URLs.
 * WHY: The old hardcoded allow-list drifted every time we added a route,
 *      producing accidental redirect loops and 404s. This centralizes it.
 */

/** Exact-match marketing/public paths. */
const MARKETING_EXACT = new Set<string>([
  '/',
  '/manifesto',
  '/pricing',
  '/archetypes',
  '/security',
  '/contact',
  '/nri',
  '/cros',
  '/profunda',
  '/impulsus',
  '/testimonium-feature',
  '/communio-feature',
  '/signum',
  '/voluntarium',
  '/provisio',
  '/relatio-campaigns',
  '/integrations',
  '/case-study-humanity',
  '/proof',
  '/compare',
  '/see-people',
  '/roles',
  '/features',
  '/the-model',
  '/sjbg',
  '/sitemap.xml',
  '/robots.txt',
  '/llms.txt',
]);

/** Exact-match auth/onboarding paths (handled by their own routes). */
const AUTH_EXACT = new Set<string>([
  '/login',
  '/signup',
  '/forgot-password',
  '/reset-password',
  '/onboarding',
  '/sponsored-setup',
  '/checkout',
  '/checkout-success',
  '/verify-email',
]);

/**
 * Prefixes that always belong to non-tenant surfaces.
 * Keep this list narrow and stable; broad prefixes hide bugs.
 */
const NON_TENANT_PREFIXES: readonly string[] = [
  '/admin',
  '/operator',
  '/insights',
  '/stories',
  '/roles/',
  '/metros/',
  '/path/',
  '/calling/',
  '/library',
  '/network/',
  '/public/',
  '/week/',
  '/essays',
  '/field-notes-library',
  '/reflections',
  '/field-journal',
  '/lexicon',
  '/mission-atlas',
  '/compare/',
  '/archetypes/',
  '/legal/',
  '/fundraising',
  '/authority',
  '/events/',
];

/**
 * True when the pathname is a marketing/public route, an auth route, or
 * any other surface that intentionally lives outside `/:tenantSlug/`.
 *
 * This is the ONLY function callers should use to make that decision.
 */
export function isMarketingPath(pathname: string): boolean {
  if (MARKETING_EXACT.has(pathname)) return true;
  if (AUTH_EXACT.has(pathname)) return true;
  return NON_TENANT_PREFIXES.some(prefix => pathname.startsWith(prefix));
}

/** True only for auth-flow paths (login, signup, onboarding, etc.). */
export function isAuthPath(pathname: string): boolean {
  return AUTH_EXACT.has(pathname);
}
