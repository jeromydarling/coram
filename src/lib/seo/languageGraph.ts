/**
 * languageGraph — Structured JSON-LD generators for CROS™ civic ontology.
 *
 * WHAT: Generates schema.org DefinedTerm and ItemList JSON-LD for semantic pages.
 * WHERE: Injected into Library, Calling, and Pathway pages via SeoHead.
 * WHY: Establishes CROS™ as an ontology source for civic relationship language.
 */

import { brand } from '@/config/brand';

const SITE_URL = `https://${brand.domain}`;

export function definedTermSchema(opts: {
  name: string;
  description: string;
  url: string;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'DefinedTerm',
    name: opts.name,
    description: opts.description,
    url: `${SITE_URL}${opts.url}`,
    inDefinedTermSet: {
      '@type': 'DefinedTermSet',
      name: 'CROS Civic Language',
      url: `${SITE_URL}/library`,
    },
  };
}

export function itemListSchema(opts: {
  name: string;
  description: string;
  url: string;
  items: { name: string; url: string }[];
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: opts.name,
    description: opts.description,
    url: `${SITE_URL}${opts.url}`,
    numberOfItems: opts.items.length,
    itemListElement: opts.items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      url: `${SITE_URL}${item.url}`,
    })),
  };
}

export function civicActionSchema(opts: {
  name: string;
  description: string;
  url: string;
  agent?: string;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Action',
    name: opts.name,
    description: opts.description,
    url: `${SITE_URL}${opts.url}`,
    agent: {
      '@type': 'Organization',
      name: opts.agent ?? brand.appName,
      url: SITE_URL,
    },
  };
}
