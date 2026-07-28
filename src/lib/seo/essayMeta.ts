/**
 * essayMeta — SEO metadata builder for Essay and Library pages.
 *
 * WHAT: Generates meta tags and JSON-LD for narrative content.
 * WHERE: Used by EssayPage and LibraryPage components.
 * WHY: Industry-standard SEO without compromising narrative tone.
 */
import { brand } from '@/config/brand';

const SITE_URL = `https://${brand.domain}`;

export interface EssayMeta {
  title: string;
  description: string;
  canonical: string;
  image?: string;
  publishedAt?: string;
  updatedAt?: string;
  voice_origin?: 'nri' | 'operator' | 'tenant';
  collection?: string;
}

export function buildEssayMeta(input: EssayMeta) {
  const fullTitle = input.title.length > 55
    ? input.title.slice(0, 55) + '…'
    : input.title;
  const seoTitle = `${fullTitle} — CROS™`;

  return {
    title: seoTitle,
    description: input.description.slice(0, 155),
    canonical: `${SITE_URL}${input.canonical}`,
    ogImage: input.image || `${SITE_URL}/og-image.png`,
    publishedAt: input.publishedAt,
    updatedAt: input.updatedAt,
  };
}

export function essayJsonLd(input: EssayMeta) {
  const authorName = input.voice_origin === 'nri'
    ? 'CROS Narrative Intelligence (NRI™)'
    : brand.appName;

  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: input.title,
    description: input.description,
    url: `${SITE_URL}${input.canonical}`,
    datePublished: input.publishedAt || new Date().toISOString(),
    dateModified: input.updatedAt || input.publishedAt || new Date().toISOString(),
    author: { '@type': 'Organization', name: authorName, url: SITE_URL },
    publisher: { '@type': 'Organization', name: brand.appName, url: SITE_URL },
    mainEntityOfPage: { '@type': 'WebPage', '@id': `${SITE_URL}${input.canonical}` },
  };
}

export function essayBreadcrumbJsonLd(items: { name: string; url: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: `${SITE_URL}${item.url}`,
    })),
  };
}
