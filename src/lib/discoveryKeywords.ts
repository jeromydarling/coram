/**
 * discoveryKeywords — Keyword stack builder for CROS discovery personalization.
 *
 * WHAT: Builds a 4-layer keyword stack for Perplexity search augmentation.
 * WHERE: Used by perplexity-search edge function and DiscoveryKeywordPanel.
 * WHY: Human-centered discovery that users understand and control.
 */

import { archetypeConfigs } from '@/config/archetypes';

// ── Layer types ──

export interface DiscoveryKeywordStack {
  global: string[];
  archetype: string[];
  enriched: string[];
  steward: string[];
  finalStack: string[];
}

// ── Global baseline — generic nonprofit + ministry keywords ──

export const GLOBAL_BASELINE: string[] = [
  'nonprofit services',
  'community outreach',
  'faith-based service',
  'local grants',
  'volunteer opportunity',
  'community development',
  'social services',
  'ministry program',
  'civic engagement',
  'community partnership',
  'workforce development',
  'digital inclusion',
  'neighborhood resources',
  'family services',
  'youth program',
];

// ── Stoplist — terms that dilute search quality ──

export const STOPLIST: Set<string> = new Set([
  'free',
  'jobs',
  'donate now',
  'click here',
  'marketing agency',
  'buy now',
  'subscribe',
  'sign up',
  'download',
  'best price',
  'limited time',
  'act now',
  'sale',
  'discount',
  'promo code',
  'ad',
  'sponsored',
  'affiliate',
  'seo',
  'saas',
  'b2b',
  'lead generation',
  'bondage',
  'bondage gear',
  'adult entertainment',
  'adult products',
]);

// ── Synonym map — normalizes common variations ──

export const SYNONYM_MAP: Record<string, string> = {
  'church': 'faith community',
  'congregation': 'faith community',
  'parish': 'faith community',
  'homeless': 'homelessness',
  'unhoused': 'homelessness',
  'esl': 'english language learning',
  'ell': 'english language learning',
  'ged': 'adult education',
  'stem': 'stem education',
  'wifi': 'digital access',
  'broadband': 'digital access',
  'internet access': 'digital access',
  'bonds': 'community bonds',
};

// ── Helpers ──

/** Normalize a keyword: lowercase, trim, apply synonym map */
export function normalizeKeyword(kw: string): string {
  const cleaned = kw.trim().toLowerCase();
  return SYNONYM_MAP[cleaned] || cleaned;
}

/** Check if a keyword is on the stoplist */
export function isStoplisted(kw: string): boolean {
  return STOPLIST.has(kw.trim().toLowerCase());
}

/** Deduplicate and normalize a list of keywords */
export function deduplicateKeywords(keywords: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const kw of keywords) {
    const normalized = normalizeKeyword(kw);
    if (!normalized || normalized.length < 2) continue;
    if (isStoplisted(normalized)) continue;
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }
  return result;
}

/** Cap a layer to max keywords */
export function capLayer(keywords: string[], max = 25): string[] {
  return keywords.slice(0, max);
}

/** Get archetype baseline keywords from config */
export function getArchetypeKeywords(archetypeKey: string | null): string[] {
  if (!archetypeKey) return [];
  const config = archetypeConfigs.find(a => a.key === archetypeKey);
  return config?.defaultKeywords || [];
}

/**
 * Build the full discovery keyword stack for a tenant.
 *
 * @param archetypeKey - The tenant's archetype (e.g., 'church', 'nonprofit_program')
 * @param enrichedKeywords - Keywords extracted from URL enrichment (search_keywords from tenants table)
 * @param stewardKeywords - Keywords manually added by the steward
 * @returns The structured keyword stack with deduplicated finalStack
 */
export function buildDiscoveryKeywordStack(
  archetypeKey: string | null,
  enrichedKeywords: string[] = [],
  stewardKeywords: string[] = [],
): DiscoveryKeywordStack {
  const global = capLayer(deduplicateKeywords(GLOBAL_BASELINE));
  const archetype = capLayer(deduplicateKeywords(getArchetypeKeywords(archetypeKey)));
  const enriched = capLayer(deduplicateKeywords(enrichedKeywords));
  const steward = capLayer(deduplicateKeywords(stewardKeywords));

  // Build final stack: steward > enriched > archetype > global (priority order for dedup)
  const finalStack = deduplicateKeywords([
    ...steward,
    ...enriched,
    ...archetype,
    ...global,
  ]);

  return {
    global,
    archetype,
    enriched,
    steward,
    finalStack,
  };
}

/**
 * Extract matched keywords from a result's title + description against the keyword stack.
 * Used for "Why this appears" transparency.
 */
export function findMatchedKeywords(
  text: string,
  keywordStack: string[],
): string[] {
  if (!text || !keywordStack.length) return [];
  const lower = text.toLowerCase();
  return keywordStack.filter(kw => lower.includes(kw));
}
