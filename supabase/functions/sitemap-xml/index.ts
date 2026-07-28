/**
 * sitemap-xml — Serves a proper XML sitemap for search engine crawlers.
 *
 * WHAT: Returns valid XML sitemap without requiring JS execution.
 * WHERE: Referenced from robots.txt as an additional sitemap source.
 * WHY: The client-side SitemapRoute requires JS execution, which many AI
 *       crawlers and some search engine bots skip. This edge function
 *       guarantees crawlers receive a valid sitemap.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SITE_URL = 'https://thecros.app';

interface SitemapEntry {
  path: string;
  priority: string;
  changefreq: string;
  lastmod?: string;
}

const staticRoutes: SitemapEntry[] = [
  { path: '/', priority: '1.0', changefreq: 'weekly' },
  { path: '/manifesto', priority: '0.9', changefreq: 'monthly' },
  { path: '/nri', priority: '0.9', changefreq: 'monthly' },
  { path: '/cros', priority: '0.8', changefreq: 'monthly' },
  { path: '/profunda', priority: '0.6', changefreq: 'monthly' },
  { path: '/pricing', priority: '0.8', changefreq: 'weekly' },
  { path: '/contact', priority: '0.6', changefreq: 'monthly' },
  { path: '/security', priority: '0.6', changefreq: 'monthly' },
  { path: '/features', priority: '0.8', changefreq: 'monthly' },
  { path: '/signum', priority: '0.7', changefreq: 'monthly' },
  { path: '/testimonium-feature', priority: '0.7', changefreq: 'monthly' },
  { path: '/communio-feature', priority: '0.7', changefreq: 'monthly' },
  { path: '/impulsus', priority: '0.7', changefreq: 'monthly' },
  { path: '/voluntarium', priority: '0.7', changefreq: 'monthly' },
  { path: '/provisio', priority: '0.7', changefreq: 'monthly' },
  { path: '/relatio-campaigns', priority: '0.7', changefreq: 'monthly' },
  { path: '/integrations', priority: '0.7', changefreq: 'monthly' },
  { path: '/roles', priority: '0.8', changefreq: 'monthly' },
  { path: '/roles/shepherd', priority: '0.7', changefreq: 'monthly' },
  { path: '/roles/companion', priority: '0.7', changefreq: 'monthly' },
  { path: '/roles/visitor', priority: '0.7', changefreq: 'monthly' },
  { path: '/roles/steward', priority: '0.7', changefreq: 'monthly' },
  { path: '/archetypes', priority: '0.8', changefreq: 'monthly' },
  { path: '/archetypes/church-week', priority: '0.7', changefreq: 'monthly' },
  { path: '/archetypes/nonprofit-week', priority: '0.7', changefreq: 'monthly' },
  { path: '/archetypes/social-enterprise-week', priority: '0.7', changefreq: 'monthly' },
  { path: '/archetypes/community-network-week', priority: '0.7', changefreq: 'monthly' },
  { path: '/archetypes/ministry-outreach-week', priority: '0.7', changefreq: 'monthly' },
  { path: '/for-companions', priority: '0.6', changefreq: 'monthly' },
  { path: '/compare', priority: '0.7', changefreq: 'monthly' },
  { path: '/proof', priority: '0.6', changefreq: 'monthly' },
  { path: '/case-study-humanity', priority: '0.7', changefreq: 'monthly' },
  { path: '/fundraising-without-a-donor-crm', priority: '0.7', changefreq: 'monthly' },
  { path: '/see-people', priority: '0.7', changefreq: 'monthly' },
  { path: '/imagine-this', priority: '0.7', changefreq: 'monthly' },
  { path: '/lexicon', priority: '0.7', changefreq: 'monthly' },
  { path: '/library', priority: '0.7', changefreq: 'monthly' },
  { path: '/field-journal', priority: '0.7', changefreq: 'weekly' },
  { path: '/insights', priority: '0.8', changefreq: 'weekly' },
  { path: '/insights/why-crm-fails-nonprofits', priority: '0.7', changefreq: 'monthly', lastmod: '2026-01-15' },
  { path: '/insights/relationship-memory-matters', priority: '0.7', changefreq: 'monthly', lastmod: '2026-02-01' },
  { path: '/essays', priority: '0.7', changefreq: 'weekly' },
  { path: '/reflections', priority: '0.6', changefreq: 'monthly' },
  { path: '/mission-atlas', priority: '0.7', changefreq: 'monthly' },
  { path: '/network', priority: '0.6', changefreq: 'monthly' },
  { path: '/authority', priority: '0.6', changefreq: 'monthly' },
  { path: '/path/shepherd', priority: '0.6', changefreq: 'monthly' },
  { path: '/path/companion', priority: '0.6', changefreq: 'monthly' },
  { path: '/path/steward', priority: '0.6', changefreq: 'monthly' },
  { path: '/path/visitor', priority: '0.6', changefreq: 'monthly' },
  { path: '/calling/home-visitation', priority: '0.6', changefreq: 'monthly' },
  { path: '/calling/parish-outreach', priority: '0.6', changefreq: 'monthly' },
  { path: '/calling/community-support', priority: '0.6', changefreq: 'monthly' },
  { path: '/legal/terms', priority: '0.4', changefreq: 'yearly' },
  { path: '/legal/privacy', priority: '0.4', changefreq: 'yearly' },
  { path: '/legal/data-processing', priority: '0.4', changefreq: 'yearly' },
  { path: '/legal/acceptable-use', priority: '0.4', changefreq: 'yearly' },
  { path: '/legal/ai-transparency', priority: '0.4', changefreq: 'yearly' },
];

function buildSitemap(): string {
  const today = new Date().toISOString().split('T')[0];

  const urls = staticRoutes.map((r) => {
    const lastmod = r.lastmod || today;
    return `  <url>
    <loc>${SITE_URL}${r.path}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${r.changefreq}</changefreq>
    <priority>${r.priority}</priority>
  </url>`;
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const xml = buildSitemap();
    return new Response(xml, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error) {
    console.error('Sitemap generation error:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
});
