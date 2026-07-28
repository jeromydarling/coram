/**
 * analytics-config — Federated GA configuration for the CROS family.
 *
 * WHAT: Public GET endpoint that returns the Google Analytics measurement
 *       ID (and optional custom-dimension config) every CROS-family app
 *       should use. Apps fetch this on first paint and inject gtag.js
 *       with the returned ID.
 * WHERE: Called by the shared `useGlobalAnalytics` React hook in every app.
 * WHY: Centralizes the GA measurement ID so swapping properties or A/B
 *      testing GA configurations is a one-line server-side change instead
 *      of N redeploys.
 *
 * Security model:
 *   • Fully public (verify_jwt = false in supabase/config.toml).
 *   • CORS allowlist enforced (see _shared/cors.ts).
 *   • Read-only — no DB writes, no auth, no PII handling.
 *   • Cache-friendly response (Cache-Control: public, max-age=300, s-maxage=900).
 *
 * Config sources (in priority order):
 *   1. Per-app override env: GA_MEASUREMENT_ID_<APP_SLUG_UPPER> (e.g. GA_MEASUREMENT_ID_PROPRIA)
 *   2. Per-app entry in PER_APP_MEASUREMENT_IDS map below
 *   3. Global env override: GA_MEASUREMENT_ID
 *   4. Hardcoded DEFAULT_MEASUREMENT_ID (G-RKF41M29QE — CROS Family aggregate)
 *
 * Dual-property strategy (2026-06-04):
 *   Each app now has its own GA4 property AND continues sending events to the
 *   CROS Family aggregate property via gtag's secondary-stream feature. The
 *   client hook handles this: it `config`s the per-app ID returned here, and
 *   the family property is configured via a hardcoded inline gtag snippet in
 *   index.html (where present). This means losing this endpoint never breaks
 *   the family-wide aggregate.
 */

import { corsHeaders } from '../_shared/cors.ts';

// ── Defaults ─────────────────────────────────────────────────────────────
// CROS Family aggregate GA4 property (ID 526708699).
const DEFAULT_MEASUREMENT_ID = 'G-RKF41M29QE';

// Per-app GA4 measurement IDs. Filled in as Web Data Streams are created.
// To add a new one: create the GA4 stream in the per-app property, then
// add `slug: 'G-XXXXXXXXXX'` here. Until populated, the app falls back to
// the family aggregate ID (which still gets traffic via the secondary stream).
const PER_APP_MEASUREMENT_IDS: Record<string, string> = {
  // Tier 1 — Lovable (created 2026-06-04)
  propria: 'G-SEHP35NEPW',
  communis: 'G-JDWX2GRKWD',
  bitoku: 'G-3BWX4QJD24',
  hortus: 'G-3GRDXNHMYZ',
  refugium: 'G-MHEPMXR1DF',
  'fabrica-forge': 'G-01K9084H4T',
  fabrica: 'G-01K9084H4T',
  custodia: 'G-2N14RWR1GG',
  resurrectio: 'G-RRJZ4FG9PS',
  convivium: 'G-J1MX6BH7R9',
  transitus: 'G-ZPPVMVTYDD',
  'via-publica': 'G-6PCMSGFPZ6',
  viapublica: 'G-6PCMSGFPZ6',
  // Tier 2 — Cloudflare commercial (created 2026-06-04)
  communicare: 'G-QSNRNJ6VJB',
  culina: 'G-XRZRBGRQKL',
  '8seconds': 'G-L41H4EVNFK',
  'eight-seconds': 'G-L41H4EVNFK',
  inmotu: 'G-FNRPG0VBT9',
  successio: 'G-99VJN9C0M6',
  sanctum: 'G-E9Z0RRLN6C',
  directio: 'G-74XK3ZHPJZ',
};

// Custom dimensions registered on every GA4 property in the family.
// Convention: each app stamps `cros_app: <slug>` on every event so reports
// can be filtered by app inside the family aggregate property.
const CUSTOM_DIMENSIONS_PARAMS = ['cros_app'];

// Known source apps. Used for soft validation of the ?app= query param.
const KNOWN_SOURCE_APPS = new Set([
  // Tier 1 — Lovable
  'thecros',
  'theschola',
  'hortus',
  'refugium',
  'resurrectio',
  'transitus',
  'vigilia',
  'communis',
  'propria',
  'cormundum',
  'bitoku',
  'rehearso',
  'via-publica',
  'viapublica',
  'fabrica-forge',
  'fabrica',
  'catholic-insurance',
  'vrtmethod',
  'custodia',
  'convivium',
  // Heritage
  'heritage-kitchen',
  'heritage-parlor',
  'heritage-catholic',
  'heritage-history',
  'heritage-skills',
  // Tier 2 — Cloudflare commercial
  'communicare',
  'culina',
  '8seconds',
  'inmotu',
  'successio',
  'sanctum',
  'directio',
]);

interface AnalyticsConfigResponse {
  /** GA4 measurement ID for THIS app (per-app if available, else family aggregate). */
  measurementId: string;
  /** GA4 measurement ID for the family aggregate property — clients can send dual events. */
  familyMeasurementId: string;
  /** Provider — currently always "ga4". Future-proof for posthog/plausible swaps. */
  provider: 'ga4';
  /** Whether GA debug_mode should be enabled (true on staging/dev only). */
  debug: boolean;
  /** Custom dimension parameter names the client should always stamp. */
  customDimensionParams: string[];
  /** Echoed app slug if the caller passed ?app=<slug> and it was recognized. */
  app: string | null;
  /** True if the returned measurementId is a per-app property (vs the family fallback). */
  isPerApp: boolean;
  /** Server timestamp (ISO) — useful for cache debugging. */
  serverTime: string;
}

function resolveMeasurementId(app: string | null): { id: string; isPerApp: boolean } {
  // 1. Per-app env override (e.g. GA_MEASUREMENT_ID_PROPRIA)
  if (app) {
    const envKey = `GA_MEASUREMENT_ID_${app.toUpperCase().replace(/-/g, '_')}`;
    const envVal = Deno.env.get(envKey)?.trim();
    if (envVal) return { id: envVal, isPerApp: true };
  }
  // 2. Per-app hardcoded map
  if (app && PER_APP_MEASUREMENT_IDS[app]) {
    return { id: PER_APP_MEASUREMENT_IDS[app], isPerApp: true };
  }
  // 3. Global env override
  const globalEnv = Deno.env.get('GA_MEASUREMENT_ID')?.trim();
  if (globalEnv) return { id: globalEnv, isPerApp: false };
  // 4. Family aggregate fallback
  return { id: DEFAULT_MEASUREMENT_ID, isPerApp: false };
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== 'GET') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  const url = new URL(req.url);
  const appParam = url.searchParams.get('app');
  const app = appParam && KNOWN_SOURCE_APPS.has(appParam) ? appParam : null;

  const { id: measurementId, isPerApp } = resolveMeasurementId(app);
  const debug = Deno.env.get('GA_DEBUG_MODE') === 'true';

  const body: AnalyticsConfigResponse = {
    measurementId,
    familyMeasurementId: DEFAULT_MEASUREMENT_ID,
    provider: 'ga4',
    debug,
    customDimensionParams: CUSTOM_DIMENSIONS_PARAMS,
    app,
    isPerApp,
    serverTime: new Date().toISOString(),
  };

  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=300, s-maxage=900',
    },
  });
});
