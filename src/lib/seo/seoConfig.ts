/**
 * SEO Configuration Engine for CROS™ Marketing Site
 *
 * WHAT: Centralised meta-tag builder + JSON-LD schema generators.
 * WHERE: Imported by every marketing page via <SeoHead />.
 * WHY: Consistent, crawlable SEO without scattering meta logic across pages.
 */

import { brand } from '@/config/brand';

const SITE_URL = `https://${brand.domain}`;
const DEFAULT_OG_IMAGE = `${SITE_URL}/og-image.png`;

export interface SeoMeta {
  title: string;
  description: string;
  keywords?: string[];
  canonical?: string;
  ogImage?: string;
  ogType?: string;
  noIndex?: boolean;
}

/** Build a full set of document-head values from a compact input. */
export function buildMeta(input: SeoMeta) {
  const fullTitle = input.title.includes('CROS')
    ? input.title
    : `${input.title} — CROS™`;
  const canonical = input.canonical
    ? `${SITE_URL}${input.canonical}`
    : undefined;

  return {
    title: fullTitle,
    description: input.description,
    keywords: input.keywords?.join(', ') ?? '',
    canonical,
    ogTitle: fullTitle,
    ogDescription: input.description,
    ogImage: input.ogImage ?? DEFAULT_OG_IMAGE,
    ogType: input.ogType ?? 'website',
    noIndex: input.noIndex ?? false,
  };
}

/* ─── JSON-LD helpers ────────────────────────────── */

export function articleSchema(opts: {
  headline: string;
  description: string;
  url: string;
  datePublished?: string;
  author?: string;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: opts.headline,
    description: opts.description,
    url: `${SITE_URL}${opts.url}`,
    datePublished: opts.datePublished ?? new Date().toISOString(),
    author: {
      '@type': 'Organization',
      name: brand.appName,
      url: SITE_URL,
    },
    publisher: {
      '@type': 'Organization',
      name: brand.appName,
      url: SITE_URL,
    },
  };
}

export function faqSchema(
  items: { question: string; answer: string }[],
) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((i) => ({
      '@type': 'Question',
      name: i.question,
      acceptedAnswer: { '@type': 'Answer', text: i.answer },
    })),
  };
}

export function productSchema(opts: {
  name: string;
  description: string;
  url: string;
  price?: string;
  priceCurrency?: string;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: opts.name,
    description: opts.description,
    url: `${SITE_URL}${opts.url}`,
    brand: { '@type': 'Brand', name: brand.appName },
    ...(opts.price && {
      offers: {
        '@type': 'Offer',
        price: opts.price,
        priceCurrency: opts.priceCurrency ?? 'USD',
        availability: 'https://schema.org/InStock',
      },
    }),
  };
}

export function techArticleSchema(opts: {
  headline: string;
  description: string;
  url: string;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'TechArticle',
    headline: opts.headline,
    description: opts.description,
    url: `${SITE_URL}${opts.url}`,
    author: { '@type': 'Organization', name: brand.appName, url: SITE_URL },
    publisher: { '@type': 'Organization', name: brand.appName, url: SITE_URL },
  };
}

export function breadcrumbSchema(
  items: { name: string; url: string }[],
) {
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

export { SITE_URL };
