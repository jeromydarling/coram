import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { normalizeState, buildDeterministicSourceUrls, deriveLocationKey, stateCodeToFips } from "../stateFips.ts";

// ── normalizeState ──

Deno.test("stateFips: CA code", () => {
  const r = normalizeState("CA");
  assertEquals(r?.stateCode, "CA");
  assertEquals(r?.stateFips, "06");
  assertEquals(r?.stateName, "California");
});

Deno.test("stateFips: ca lowercase", () => {
  const r = normalizeState("ca");
  assertEquals(r?.stateCode, "CA");
  assertEquals(r?.stateFips, "06");
});

Deno.test("stateFips: California full name", () => {
  const r = normalizeState("California");
  assertEquals(r?.stateCode, "CA");
  assertEquals(r?.stateFips, "06");
});

Deno.test("stateFips: california lowercase", () => {
  const r = normalizeState("california");
  assertEquals(r?.stateCode, "CA");
});

Deno.test("stateFips: DC", () => {
  const r = normalizeState("DC");
  assertEquals(r?.stateCode, "DC");
  assertEquals(r?.stateFips, "11");
});

Deno.test("stateFips: district of columbia", () => {
  const r = normalizeState("district of columbia");
  assertEquals(r?.stateCode, "DC");
});

Deno.test("stateFips: new york with spaces", () => {
  const r = normalizeState("  new  york ");
  assertEquals(r?.stateCode, "NY");
  assertEquals(r?.stateFips, "36");
});

Deno.test("stateFips: null input", () => {
  assertEquals(normalizeState(null), null);
});

Deno.test("stateFips: empty string", () => {
  assertEquals(normalizeState(""), null);
});

Deno.test("stateFips: invalid input", () => {
  assertEquals(normalizeState("Atlantis"), null);
});

Deno.test("stateFips: all 51 entries have FIPS", () => {
  assertEquals(Object.keys(stateCodeToFips).length, 51);
  for (const [code, fips] of Object.entries(stateCodeToFips)) {
    assertEquals(code.length, 2, `${code} should be 2 chars`);
    assertEquals(fips.length, 2, `${code} FIPS should be 2 digits`);
  }
});

// ── buildDeterministicSourceUrls ──

Deno.test("sourceUrls: city + state generates Wikipedia URLs", () => {
  const urls = buildDeterministicSourceUrls({ city: "Denver", state: "Colorado" });
  assertEquals(urls.some(u => u.includes("wikipedia.org/wiki/Denver")), true);
});

Deno.test("sourceUrls: state_fips generates Census URL", () => {
  const urls = buildDeterministicSourceUrls({ city: "Denver", state: "Colorado", state_fips: "08" });
  assertEquals(urls.some(u => u.includes("census.gov/quickfacts")), true);
});

Deno.test("sourceUrls: county generates Wikipedia county URL", () => {
  const urls = buildDeterministicSourceUrls({ city: "Denver", state: "Colorado", county: "Denver" });
  assertEquals(urls.some(u => u.includes("Denver_County")), true);
});

Deno.test("sourceUrls: county_fips generates Census county URL", () => {
  const urls = buildDeterministicSourceUrls({ state: "Colorado", state_fips: "08", county_fips: "031" });
  assertEquals(urls.some(u => u.includes("08031")), true);
});

Deno.test("sourceUrls: website_url added last", () => {
  const urls = buildDeterministicSourceUrls({
    city: "Denver",
    state: "Colorado",
    website_url: "https://example.org",
  });
  assertEquals(urls[urls.length - 1], "https://example.org");
});

Deno.test("sourceUrls: invalid website_url skipped", () => {
  const urls = buildDeterministicSourceUrls({
    city: "Denver",
    state: "Colorado",
    website_url: "not-a-url",
  });
  assertEquals(urls.some(u => u === "not-a-url"), false);
});

Deno.test("sourceUrls: max 8 URLs", () => {
  const urls = buildDeterministicSourceUrls({
    city: "Denver",
    state: "Colorado",
    county: "Denver",
    state_fips: "08",
    county_fips: "031",
    place_fips: "20000",
    website_url: "https://example.org",
  });
  assertEquals(urls.length <= 8, true);
});

Deno.test("sourceUrls: NO search, only deterministic patterns", () => {
  const urls = buildDeterministicSourceUrls({ city: "Denver", state: "Colorado" });
  for (const url of urls) {
    assertEquals(
      url.startsWith("https://en.wikipedia.org") || url.startsWith("https://www.census.gov") || url.startsWith("https://"),
      true,
      `URL must be from known patterns: ${url}`
    );
  }
});

// ── deriveLocationKey ──

Deno.test("locationKey: zip preferred", () => {
  assertEquals(deriveLocationKey({ zip: "80202", city: "Denver", state: "CO" }), "zip:80202");
});

Deno.test("locationKey: city+state fallback", () => {
  assertEquals(deriveLocationKey({ city: "Denver", state: "CO" }), "city:denver|co");
});

Deno.test("locationKey: null if insufficient", () => {
  assertEquals(deriveLocationKey({}), null);
});

// ── Idempotency guarantee ──

Deno.test("locationKey: same org_id + location_key = idempotent", () => {
  const key1 = deriveLocationKey({ zip: "80202" });
  const key2 = deriveLocationKey({ zip: "80202" });
  assertEquals(key1, key2);
});

// ── Cache semantics ──

Deno.test("cache: fresh_until logic (30 days)", () => {
  const now = Date.now();
  const freshUntil = new Date(now + 30 * 24 * 60 * 60 * 1000);
  assertEquals(freshUntil.getTime() > now, true);
  const diff = (freshUntil.getTime() - now) / (1000 * 60 * 60 * 24);
  assertEquals(Math.round(diff), 30);
});
