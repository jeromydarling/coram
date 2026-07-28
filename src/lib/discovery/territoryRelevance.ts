/**
 * Territory-Aware Relevance Scoring — Signum Discovery.
 *
 * WHAT: Calculates territory-weighted relevance for discovery results.
 * WHERE: FindPage result ranking, Discovery Briefings, Signum signals.
 * WHY: Replaces metro-readiness scoring with territory-fair, archetype-sensitive logic.
 *      Rural orgs are not penalized. Missionaries use country-level matching.
 *      Solo caregivers filter by base location only.
 */

import type { TerritoryType } from '@/types/cros';
import type { ActivatedTerritory } from '@/hooks/useTenantTerritories';

// ── Territory Match Weights ──
const TERRITORY_WEIGHTS: Record<TerritoryType | 'outside', number> = {
  metro: 1.0,
  county: 0.85,
  state: 0.7,
  country: 0.6,
  mission_field: 0.6,
  custom_region: 0.75,
  outside: 0.2,
};

// ── Solo caregiver weights ──
const CAREGIVER_WEIGHTS = {
  base_state_match: 1.0,
  country_resources: 0.6,
};

export interface RelevanceInput {
  /** Metro ID from search result, if any */
  resultMetroId?: string | null;
  /** Territory ID from search result, if any (for county/custom_region exact match) */
  resultTerritoryId?: string | null;
  /** State code from search result location, if any */
  resultStateCode?: string | null;
  /** Country code from search result, if any */
  resultCountryCode?: string | null;
  /** Archetype alignment score 0–1 */
  archetypeAlignment?: number;
  /** NRI signal strength 0–1 */
  nriSignalWeight?: number;
  /** Communio overlap 0–1 */
  communioOverlap?: number;
  /** Momentum indicator 0–1 */
  momentumWeight?: number;
  /** Whether "search beyond territories" is toggled on */
  expandBeyond?: boolean;
  /**
   * Solo caregiver base state code (from tenant profile, NOT territories).
   * Only used when archetype is caregiver_solo.
   */
  caregiverBaseStateCode?: string | null;
  /**
   * Sector alignment weight 0–1.
   * Added when the result's domain matches one of the tenant's sector tags.
   * This is metadata-only — it does NOT filter results, only weights them.
   */
  sectorAlignmentWeight?: number;
}

export interface RelevanceResult {
  score: number;
  matchType:
    | 'exact_territory'
    | 'state_match'
    | 'country_match'
    | 'region_match'
    | 'outside'
    | 'caregiver_local';
  territory?: ActivatedTerritory;
}

/**
 * Calculate territory-aware relevance score for a discovery result.
 */
export function calculateTerritoryRelevance(
  input: RelevanceInput,
  territories: ActivatedTerritory[],
  archetype: string | null | undefined,
): RelevanceResult {
  const {
    resultMetroId,
    resultTerritoryId,
    resultStateCode,
    resultCountryCode,
    archetypeAlignment = 0,
    nriSignalWeight = 0,
    communioOverlap = 0,
    momentumWeight = 0,
    expandBeyond = false,
    caregiverBaseStateCode,
    sectorAlignmentWeight = 0,
  } = input;

  // ── Solo Caregiver: base_state only (no territory activation) ──
  if (archetype === 'caregiver_solo') {
    const stateMatch = !!(
      caregiverBaseStateCode &&
      resultStateCode &&
      caregiverBaseStateCode === resultStateCode
    );
    const weight = stateMatch
      ? CAREGIVER_WEIGHTS.base_state_match
      : CAREGIVER_WEIGHTS.country_resources;
    const baseScore =
      weight * 0.35 + archetypeAlignment * 0.15 + nriSignalWeight * 0.15 +
      communioOverlap * 0.1 + momentumWeight * 0.1 + sectorAlignmentWeight * 0.15;
    return {
      score: Math.min(1, baseScore),
      matchType: stateMatch ? 'caregiver_local' : 'outside',
    };
  }

  // ── Organization / Agency / Missionary: territory matching ──
  // When expandBeyond is toggled, outside results get a meaningful bump
  const outsideFloor = expandBeyond ? 0.5 : TERRITORY_WEIGHTS.outside;
  let bestWeight = outsideFloor;
  let matchType: RelevanceResult['matchType'] = 'outside';
  let matchedTerritory: ActivatedTerritory | undefined;

  for (const t of territories) {
    let w = 0;
    let mt: RelevanceResult['matchType'] = 'outside';

    // Exact metro match
    if (t.metro_id && resultMetroId && t.metro_id === resultMetroId) {
      w = TERRITORY_WEIGHTS.metro;
      mt = 'exact_territory';
    }
    // Exact territory ID match (county or custom_region)
    else if (
      resultTerritoryId &&
      t.territory_id === resultTerritoryId &&
      (t.territory_type === 'county' || t.territory_type === 'custom_region')
    ) {
      w = TERRITORY_WEIGHTS[t.territory_type];
      mt = t.territory_type === 'county' ? 'exact_territory' : 'region_match';
    }
    // County fallback: same state gives partial credit (not full county weight)
    else if (
      t.territory_type === 'county' &&
      resultStateCode &&
      t.state_code === resultStateCode
    ) {
      // Partial credit — same state as activated county but not exact county
      w = TERRITORY_WEIGHTS.state; // 0.7, not 0.85
      mt = 'state_match';
    }
    // State match
    else if (
      t.territory_type === 'state' &&
      resultStateCode &&
      t.state_code === resultStateCode
    ) {
      w = TERRITORY_WEIGHTS.state;
      mt = 'state_match';
    }
    // Custom region: state-level fallback if no exact territory match
    else if (
      t.territory_type === 'custom_region' &&
      resultStateCode &&
      t.state_code === resultStateCode
    ) {
      w = TERRITORY_WEIGHTS.state;
      mt = 'state_match';
    }
    // Country match (missionary orgs primarily)
    else if (
      (t.territory_type === 'country' || t.territory_type === 'mission_field') &&
      resultCountryCode &&
      t.country_code === resultCountryCode
    ) {
      w = TERRITORY_WEIGHTS[t.territory_type];
      mt = 'country_match';
    }

    if (w > bestWeight) {
      bestWeight = w;
      matchedTerritory = t;
      matchType = mt;
    }
  }

  // Composite score — sector alignment adds a meaningful weight modifier
  const score = Math.min(
    1,
    bestWeight * 0.35 +
      archetypeAlignment * 0.15 +
      nriSignalWeight * 0.12 +
      communioOverlap * 0.12 +
      momentumWeight * 0.1 +
      sectorAlignmentWeight * 0.16,
  );

  return { score, matchType, territory: matchedTerritory };
}

/**
 * Human-readable match description for UI.
 */
export function matchTypeLabel(
  matchType: RelevanceResult['matchType'],
  archetype: string | null | undefined,
): string {
  if (archetype === 'caregiver_solo') {
    return matchType === 'caregiver_local' ? 'Near you' : 'Wider resource';
  }
  if (archetype === 'caregiver_agency') {
    return matchType === 'exact_territory' || matchType === 'region_match'
      ? 'Within your service areas'
      : matchType === 'state_match'
        ? 'In your state'
        : 'Beyond your service areas';
  }
  switch (matchType) {
    case 'exact_territory':
      return 'Within your active territories';
    case 'region_match':
      return 'Within your custom region';
    case 'state_match':
      return 'In your state';
    case 'country_match':
      return archetype === 'missionary_org'
        ? 'In your field of service'
        : 'In your country';
    case 'outside':
      return 'Beyond your current territories';
    default:
      return '';
  }
}
