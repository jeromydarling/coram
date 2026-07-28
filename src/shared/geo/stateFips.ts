/**
 * Deterministic US state normalization.
 * Covers all 50 states + DC.
 * NO API calls — hardcoded mapping only.
 */

export interface NormalizedState {
  stateCode: string;
  stateName: string;
  stateFips: string;
}

/** Two-letter code → FIPS */
export const stateCodeToFips: Record<string, string> = {
  AL: "01", AK: "02", AZ: "04", AR: "05", CA: "06",
  CO: "08", CT: "09", DE: "10", DC: "11", FL: "12",
  GA: "13", HI: "15", ID: "16", IL: "17", IN: "18",
  IA: "19", KS: "20", KY: "21", LA: "22", ME: "23",
  MD: "24", MA: "25", MI: "26", MN: "27", MS: "28",
  MO: "29", MT: "30", NE: "31", NV: "32", NH: "33",
  NJ: "34", NM: "35", NY: "36", NC: "37", ND: "38",
  OH: "39", OK: "40", OR: "41", PA: "42", RI: "44",
  SC: "45", SD: "46", TN: "47", TX: "48", UT: "49",
  VT: "50", VA: "51", WA: "53", WV: "54", WI: "55",
  WY: "56",
};

/** Full state name → two-letter code (lowercase keys for lookup) */
export const stateNameToCode: Record<string, string> = {
  alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR", california: "CA",
  colorado: "CO", connecticut: "CT", delaware: "DE", "district of columbia": "DC",
  florida: "FL", georgia: "GA", hawaii: "HI", idaho: "ID", illinois: "IL",
  indiana: "IN", iowa: "IA", kansas: "KS", kentucky: "KY", louisiana: "LA",
  maine: "ME", maryland: "MD", massachusetts: "MA", michigan: "MI", minnesota: "MN",
  mississippi: "MS", missouri: "MO", montana: "MT", nebraska: "NE", nevada: "NV",
  "new hampshire": "NH", "new jersey": "NJ", "new mexico": "NM", "new york": "NY",
  "north carolina": "NC", "north dakota": "ND", ohio: "OH", oklahoma: "OK",
  oregon: "OR", pennsylvania: "PA", "rhode island": "RI", "south carolina": "SC",
  "south dakota": "SD", tennessee: "TN", texas: "TX", utah: "UT", vermont: "VT",
  virginia: "VA", washington: "WA", "west virginia": "WV", wisconsin: "WI",
  wyoming: "WY",
};

const stateCodeToName: Record<string, string> = Object.fromEntries(
  Object.entries(stateNameToCode).map(([name, code]) => [code, name.replace(/\b\w/g, c => c.toUpperCase())])
);

/**
 * Normalize any state input to { stateCode, stateName, stateFips }.
 * Accepts "CA", "ca", "California", "california", etc.
 * Returns null if unrecognized.
 */
export function normalizeState(input: string | null | undefined): NormalizedState | null {
  if (!input || typeof input !== "string") return null;
  const trimmed = input.trim().replace(/\s+/g, " ").toLowerCase();
  if (!trimmed) return null;

  // Try as two-letter code
  const upper = trimmed.toUpperCase();
  if (upper.length === 2 && stateCodeToFips[upper]) {
    return {
      stateCode: upper,
      stateName: stateCodeToName[upper] || upper,
      stateFips: stateCodeToFips[upper],
    };
  }

  // Try as full name
  const code = stateNameToCode[trimmed];
  if (code) {
    return {
      stateCode: code,
      stateName: stateCodeToName[code] || trimmed,
      stateFips: stateCodeToFips[code],
    };
  }

  return null;
}
