/**
 * semanticKeywords — CROS™ ontology-aligned keyword clusters.
 *
 * WHAT: Generates semantic keyword sets from narrative context, drawn from CROS vocabulary.
 * WHERE: Used by narrativeSEO.ts to populate meta keywords and JSON-LD.
 * WHY: SEO authority through mission language — never generic CRM phrasing.
 */

import type { ArchetypeKey } from '@/config/brand';

/** Core ontology terms — always relevant. */
const CORE_TERMS = [
  'relationship operating system',
  'narrative relational intelligence',
  'community stewardship',
  'mission-centered technology',
  'human-centered nonprofit tools',
];

/** Archetype-specific keyword clusters. */
const ARCHETYPE_CLUSTERS: Record<string, string[]> = {
  church: [
    'parish relationship management',
    'faith community engagement',
    'church visitor follow-up',
    'ministry stewardship tools',
  ],
  digital_inclusion: [
    'digital equity community tools',
    'digital inclusion program management',
    'broadband adoption tracking',
  ],
  social_enterprise: [
    'social enterprise community tools',
    'mission-driven business relationships',
    'impact measurement storytelling',
  ],
  workforce: [
    'workforce development relationships',
    'employer engagement tracking',
    'career pathway community tools',
  ],
  refugee_support: [
    'refugee resettlement coordination',
    'newcomer community support tools',
    'immigrant integration management',
  ],
  education_access: [
    'education access program tools',
    'equitable learning community management',
    'student relationship stewardship',
  ],
  library_system: [
    'library community engagement',
    'public library outreach tools',
    'library patron relationship management',
  ],
};

/** Topic-aware keyword enrichment based on body content signals. */
const TOPIC_SIGNALS: [RegExp, string][] = [
  [/volunteer/i, 'volunteer coordination tools'],
  [/reflection/i, 'community reflection practices'],
  [/journey/i, 'relationship journey mapping'],
  [/steward/i, 'community stewardship'],
  [/companion/i, 'accompaniment-based outreach'],
  [/shepherd/i, 'pastoral leadership tools'],
  [/pulse|signal/i, 'community signal awareness'],
  [/narrative/i, 'narrative intelligence for nonprofits'],
  [/drift/i, 'relationship drift detection'],
  [/communio/i, 'cross-organization collaboration'],
];

export interface KeywordContext {
  archetype?: ArchetypeKey | string;
  bodyText?: string;
  pageType?: 'essay' | 'archetype' | 'role' | 'manifesto' | 'lexicon' | 'atlas';
}

/**
 * Returns a deduplicated set of semantic keywords (max 12) for a page.
 */
export function generateSemanticKeywords(ctx: KeywordContext): string[] {
  const kw = new Set<string>(CORE_TERMS.slice(0, 3));

  // Archetype cluster
  if (ctx.archetype && ARCHETYPE_CLUSTERS[ctx.archetype]) {
    for (const term of ARCHETYPE_CLUSTERS[ctx.archetype]) kw.add(term);
  }

  // Topic signals from body text
  if (ctx.bodyText) {
    for (const [re, term] of TOPIC_SIGNALS) {
      if (re.test(ctx.bodyText)) kw.add(term);
    }
  }

  // Page-type enrichment
  if (ctx.pageType === 'lexicon') kw.add('civic ontology vocabulary');
  if (ctx.pageType === 'atlas') kw.add('mission geography mapping');
  if (ctx.pageType === 'role') kw.add('nonprofit role pathways');

  return Array.from(kw).slice(0, 12);
}
