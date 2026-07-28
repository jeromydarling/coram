/**
 * kinshipEngine — NRI Kinship Detection for Familia™.
 *
 * WHAT: Deterministic scoring engine that detects organizational kinship patterns.
 * WHERE: Called by background processes or Gardener review surfaces.
 * WHY: Suggests relational connections between tenants without forcing hierarchy.
 *
 * PRIVACY INVARIANTS:
 * - Never reveals private tenant names without mutual public consent
 * - All candidate hints are anonymized by default
 * - Scores are deterministic and archetype-agnostic
 */

export interface KinshipFactors {
  geoProximity: boolean;
  nameSimilarity: number; // 0–1
  archetypeMatch: boolean;
  enrichmentOverlap: string[];
  communioAlignment: boolean;
}

export interface KinshipResult {
  score: number;
  reasons: {
    geo?: boolean;
    name?: boolean;
    archetype_match?: boolean;
    keywords?: string[];
    communio?: boolean;
  };
  candidateHint: string;
}

const WEIGHTS = {
  geo: 0.25,
  name: 0.20,
  archetype: 0.20,
  enrichment: 0.20,
  communio: 0.15,
} as const;

export const KINSHIP_THRESHOLD = 0.72;

/**
 * Compute a deterministic kinship score from factors.
 * All detection is archetype-agnostic — no Catholic or denomination-specific logic.
 */
export function computeKinshipScore(factors: KinshipFactors): KinshipResult {
  let score = 0;
  const reasons: KinshipResult['reasons'] = {};

  if (factors.geoProximity) {
    score += WEIGHTS.geo;
    reasons.geo = true;
  }

  if (factors.nameSimilarity >= 0.6) {
    score += WEIGHTS.name * factors.nameSimilarity;
    reasons.name = true;
  }

  if (factors.archetypeMatch) {
    score += WEIGHTS.archetype;
    reasons.archetype_match = true;
  }

  if (factors.enrichmentOverlap.length >= 2) {
    const enrichmentScore = Math.min(factors.enrichmentOverlap.length / 5, 1);
    score += WEIGHTS.enrichment * enrichmentScore;
    reasons.keywords = factors.enrichmentOverlap.slice(0, 5);
  }

  if (factors.communioAlignment) {
    score += WEIGHTS.communio;
    reasons.communio = true;
  }

  // Build anonymized hint based on strongest signals
  const candidateHint = buildCandidateHint(reasons);

  return {
    score: Math.round(score * 100) / 100,
    reasons,
    candidateHint,
  };
}

/**
 * Build a privacy-safe hint string describing why two orgs may be related.
 * Never includes tenant names, slugs, or identifiable information.
 */
function buildCandidateHint(reasons: KinshipResult['reasons']): string {
  const parts: string[] = [];

  if (reasons.geo) parts.push('nearby');
  if (reasons.name) parts.push('with a similar name');
  if (reasons.archetype_match) parts.push('sharing your mission archetype');
  if (reasons.keywords?.length) parts.push('with shared mission keywords');
  if (reasons.communio) parts.push('active in a similar community network');

  if (parts.length === 0) return 'An organization with possible alignment';

  const joined = parts.length === 1
    ? parts[0]
    : parts.slice(0, -1).join(', ') + ' and ' + parts[parts.length - 1];

  return `An organization ${joined}`;
}

/**
 * Compute name similarity using bigram overlap (Dice coefficient).
 * Metro-toggle safe: works without geographic data.
 */
export function computeNameSimilarity(a: string, b: string): number {
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const na = normalize(a);
  const nb = normalize(b);

  if (na === nb) return 1;
  if (na.length < 2 || nb.length < 2) return 0;

  const bigrams = (s: string) => {
    const set = new Set<string>();
    for (let i = 0; i < s.length - 1; i++) set.add(s.slice(i, i + 2));
    return set;
  };

  const ba = bigrams(na);
  const bb = bigrams(nb);
  let intersection = 0;
  for (const bg of ba) {
    if (bb.has(bg)) intersection++;
  }

  return (2 * intersection) / (ba.size + bb.size);
}

/**
 * Compute enrichment keyword overlap between two keyword arrays.
 */
export function computeKeywordOverlap(a: string[], b: string[]): string[] {
  const setB = new Set(b.map(k => k.toLowerCase()));
  return a.filter(k => setB.has(k.toLowerCase()));
}

/**
 * Adjust language when metro intelligence is disabled.
 * "Nearby" becomes "aligned in mission".
 */
export function metroSafeLanguage(hint: string, metroEnabled: boolean): string {
  if (metroEnabled) return hint;
  return hint
    .replace(/nearby/gi, 'aligned in mission')
    .replace(/within \d+ miles/gi, 'with shared signals');
}
