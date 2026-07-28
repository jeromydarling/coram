/**
 * atlas-back-links — Public back-link feed for CROS Federation satellite apps.
 *
 * WHAT: GET ?app_slug=<slug> → JSON listing the Mission Atlas entries the given
 *       federation app participates in, so satellites can render an SEO-friendly
 *       "This app appears in the Mission Atlas" footer linking back to thecros.app.
 * WHERE: Called from satellite app footers (browser, unauthenticated). See the
 *        AtlasBackLinksFooter component + atlas_back_links_satellite_integration.md.
 * WHY: Closes the bidirectional loop — the Atlas detail pages link out to apps,
 *      and apps link back to the Atlas — building a reciprocal SEO graph.
 *
 * Security model:
 *   • Fully public (verify_jwt = false in supabase/config.toml).
 *   • Wildcard CORS (every satellite calls it from the browser unauthenticated).
 *   • Read-only — serves a committed JSON snapshot, no DB, no auth, no PII.
 *
 * Data source: supabase/functions/_shared/atlas-back-links-data.json, baked from
 * src/content by `npm run atlas:snapshot`. Edge functions cannot import from src/,
 * so the snapshot is regenerated and committed whenever the atlas↔app map changes.
 */
import { corsHeaders } from '../_shared/cors.ts';
import snapshot from '../_shared/atlas-back-links-data.json' with { type: 'json' };

interface BackLinkEntry {
  id: string;
  archetype: string;
  metro_type: string;
  title: string;
  url: string;
}

type Snapshot = Record<string, BackLinkEntry[]>;

const DATA = snapshot as Snapshot;

Deno.serve((req: Request): Response => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== 'GET') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  const appSlug = new URL(req.url).searchParams.get('app_slug')?.trim() ?? '';
  if (!appSlug) {
    return new Response(
      JSON.stringify({ error: 'Missing required query param: app_slug' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  const atlas_entries = DATA[appSlug] ?? [];

  return new Response(
    JSON.stringify({ app_slug: appSlug, atlas_entries }),
    {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600, s-maxage=86400',
      },
    },
  );
});
