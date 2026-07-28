/**
 * communioResonance — Resonance computation for community-shaped discovery.
 *
 * WHAT: Computes soft resonance scores for search results based on cross-tenant patterns.
 * WHERE: Used internally by perplexity-search and FindPage result rendering.
 * WHY: Discovery evolves through communal discernment, not algorithmic optimization.
 *       Resonance signals are never shown as scores or rankings.
 */

// ── Types ──

export interface ResonanceSnapshot {
  archetype_key: string;
  metro_id: string | null;
  search_type: string;
  resonant_keywords: string[];
  signal_count: number;
  tenant_count: number;
  testimonium_themes: string[];
  communio_participation_count: number;
}

export interface ResonanceContext {
  archetypeKeywords: string[];
  metroKeywords: string[];
  testimoniumThemes: string[];
  communioActive: boolean;
  totalSignals: number;
  totalTenants: number;
}

export interface ResultResonance {
  score: number; // 0-1, internal only — never shown to users
  annotation: string | null; // calm, human language or null
  matchedThemes: string[];
}

// ── Calm annotation phrases — rotated, never scored ──

const RESONANCE_PHRASES = [
  'Quietly resonating across similar missions.',
  'You may find this meaningful.',
  'Others on a similar path noticed this too.',
  'This theme echoes across your community.',
  'A gentle signal from kindred organizations.',
  'Resonating within your mission family.',
];

function pickPhrase(seed: number): string {
  return RESONANCE_PHRASES[seed % RESONANCE_PHRASES.length];
}

// ── Core computation ──

/**
 * Build resonance context from snapshots matching the tenant's archetype + metro.
 */
export function buildResonanceContext(
  snapshots: ResonanceSnapshot[],
): ResonanceContext {
  if (!snapshots.length) {
    return {
      archetypeKeywords: [],
      metroKeywords: [],
      testimoniumThemes: [],
      communioActive: false,
      totalSignals: 0,
      totalTenants: 0,
    };
  }

  const archetypeKws = new Set<string>();
  const metroKws = new Set<string>();
  const themes = new Set<string>();
  let totalSignals = 0;
  let totalTenants = 0;
  let communioActive = false;

  for (const snap of snapshots) {
    for (const kw of snap.resonant_keywords) archetypeKws.add(kw);
    if (snap.metro_id) {
      for (const kw of snap.resonant_keywords) metroKws.add(kw);
    }
    for (const theme of snap.testimonium_themes) themes.add(theme);
    totalSignals += snap.signal_count;
    totalTenants += snap.tenant_count;
    if (snap.communio_participation_count > 0) communioActive = true;
  }

  return {
    archetypeKeywords: [...archetypeKws],
    metroKeywords: [...metroKws],
    testimoniumThemes: [...themes],
    communioActive,
    totalSignals,
    totalTenants,
  };
}

/**
 * Compute resonance for a single search result.
 *
 * Weights:
 * - Archetype keyword match: 0.3
 * - Metro keyword match: 0.2
 * - Testimonium theme overlap: 0.3
 * - Communio participation presence: 0.2
 *
 * Score is internal-only. Annotation is shown only above threshold (0.3).
 */
export function computeResultResonance(
  resultText: string,
  context: ResonanceContext,
  resultIndex: number,
): ResultResonance {
  if (!resultText || (!context.archetypeKeywords.length && !context.testimoniumThemes.length)) {
    return { score: 0, annotation: null, matchedThemes: [] };
  }

  const lower = resultText.toLowerCase();

  // Archetype proximity
  const archetypeMatches = context.archetypeKeywords.filter(kw => lower.includes(kw.toLowerCase()));
  const archetypeScore = context.archetypeKeywords.length > 0
    ? Math.min(archetypeMatches.length / Math.max(context.archetypeKeywords.length, 1), 1) * 0.3
    : 0;

  // Metro proximity
  const metroMatches = context.metroKeywords.filter(kw => lower.includes(kw.toLowerCase()));
  const metroScore = context.metroKeywords.length > 0
    ? Math.min(metroMatches.length / Math.max(context.metroKeywords.length, 1), 1) * 0.2
    : 0;

  // Testimonium thematic overlap
  const themeMatches = context.testimoniumThemes.filter(t => lower.includes(t.toLowerCase()));
  const themeScore = context.testimoniumThemes.length > 0
    ? Math.min(themeMatches.length / Math.max(context.testimoniumThemes.length, 1), 1) * 0.3
    : 0;

  // Communio participation (binary boost)
  const communioScore = context.communioActive ? 0.2 : 0;

  const score = Math.min(archetypeScore + metroScore + themeScore + communioScore, 1);

  // Only annotate above threshold — never reveal scores
  const annotation = score >= 0.3 ? pickPhrase(resultIndex) : null;

  return {
    score,
    annotation,
    matchedThemes: [...new Set([...archetypeMatches, ...metroMatches, ...themeMatches])],
  };
}

/**
 * Sort results by resonance score (descending) while preserving relative order
 * for results with similar scores (within 0.1 tolerance).
 * This creates a "soft reorder" — resonant items float up gently.
 */
export function softReorderByResonance<T extends { resonanceScore?: number }>(
  results: T[],
): T[] {
  return [...results].sort((a, b) => {
    const scoreA = a.resonanceScore ?? 0;
    const scoreB = b.resonanceScore ?? 0;
    const diff = scoreB - scoreA;
    // Only reorder if meaningful difference (> 0.1)
    return Math.abs(diff) > 0.1 ? diff : 0;
  });
}
