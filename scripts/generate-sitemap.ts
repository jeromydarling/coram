/**
 * generate-sitemap — Emits public/sitemap.xml at build time.
 *
 * WHAT: Renders the same route list as src/lib/seo/sitemap.ts to a static file.
 * WHERE: Runs from predev + prebuild via package.json scripts.
 * WHY: /sitemap.xml must be a real static file so crawlers get 200 XML, not a
 *      client-rendered SPA response.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');

async function loadContent<T>(rel: string, exportName: string): Promise<T[]> {
  try {
    const mod = await import(pathToFileURL(resolve(projectRoot, rel)).href);
    return (mod[exportName] ?? []) as T[];
  } catch (err) {
    console.warn(`[sitemap] Could not load ${rel} (${exportName}) — skipping.`, err);
    return [];
  }
}

const SITE_URL = 'https://thecros.app';

const staticRoutes: { path: string; priority: string; changefreq: string }[] = [
  { path: '/', priority: '1.0', changefreq: 'weekly' },
  { path: '/manifesto', priority: '0.9', changefreq: 'monthly' },
  { path: '/nri', priority: '0.9', changefreq: 'monthly' },
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
  { path: '/pricing', priority: '0.8', changefreq: 'weekly' },
  { path: '/compare', priority: '0.7', changefreq: 'monthly' },
  { path: '/cros', priority: '0.7', changefreq: 'monthly' },
  { path: '/profunda', priority: '0.6', changefreq: 'monthly' },
  { path: '/security', priority: '0.6', changefreq: 'monthly' },
  { path: '/contact', priority: '0.6', changefreq: 'monthly' },
  { path: '/impulsus', priority: '0.6', changefreq: 'monthly' },
  { path: '/signum', priority: '0.6', changefreq: 'monthly' },
  { path: '/testimonium-feature', priority: '0.6', changefreq: 'monthly' },
  { path: '/communio-feature', priority: '0.6', changefreq: 'monthly' },
  { path: '/voluntarium', priority: '0.6', changefreq: 'monthly' },
  { path: '/provisio', priority: '0.6', changefreq: 'monthly' },
  { path: '/relatio-campaigns', priority: '0.6', changefreq: 'monthly' },
  { path: '/case-study-humanity', priority: '0.7', changefreq: 'monthly' },
  { path: '/proof', priority: '0.6', changefreq: 'monthly' },
  { path: '/insights', priority: '0.8', changefreq: 'weekly' },
];

interface Dated { slug: string; datePublished?: string }
interface Role { role: string; slug: string; datePublished?: string }

async function main() {
  const insights = await loadContent<Dated>('src/content/insights.ts', 'insights');
  const stories = await loadContent<Dated>('src/content/stories.ts', 'stories');
  const archetypeComparisons = await loadContent<Dated>('src/content/archetypeComparisons.ts', 'archetypeComparisons');
  const roleGuides = await loadContent<Role>('src/content/roleGuides.ts', 'roleGuides');
  const roleStories = await loadContent<Dated>('src/content/roleStories.ts', 'roleStories');

  const today = new Date().toISOString().split('T')[0];
  const url = (loc: string, lastmod: string, changefreq: string, priority: string) =>
    `  <url>\n    <loc>${SITE_URL}${loc}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n  </url>`;

  const urls = [
    ...staticRoutes.map((r) => url(r.path, today, r.changefreq, r.priority)),
    ...insights.map((i) => url(`/insights/${i.slug}`, i.datePublished ?? today, 'monthly', '0.7')),
    ...stories.map((s) => url(`/stories/${s.slug}`, s.datePublished ?? today, 'monthly', '0.7')),
    ...archetypeComparisons.map((c) => url(`/compare/${c.slug}`, today, 'monthly', '0.7')),
    ...roleGuides.map((g) => url(`/roles/${g.role}/${g.slug}`, g.datePublished ?? today, 'monthly', '0.6')),
    ...roleStories.map((s) => url(`/stories/roles/${s.slug}`, s.datePublished ?? today, 'monthly', '0.7')),
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`;

  const outDir = resolve(projectRoot, 'public');
  mkdirSync(outDir, { recursive: true });
  writeFileSync(resolve(outDir, 'sitemap.xml'), xml);
  console.log(`[sitemap] wrote public/sitemap.xml (${urls.length} entries)`);
}

main().catch((err) => {
  console.error('[sitemap] failed:', err);
  process.exit(1);
});
