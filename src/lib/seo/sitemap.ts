/**
 * Sitemap generator — produces XML sitemap for marketing routes.
 *
 * WHAT: Generates /sitemap.xml content for search engine crawlers.
 * WHERE: Called by SitemapRoute component rendered at /sitemap.xml.
 * WHY: Ensures all public marketing pages are discoverable by crawlers.
 */

import { insights } from '@/content/insights';
import { stories } from '@/content/stories';
import { archetypeComparisons } from '@/content/archetypeComparisons';
import { roleGuides } from '@/content/roleGuides';
import { roleStories } from '@/content/roleStories';

const SITE_URL = 'https://thecros.app';

const staticRoutes = [
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

export function generateSitemapXml(): string {
  const today = new Date().toISOString().split('T')[0];

  const urls = [
    ...staticRoutes.map(
      (r) =>
        `  <url>\n    <loc>${SITE_URL}${r.path}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>${r.changefreq}</changefreq>\n    <priority>${r.priority}</priority>\n  </url>`,
    ),
    ...insights.map(
      (i) =>
        `  <url>\n    <loc>${SITE_URL}/insights/${i.slug}</loc>\n    <lastmod>${i.datePublished}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.7</priority>\n  </url>`,
    ),
    ...stories.map(
      (s) =>
        `  <url>\n    <loc>${SITE_URL}/stories/${s.slug}</loc>\n    <lastmod>${s.datePublished}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.7</priority>\n  </url>`,
    ),
    ...archetypeComparisons.map(
      (c) =>
        `  <url>\n    <loc>${SITE_URL}/compare/${c.slug}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.7</priority>\n  </url>`,
    ),
    ...roleGuides.map(
      (g) =>
        `  <url>\n    <loc>${SITE_URL}/roles/${g.role}/${g.slug}</loc>\n    <lastmod>${g.datePublished}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.6</priority>\n  </url>`,
    ),
    ...roleStories.map(
      (s) =>
        `  <url>\n    <loc>${SITE_URL}/stories/roles/${s.slug}</loc>\n    <lastmod>${s.datePublished}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.7</priority>\n  </url>`,
    ),
  ];

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>`;
}
