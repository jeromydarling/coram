/**
 * narrativeSEO — Narrative SEO Engine for CROS™.
 *
 * WHAT: Generates structured SEO metadata (JSON-LD, OG, Twitter, keywords, alt text, email preview)
 *       from narrative page context — automatically and systemically.
 * WHERE: Used by Living Library essays, archetype pages, marketing surfaces.
 * WHY: SEO authority through mission language and narrative integrity, not marketing spam.
 */

import { brand } from '@/config/brand';
import { generateSemanticKeywords, type KeywordContext } from './semanticKeywords';
import { generateAltTextFromNarrative } from './altText';
import { generateEmailPreview, type EmailPreviewOutput } from './emailPreview';

const SITE_URL = `https://${brand.domain}`;

export interface NarrativeSEOInput {
  title: string;
  summary: string;
  canonical: string;
  archetype?: string;
  reflectionText?: string;
  publishDate?: string;
  updatedDate?: string;
  voiceOrigin?: 'nri' | 'operator' | 'tenant';
  essayType?: string;
  collection?: string;
  ogImage?: string;
  /** Page type for keyword clustering. */
  pageType?: KeywordContext['pageType'];
  /** Sections with images for alt text generation. */
  imageSections?: { heading: string; snippet?: string }[];
}

export interface NarrativeSEOOutput {
  schemaJSONLD: Record<string, unknown>[];
  ogMeta: {
    title: string;
    description: string;
    image: string;
    type: string;
    url: string;
  };
  twitterMeta: {
    card: string;
    title: string;
    description: string;
    image: string;
  };
  altTextMap: Record<string, string>;
  semanticKeywords: string[];
  emailPreview: EmailPreviewOutput;
  canonical: string;
}

/**
 * Master generator — produces all SEO artifacts from a single narrative context.
 */
export function generateNarrativeSEO(input: NarrativeSEOInput): NarrativeSEOOutput {
  const fullUrl = `${SITE_URL}${input.canonical}`;
  const ogImage = input.ogImage || `${SITE_URL}/og-image.png`;
  const description = input.summary.slice(0, 155);

  // Truncate title for SEO
  const seoTitle = input.title.length > 55
    ? `${input.title.slice(0, 55)}… — CROS™`
    : `${input.title} — CROS™`;

  // ─── JSON-LD schemas ───
  const authorName = input.voiceOrigin === 'nri'
    ? 'CROS Narrative Intelligence (NRI™)'
    : brand.appName;

  const articleSchema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: input.title,
    description,
    url: fullUrl,
    datePublished: input.publishDate || new Date().toISOString(),
    dateModified: input.updatedDate || input.publishDate || new Date().toISOString(),
    author: { '@type': 'Organization', name: authorName, url: SITE_URL },
    publisher: { '@type': 'Organization', name: brand.appName, url: SITE_URL },
    mainEntityOfPage: { '@type': 'WebPage', '@id': fullUrl },
    keywords: generateSemanticKeywords({
      archetype: input.archetype,
      bodyText: input.reflectionText,
      pageType: input.pageType,
    }).join(', '),
  };

  const orgSchema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: brand.appName,
    url: SITE_URL,
    description: brand.positioning,
  };

  const breadcrumbSchema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Essays', item: `${SITE_URL}/essays` },
      { '@type': 'ListItem', position: 3, name: input.title, item: fullUrl },
    ],
  };

  const schemas = [articleSchema, orgSchema, breadcrumbSchema];

  // ─── Semantic keywords ───
  const semanticKeywords = generateSemanticKeywords({
    archetype: input.archetype,
    bodyText: input.reflectionText,
    pageType: input.pageType,
  });

  // ─── Alt text map ───
  const altTextMap: Record<string, string> = {};
  if (input.imageSections) {
    for (const sec of input.imageSections) {
      altTextMap[sec.heading] = generateAltTextFromNarrative(sec.heading, sec.snippet);
    }
  }

  // ─── Email preview ───
  const emailPreview = generateEmailPreview({
    title: input.title,
    summary: input.summary,
    bodySnippet: input.reflectionText?.slice(0, 200),
    voiceOrigin: input.voiceOrigin,
    essayType: input.essayType,
  });

  return {
    schemaJSONLD: schemas,
    ogMeta: {
      title: seoTitle,
      description,
      image: ogImage,
      type: 'article',
      url: fullUrl,
    },
    twitterMeta: {
      card: 'summary_large_image',
      title: seoTitle,
      description,
      image: ogImage,
    },
    altTextMap,
    semanticKeywords,
    emailPreview,
    canonical: fullUrl,
  };
}
