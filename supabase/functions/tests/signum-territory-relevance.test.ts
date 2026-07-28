import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";

// ── Inline port of calculateTerritoryRelevance for Deno tests ──
// Mirrors src/lib/discovery/territoryRelevance.ts

type TerritoryType = 'metro' | 'county' | 'state' | 'country' | 'mission_field' | 'custom_region';

interface ActivatedTerritory {
  territory_id: string;
  territory_type: TerritoryType;
  name: string;
  state_code: string | null;
  country_code: string | null;
  metro_id: string | null;
  bundle_id: string | null;
  activation_slots: number;
  is_home: boolean;
}

interface RelevanceInput {
  resultMetroId?: string | null;
  resultTerritoryId?: string | null;
  resultStateCode?: string | null;
  resultCountryCode?: string | null;
  archetypeAlignment?: number;
  nriSignalWeight?: number;
  communioOverlap?: number;
  momentumWeight?: number;
  expandBeyond?: boolean;
  caregiverBaseStateCode?: string | null;
}

interface RelevanceResult {
  score: number;
  matchType: 'exact_territory' | 'state_match' | 'country_match' | 'region_match' | 'outside' | 'caregiver_local';
  territory?: ActivatedTerritory;
}

const TERRITORY_WEIGHTS: Record<string, number> = {
  metro: 1.0, county: 0.85, state: 0.7, country: 0.6,
  mission_field: 0.6, custom_region: 0.75, outside: 0.2,
};

const CAREGIVER_WEIGHTS = { base_state_match: 1.0, country_resources: 0.6 };

function calculateTerritoryRelevance(
  input: RelevanceInput, territories: ActivatedTerritory[], archetype: string | null,
): RelevanceResult {
  const {
    resultMetroId, resultTerritoryId, resultStateCode, resultCountryCode,
    archetypeAlignment = 0, nriSignalWeight = 0, communioOverlap = 0,
    momentumWeight = 0, expandBeyond = false, caregiverBaseStateCode,
  } = input;

  if (archetype === 'caregiver_solo') {
    const stateMatch = !!(caregiverBaseStateCode && resultStateCode && caregiverBaseStateCode === resultStateCode);
    const weight = stateMatch ? CAREGIVER_WEIGHTS.base_state_match : CAREGIVER_WEIGHTS.country_resources;
    const baseScore = weight * 0.4 + archetypeAlignment * 0.2 + nriSignalWeight * 0.15 + communioOverlap * 0.15 + momentumWeight * 0.1;
    return { score: Math.min(1, baseScore), matchType: stateMatch ? 'caregiver_local' : 'outside' };
  }

  const outsideFloor = expandBeyond ? 0.5 : TERRITORY_WEIGHTS.outside;
  let bestWeight = outsideFloor;
  let matchType: RelevanceResult['matchType'] = 'outside';
  let matchedTerritory: ActivatedTerritory | undefined;

  for (const t of territories) {
    let w = 0;
    let mt: RelevanceResult['matchType'] = 'outside';

    if (t.metro_id && resultMetroId && t.metro_id === resultMetroId) {
      w = TERRITORY_WEIGHTS.metro; mt = 'exact_territory';
    } else if (resultTerritoryId && t.territory_id === resultTerritoryId && (t.territory_type === 'county' || t.territory_type === 'custom_region')) {
      w = TERRITORY_WEIGHTS[t.territory_type]; mt = t.territory_type === 'county' ? 'exact_territory' : 'region_match';
    } else if (t.territory_type === 'county' && resultStateCode && t.state_code === resultStateCode) {
      w = TERRITORY_WEIGHTS.state; mt = 'state_match';
    } else if (t.territory_type === 'state' && resultStateCode && t.state_code === resultStateCode) {
      w = TERRITORY_WEIGHTS.state; mt = 'state_match';
    } else if (t.territory_type === 'custom_region' && resultStateCode && t.state_code === resultStateCode) {
      w = TERRITORY_WEIGHTS.state; mt = 'state_match';
    } else if ((t.territory_type === 'country' || t.territory_type === 'mission_field') && resultCountryCode && t.country_code === resultCountryCode) {
      w = TERRITORY_WEIGHTS[t.territory_type]; mt = 'country_match';
    }

    if (w > bestWeight) { bestWeight = w; matchedTerritory = t; matchType = mt; }
  }

  const score = Math.min(1, bestWeight * 0.4 + archetypeAlignment * 0.2 + nriSignalWeight * 0.15 + communioOverlap * 0.15 + momentumWeight * 0.1);
  return { score, matchType, territory: matchedTerritory };
}

// ── Helper factories ──

function makeTerr(overrides: Partial<ActivatedTerritory> & { territory_id: string; territory_type: TerritoryType; name: string }): ActivatedTerritory {
  return { state_code: null, country_code: null, metro_id: null, bundle_id: null, activation_slots: 1, is_home: false, ...overrides };
}

// ── BEHAVIORAL TESTS ──

Deno.test("metro exact match returns exact_territory with highest weight", () => {
  const territories = [makeTerr({ territory_id: 't1', territory_type: 'metro', name: 'Dallas-Fort Worth', metro_id: 'metro-dfw' })];
  const result = calculateTerritoryRelevance({ resultMetroId: 'metro-dfw' }, territories, null);
  assertEquals(result.matchType, 'exact_territory');
  assertEquals(result.territory?.territory_id, 't1');
  // Weight = 1.0 * 0.4 = 0.4
  assertEquals(result.score, 0.4);
});

Deno.test("county exact match by territory_id returns exact_territory", () => {
  const territories = [makeTerr({ territory_id: 'c1', territory_type: 'county', name: 'Franklin County', state_code: 'OH' })];
  const result = calculateTerritoryRelevance({ resultTerritoryId: 'c1', resultStateCode: 'OH' }, territories, null);
  assertEquals(result.matchType, 'exact_territory');
  // Weight = 0.85 * 0.4 = 0.34
  assertEquals(result.score, 0.34);
});

Deno.test("county same-state but different county falls back to state_match (0.7)", () => {
  const territories = [makeTerr({ territory_id: 'c1', territory_type: 'county', name: 'Franklin County', state_code: 'OH' })];
  // resultTerritoryId doesn't match c1
  const result = calculateTerritoryRelevance({ resultTerritoryId: 'c-other', resultStateCode: 'OH' }, territories, null);
  assertEquals(result.matchType, 'state_match');
  assertEquals(result.score, 0.7 * 0.4); // 0.28
});

Deno.test("custom_region exact match returns region_match", () => {
  const territories = [makeTerr({ territory_id: 'cr1', territory_type: 'custom_region', name: 'Appalachian Corridor', state_code: 'WV' })];
  const result = calculateTerritoryRelevance({ resultTerritoryId: 'cr1' }, territories, null);
  assertEquals(result.matchType, 'region_match');
  assertEquals(result.score, 0.75 * 0.4); // 0.3
});

Deno.test("missionary org country match returns country_match", () => {
  const territories = [makeTerr({ territory_id: 'k1', territory_type: 'country', name: 'Kenya', country_code: 'KE' })];
  const result = calculateTerritoryRelevance({ resultCountryCode: 'KE' }, territories, 'missionary_org');
  assertEquals(result.matchType, 'country_match');
  assertEquals(result.score, 0.6 * 0.4); // 0.24
});

Deno.test("mission_field match returns country_match", () => {
  const territories = [makeTerr({ territory_id: 'mf1', territory_type: 'mission_field', name: 'Nairobi Region', country_code: 'KE' })];
  const result = calculateTerritoryRelevance({ resultCountryCode: 'KE' }, territories, 'missionary_org');
  assertEquals(result.matchType, 'country_match');
});

Deno.test("no matching territory returns outside", () => {
  const territories = [makeTerr({ territory_id: 't1', territory_type: 'metro', name: 'Dallas', metro_id: 'metro-dfw' })];
  const result = calculateTerritoryRelevance({ resultMetroId: 'metro-nyc' }, territories, null);
  assertEquals(result.matchType, 'outside');
  assertEquals(result.score, 0.2 * 0.4); // 0.08
});

Deno.test("expandBeyond raises outside floor to 0.5", () => {
  const territories = [makeTerr({ territory_id: 't1', territory_type: 'metro', name: 'Dallas', metro_id: 'metro-dfw' })];
  const result = calculateTerritoryRelevance({ resultMetroId: 'metro-nyc', expandBeyond: true }, territories, null);
  assertEquals(result.matchType, 'outside');
  assertEquals(result.score, 0.5 * 0.4); // 0.2
});

Deno.test("empty territories array returns outside", () => {
  const result = calculateTerritoryRelevance({ resultMetroId: 'metro-dfw' }, [], null);
  assertEquals(result.matchType, 'outside');
  assertEquals(result.territory, undefined);
});

// ── Solo Caregiver Tests ──

Deno.test("caregiver_solo uses caregiverBaseStateCode, not territories", () => {
  const territories: ActivatedTerritory[] = []; // solo caregivers have no territories
  const result = calculateTerritoryRelevance(
    { resultStateCode: 'OR', caregiverBaseStateCode: 'OR' },
    territories, 'caregiver_solo',
  );
  assertEquals(result.matchType, 'caregiver_local');
  // Weight = 1.0 * 0.4 = 0.4
  assertEquals(result.score, 0.4);
});

Deno.test("caregiver_solo without base state always returns outside", () => {
  const result = calculateTerritoryRelevance(
    { resultStateCode: 'OR' },
    [], 'caregiver_solo',
  );
  assertEquals(result.matchType, 'outside');
  // Weight = 0.6 * 0.4 = 0.24
  assertEquals(result.score, 0.24);
});

Deno.test("caregiver_solo mismatched state returns outside", () => {
  const result = calculateTerritoryRelevance(
    { resultStateCode: 'TX', caregiverBaseStateCode: 'OR' },
    [], 'caregiver_solo',
  );
  assertEquals(result.matchType, 'outside');
});

// ── Composite Score Tests ──

Deno.test("all weights maxed caps at 1.0", () => {
  const territories = [makeTerr({ territory_id: 't1', territory_type: 'metro', name: 'X', metro_id: 'm1' })];
  const result = calculateTerritoryRelevance({
    resultMetroId: 'm1', archetypeAlignment: 1, nriSignalWeight: 1,
    communioOverlap: 1, momentumWeight: 1,
  }, territories, null);
  assertEquals(result.score, 1.0);
});

Deno.test("best territory wins when multiple territories match", () => {
  const territories = [
    makeTerr({ territory_id: 's1', territory_type: 'state', name: 'Ohio', state_code: 'OH' }),
    makeTerr({ territory_id: 'm1', territory_type: 'metro', name: 'Columbus', metro_id: 'metro-col', state_code: 'OH' }),
  ];
  const result = calculateTerritoryRelevance({ resultMetroId: 'metro-col', resultStateCode: 'OH' }, territories, null);
  assertEquals(result.matchType, 'exact_territory');
  assertEquals(result.territory?.territory_id, 'm1');
});
