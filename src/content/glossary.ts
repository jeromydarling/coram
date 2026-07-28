/**
 * Glossary — Platform term definitions for auto-linking and schema generation.
 *
 * WHAT: Canonical definitions of all CROS platform terms.
 * WHERE: Powers GlossaryAutoLink component and DefinedTerm JSON-LD schema.
 * WHY: Builds semantic authority by consistently defining terms for crawlers and users.
 */

export interface GlossaryEntry {
  term: string;
  slug: string;
  definition: string;
  route?: string;
}

export const glossary: GlossaryEntry[] = [
  {
    term: 'NRI',
    slug: 'nri',
    definition: 'Narrative Relational Intelligence - human-first intelligence built from reflections, events, conversations, and community signals.',
    route: '/nri',
  },
  {
    term: 'CROS',
    slug: 'cros',
    definition: 'Communal Relationship Operating System - a living relationship system that remembers people and notices community shifts.',
    route: '/cros',
  },
  {
    term: 'Profunda',
    slug: 'profunda',
    definition: 'The relationship memory engine - contacts, journeys, reflections, and the quiet record of human connection.',
    route: '/profunda',
  },
  {
    term: 'Communio',
    slug: 'communio',
    definition: 'The opt-in shared narrative network connecting organizations for community awareness without sharing private data.',
    route: '/communio-feature',
  },
  {
    term: 'Relatio',
    slug: 'relatio',
    definition: 'Integration and migration bridges connecting existing tools or migrating from legacy CRMs.',
    route: '/relatio-campaigns',
  },
  {
    term: 'Testimonium',
    slug: 'testimonium',
    definition: 'The narrative storytelling and insight layer with drift detection, story signals, and heat map overlays.',
    route: '/testimonium-feature',
  },
  {
    term: 'Impulsus',
    slug: 'impulsus',
    definition: 'A private impact scrapbook journal for capturing moments of meaning in daily work.',
    route: '/impulsus',
  },
  {
    term: 'Voluntarium',
    slug: 'voluntarium',
    definition: 'Volunteer management and hours tracking - honoring the people who show up by remembering their service.',
    route: '/voluntarium',
  },
  {
    term: 'Civitas',
    slug: 'civitas',
    definition: 'The community layer - metros, local pulse, and narrative awareness across the places your organization serves.',
  },
  {
    term: 'Signum',
    slug: 'signum',
    definition: 'The signal intelligence layer monitoring local news, community events, and trusted sources.',
    route: '/signum',
  },
  {
    term: 'Provisio',
    slug: 'provisio',
    definition: 'Technology provisions and equipment orders for your team.',
    route: '/provisio',
  },
  {
    term: 'Gardener',
    slug: 'gardener',
    definition: 'The person tending the wider ecosystem of CROS. A Gardener watches patterns across communities, supports growth, and helps the network remain healthy.',
  },
];

/** Generate JSON-LD DefinedTermSet schema for the glossary */
export function glossarySchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'DefinedTermSet',
    name: 'CROS Platform Glossary',
    description: 'Definitions of key concepts in the Communal Relationship Operating System.',
    hasDefinedTerm: glossary.map((entry) => ({
      '@type': 'DefinedTerm',
      name: entry.term,
      description: entry.definition,
      ...(entry.route && { url: `https://thecros.app${entry.route}` }),
    })),
  };
}
