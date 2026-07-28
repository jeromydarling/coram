/**
 * contentGraph — Structured relationships between CROS™ narrative pages.
 *
 * WHAT: Defines connections between roles, archetypes, week stories, and philosophy pages.
 * WHERE: Used by RelatedNarrativesCard and NarrativeLinks for auto-linking.
 * WHY: Creates an interconnected discovery system for SEO authority without manual editing.
 */

export interface ContentNode {
  path: string;
  title: string;
  subtitle?: string;
  category: 'role' | 'archetype' | 'week' | 'philosophy' | 'adoption' | 'concept';
  roles?: string[];
  archetypes?: string[];
  related: string[];
}

export const CONTENT_GRAPH: Record<string, ContentNode> = {
  // Roles
  '/roles': {
    path: '/roles',
    title: 'Roles in CROS™',
    subtitle: 'Shepherd · Companion · Visitor · Steward',
    category: 'role',
    related: ['/week/shepherd', '/week/community-companion', '/week/catholic-visitor', '/week/steward', '/manifesto'],
  },
  '/path/shepherd': {
    path: '/path/shepherd',
    title: 'The Shepherd Pathway',
    category: 'role',
    roles: ['shepherd'],
    related: ['/week/shepherd', '/roles', '/manifesto'],
  },
  '/path/companion': {
    path: '/path/companion',
    title: 'The Companion Pathway',
    category: 'role',
    roles: ['companion'],
    related: ['/week/community-companion', '/roles', '/nri'],
  },
  '/path/visitor': {
    path: '/path/visitor',
    title: 'The Visitor Pathway',
    category: 'role',
    roles: ['visitor'],
    related: ['/week/catholic-visitor', '/roles', '/archetypes'],
  },
  '/path/steward': {
    path: '/path/steward',
    title: 'The Steward Pathway',
    category: 'role',
    roles: ['steward'],
    related: ['/week/steward', '/roles', '/nri'],
  },

  // Week stories
  '/week/catholic-visitor': {
    path: '/week/catholic-visitor',
    title: 'A Week as a Visitor',
    subtitle: 'Parish visiting with presence',
    category: 'week',
    roles: ['visitor'],
    archetypes: ['church'],
    related: ['/roles', '/archetypes', '/nri', '/path/visitor', '/week/shepherd'],
  },
  '/week/shepherd': {
    path: '/week/shepherd',
    title: 'A Week as a Shepherd',
    subtitle: 'Holding the longer story',
    category: 'week',
    roles: ['shepherd'],
    related: ['/roles', '/path/shepherd', '/manifesto', '/week/steward', '/week/community-companion'],
  },
  '/week/steward': {
    path: '/week/steward',
    title: 'A Week as a Steward',
    subtitle: 'Making the work easier for others',
    category: 'week',
    roles: ['steward'],
    related: ['/roles', '/path/steward', '/week/shepherd', '/nri'],
  },
  '/week/social-outreach': {
    path: '/week/social-outreach',
    title: 'A Week in Social Outreach',
    subtitle: 'Nonprofit teams in the field',
    category: 'week',
    roles: ['visitor', 'companion'],
    archetypes: ['social_enterprise', 'workforce'],
    related: ['/roles', '/archetypes', '/week/community-companion', '/nri'],
  },
  '/week/community-companion': {
    path: '/week/community-companion',
    title: 'A Week as a Companion',
    subtitle: 'Walking alongside people',
    category: 'week',
    roles: ['companion'],
    related: ['/roles', '/path/companion', '/week/catholic-visitor', '/week/social-outreach'],
  },

  // Philosophy
  '/manifesto': {
    path: '/manifesto',
    title: 'The CROS™ Manifesto',
    subtitle: 'Why we built this',
    category: 'philosophy',
    related: ['/nri', '/roles', '/archetypes', '/week/shepherd'],
  },
  '/nri': {
    path: '/nri',
    title: 'Narrative Relational Intelligence',
    subtitle: 'Intelligence that belongs to humans',
    category: 'philosophy',
    related: ['/manifesto', '/roles', '/week/social-outreach', '/week/shepherd'],
  },

  // Archetypes
  '/archetypes': {
    path: '/archetypes',
    title: 'Mission Archetypes',
    subtitle: 'Find your mission pattern',
    category: 'archetype',
    related: ['/roles', '/mission-atlas', '/week/catholic-visitor', '/week/social-outreach', '/manifesto'],
  },

  // Mission Atlas
  '/mission-atlas': {
    path: '/mission-atlas',
    title: 'Mission Atlas™',
    subtitle: 'The living map of mission',
    category: 'concept',
    related: ['/archetypes', '/roles', '/nri', '/manifesto', '/lexicon'],
  },

  // Lexicon
  '/lexicon': {
    path: '/lexicon',
    title: 'The CROS Lexicon™',
    subtitle: 'The language of living mission',
    category: 'concept',
    related: ['/nri', '/roles', '/archetypes', '/mission-atlas', '/field-journal'],
  },

  // Field Journal
  '/field-journal': {
    path: '/field-journal',
    title: 'The Living Field Journal',
    subtitle: 'Field notes from living mission',
    category: 'philosophy',
    related: ['/lexicon', '/archetypes', '/mission-atlas', '/authority', '/nri'],
  },

  // Authority Hub
  '/authority': {
    path: '/authority',
    title: 'Authority Hub',
    subtitle: 'Knowledge for living mission',
    category: 'concept',
    related: ['/field-journal', '/lexicon', '/archetypes', '/roles', '/nri'],
  },
};

/**
 * Get related content nodes for a given path, limited to `max` items.
 */
export function getRelatedContent(path: string, max = 4): ContentNode[] {
  const node = CONTENT_GRAPH[path];
  if (!node) return [];
  return node.related
    .map((r) => CONTENT_GRAPH[r])
    .filter(Boolean)
    .slice(0, max);
}

/**
 * Get all nodes matching a category.
 */
export function getNodesByCategory(category: ContentNode['category']): ContentNode[] {
  return Object.values(CONTENT_GRAPH).filter((n) => n.category === category);
}
