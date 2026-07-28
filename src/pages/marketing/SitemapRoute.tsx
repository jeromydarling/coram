/**
 * SitemapRoute — Renders XML sitemap at /sitemap.xml.
 *
 * WHAT: Outputs raw XML sitemap content for search engine crawlers.
 * WHERE: Rendered at /sitemap.xml route.
 * WHY: Client-side sitemap generation for SPA — crawlers receive valid XML.
 */
import { useEffect } from 'react';
import { generateSitemapXml } from '@/lib/seo/sitemap';

export default function SitemapRoute() {
  useEffect(() => {
    const xml = generateSitemapXml();
    const blob = new Blob([xml], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);

    // Replace current document with XML content
    document.open('application/xml');
    document.write(xml);
    document.close();

    return () => URL.revokeObjectURL(url);
  }, []);

  return null;
}
