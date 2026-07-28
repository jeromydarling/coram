/**
 * librarySeo — SEO metadata generator for Living Library essays.
 *
 * WHAT: Generates seo_title, seo_description, schema_json, canonical_url from library_essays.
 * WHERE: Used by the essay publish flow and public essay rendering.
 * WHY: Ensures published essays have rich, CROS-branded SEO without manual effort.
 */
import { brand } from '@/config/brand';
import { generateSemanticKeywords } from '@/lib/narrativeSEO/semanticKeywords';

const SITE_URL = `https://${brand.domain}`;

export interface LibraryEssayInput {
  title: string;
  slug: string;
  excerpt?: string;
  content_markdown?: string;
  sector?: string;
  tags?: string[];
  month_key?: string;
  source_type?: string;
  published_at?: string;
  updated_at?: string;
  voice_profile?: string;
}

export interface LibraryEssaySeo {
  seo_title: string;
  seo_description: string;
  canonical_url: string;
  schema_json: Record<string, unknown>;
  meta_robots: string;
  keywords: string[];
}

/**
 * Generate full SEO metadata for a library essay.
 * For drafts, returns noindex. For published, returns full schema.
 */
export function generateLibraryEssaySeo(
  essay: LibraryEssayInput,
  isPublished: boolean
): LibraryEssaySeo {
  const truncTitle = essay.title.length > 55
    ? `${essay.title.slice(0, 55)}…`
    : essay.title;
  const seoTitle = `${truncTitle} — CROS™ Living Library`;
  const seoDescription = (essay.excerpt || essay.content_markdown?.replace(/[#*_\n]/g, ' ').slice(0, 155) || '').slice(0, 155);
  const canonicalUrl = `/library/${essay.slug}`;

  const keywords = generateSemanticKeywords({
    bodyText: essay.content_markdown,
    pageType: 'essay',
  });

  const authorName = essay.voice_profile === 'cros_default'
    ? 'CROS Narrative Intelligence (NRI™)'
    : brand.appName;

  const schemaJson: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: essay.title,
    description: seoDescription,
    url: `${SITE_URL}${canonicalUrl}`,
    datePublished: essay.published_at || new Date().toISOString(),
    dateModified: essay.updated_at || essay.published_at || new Date().toISOString(),
    author: { '@type': 'Organization', name: authorName, url: SITE_URL },
    publisher: { '@type': 'Organization', name: brand.appName, url: SITE_URL },
    mainEntityOfPage: { '@type': 'WebPage', '@id': `${SITE_URL}${canonicalUrl}` },
    keywords: keywords.join(', '),
    isPartOf: {
      '@type': 'CollectionPage',
      name: 'CROS™ Living Library',
      url: `${SITE_URL}/library`,
    },
  };

  if (essay.month_key) {
    schemaJson.temporalCoverage = essay.month_key;
  }

  return {
    seo_title: seoTitle,
    seo_description: seoDescription,
    canonical_url: canonicalUrl,
    schema_json: schemaJson,
    meta_robots: isPublished ? 'index,follow' : 'noindex,nofollow',
    keywords,
  };
}
