/**
 * Deterministic US state normalization — Deno version.
 * Mirrors src/lib/geo/stateFips.ts exactly.
 */

export interface NormalizedState {
  stateCode: string;
  stateName: string;
  stateFips: string;
}

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
  Object.entries(stateNameToCode).map(([name, code]) => [code, name.replace(/\b\w/g, (c: string) => c.toUpperCase())])
);

export function normalizeState(input: string | null | undefined): NormalizedState | null {
  if (!input || typeof input !== "string") return null;
  const trimmed = input.trim().replace(/\s+/g, " ").toLowerCase();
  if (!trimmed) return null;

  const upper = trimmed.toUpperCase();
  if (upper.length === 2 && stateCodeToFips[upper]) {
    return {
      stateCode: upper,
      stateName: stateCodeToName[upper] || upper,
      stateFips: stateCodeToFips[upper],
    };
  }

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

/**
 * Build deterministic source URLs from org location fields.
 * NO SEARCH. NO DISCOVERY.
 */
export interface OrgLocation {
  city?: string | null;
  state?: string | null;
  state_code?: string | null;
  state_fips?: string | null;
  county?: string | null;
  county_fips?: string | null;
  place_fips?: string | null;
  zip?: string | null;
  website_url?: string | null;
}

export function buildDeterministicSourceUrls(loc: OrgLocation): string[] {
  const urls: string[] = [];
  const normalized = loc.state ? normalizeState(loc.state) : null;
  const stateName = normalized?.stateName || null;
  const stateFips = loc.state_fips || normalized?.stateFips || null;

  // A) Wikipedia city
  if (loc.city && stateName) {
    const city = loc.city.trim().replace(/\s+/g, "_");
    const state = stateName.replace(/\s+/g, "_");
    urls.push(`https://en.wikipedia.org/wiki/${city},_${state}`);
    urls.push(`https://en.wikipedia.org/wiki/${city}_${state}`);
    urls.push(`https://en.wikipedia.org/wiki/${city}_(${state})`);
  }

  // B) Wikipedia county
  if (loc.county && stateName) {
    const county = loc.county.trim().replace(/\s+/g, "_");
    const state = stateName.replace(/\s+/g, "_");
    urls.push(`https://en.wikipedia.org/wiki/${county}_County,_${state}`);
  }

  // C) Census QuickFacts
  if (stateFips) {
    urls.push(`https://www.census.gov/quickfacts/fact/table/${stateFips}/PST045223`);
    if (loc.county_fips) {
      urls.push(`https://www.census.gov/quickfacts/fact/table/${stateFips}${loc.county_fips}/PST045223`);
    }
    if (loc.place_fips) {
      urls.push(`https://www.census.gov/quickfacts/fact/table/${stateFips}${loc.place_fips}/PST045223`);
    }
  }

  // E) Org website LAST (only valid https + real TLD)
  if (loc.website_url) {
    const url = loc.website_url.trim();
    if (/^https:\/\/[a-z0-9][\w.-]+\.[a-z]{2,}/i.test(url)) {
      urls.push(url);
    }
  }

  // Cap at 8
  return urls.slice(0, 8);
}

/**
 * Derive a deterministic location_key from org fields.
 */
export function deriveLocationKey(loc: OrgLocation & { address_line1?: string | null }): string | null {
  if (loc.zip) return `zip:${loc.zip.trim()}`;
  if (loc.city && loc.state) return `city:${loc.city.trim().toLowerCase()}|${loc.state.trim().toLowerCase()}`;
  if (loc.address_line1 && loc.city && loc.state) {
    return `addr:${loc.address_line1.trim().toLowerCase()}|${loc.city.trim().toLowerCase()}|${loc.state.trim().toLowerCase()}`;
  }
  return null;
}
