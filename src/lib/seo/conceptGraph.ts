/**
 * Concept Graph — Semantic relationship map for CROS marketing concepts.
 *
 * WHAT: Registry of platform concepts with slugs, labels, definitions, and relationships.
 * WHERE: Powers internal linking suggestions, glossary auto-linking, and schema generation.
 * WHY: Builds semantic authority by connecting concepts across the marketing site.
 */

export interface Concept {
  slug: string;
  label: string;
  definition: string;
  route?: string;
  related: string[];
}

export const CONCEPTS: Concept[] = [
  {
    slug: 'nri',
    label: 'Narrative Relational Intelligence',
    definition: 'Human-first intelligence built from reflections, events, conversations, and community signals. NRI recognizes meaning - not just data.',
    route: '/nri',
    related: ['cros', 'testimonium', 'roles', 'signum'],
  },
  {
    slug: 'cros',
    label: 'Communal Relationship Operating System',
    definition: 'The bridge between an organization and the community it serves. A living relationship system that remembers people and notices what is changing.',
    route: '/cros',
    related: ['nri', 'profunda', 'communio', 'civitas'],
  },
  {
    slug: 'profunda',
    label: 'Profunda',
    definition: 'The relationship memory engine - contacts, journeys, reflections, and the quiet record of human connection over time.',
    route: '/profunda',
    related: ['cros', 'nri', 'impulsus'],
  },
  {
    slug: 'shepherd',
    label: 'Shepherd',
    definition: 'The role that carries the vision and holds the story of a community. Shepherds guide the mission and notice patterns across people and time.',
    route: '/roles/shepherd',
    related: ['roles', 'companion', 'visitor', 'nri'],
  },
  {
    slug: 'companion',
    label: 'Companion',
    definition: 'The role that walks alongside people, keeping the thread of care unbroken through follow-ups, reflections, and relationship tasks.',
    route: '/roles/companion',
    related: ['roles', 'shepherd', 'visitor', 'voluntarium'],
  },
  {
    slug: 'visitor',
    label: 'Visitor',
    definition: 'The role that shows up where life happens - homes, events, neighborhoods - and captures moments with voice notes instead of forms.',
    route: '/roles/visitor',
    related: ['roles', 'shepherd', 'companion'],
  },
  {
    slug: 'roles',
    label: 'Roles',
    definition: 'The three human identities in CROS: Shepherd, Companion, and Visitor. Each shapes how the system adapts to your work.',
    route: '/roles',
    related: ['shepherd', 'companion', 'visitor'],
  },
  {
    slug: 'communio',
    label: 'Communio',
    definition: 'The opt-in shared narrative network. Organizations connect for community awareness without sharing private data.',
    route: '/communio-feature',
    related: ['cros', 'civitas', 'signum'],
  },
  {
    slug: 'testimonium',
    label: 'Testimonium',
    definition: 'The narrative storytelling and insight layer. Drift detection, story signals, and heat map overlays that reveal community patterns.',
    route: '/testimonium-feature',
    related: ['nri', 'signum', 'impulsus'],
  },
  {
    slug: 'impulsus',
    label: 'Impulsus',
    definition: 'A private impact scrapbook journal. Personal narrative space for capturing moments of meaning in daily work.',
    route: '/impulsus',
    related: ['testimonium', 'profunda'],
  },
  {
    slug: 'signum',
    label: 'Signum',
    definition: 'The signal intelligence layer. Monitors local news, community events, and trusted sources to surface what is changing.',
    route: '/signum',
    related: ['nri', 'civitas', 'testimonium'],
  },
  {
    slug: 'civitas',
    label: 'Civitas',
    definition: 'The community layer - metros, local pulse, and narrative awareness across the places your organization serves.',
    related: ['cros', 'signum', 'communio'],
  },
  {
    slug: 'relatio',
    label: 'Relatio',
    definition: 'Integration and migration bridges. Connect existing tools or migrate from legacy CRMs without losing relationship history.',
    route: '/relatio-campaigns',
    related: ['cros', 'profunda'],
  },
  {
    slug: 'voluntarium',
    label: 'Voluntarium',
    definition: 'Volunteer management and hours tracking. Honor the people who show up by remembering their service.',
    route: '/voluntarium',
    related: ['companion', 'cros'],
  },
  {
    slug: 'provisio',
    label: 'Provisio',
    definition: 'Technology provisions and equipment orders. Manage the tools your team needs to do their work.',
    route: '/provisio',
    related: ['cros'],
  },
];

/** Look up a concept by slug */
export function getConcept(slug: string): Concept | undefined {
  return CONCEPTS.find((c) => c.slug === slug);
}

/** Get related concepts for a given slug */
export function getRelatedConcepts(slug: string): Concept[] {
  const concept = getConcept(slug);
  if (!concept) return [];
  return concept.related
    .map((r) => getConcept(r))
    .filter((c): c is Concept => !!c);
}

/** Get concepts that link to a given route */
export function getConceptsForRoute(route: string): Concept[] {
  return CONCEPTS.filter((c) => c.route === route);
}
