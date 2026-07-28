import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  isLikelyUsefulDomain,
  safeParsePerplexityResults,
  generateDedupeKey,
  buildServiceCareQueries,
  buildVolunteerQueries,
  buildLongTailQuery,
  isLongTailRefreshDue,
} from "../localPulseUtils.ts";

// ── Domain filtering ──

Deno.test("isLikelyUsefulDomain: allows .org", () => {
  assertEquals(isLikelyUsefulDomain("https://unitedway.org/events"), true);
});

Deno.test("isLikelyUsefulDomain: allows .gov", () => {
  assertEquals(isLikelyUsefulDomain("https://cityofmpls.gov/events"), true);
});

Deno.test("isLikelyUsefulDomain: rejects pinterest", () => {
  assertEquals(isLikelyUsefulDomain("https://pinterest.com/pin/123"), false);
});

Deno.test("isLikelyUsefulDomain: rejects amazon", () => {
  assertEquals(isLikelyUsefulDomain("https://www.amazon.com/dp/123"), false);
});

Deno.test("isLikelyUsefulDomain: allows eventbrite", () => {
  assertEquals(isLikelyUsefulDomain("https://www.eventbrite.com/e/community-event"), true);
});

Deno.test("isLikelyUsefulDomain: allows unknown domains (not over-filter)", () => {
  assertEquals(isLikelyUsefulDomain("https://localchurch.com/events"), true);
});

Deno.test("isLikelyUsefulDomain: empty returns false", () => {
  assertEquals(isLikelyUsefulDomain(""), false);
});

// ── Safe Perplexity parsing ──

Deno.test("safeParsePerplexityResults: direct JSON array", () => {
  const content = '[{"title":"Event A","url":"https://a.org","description":"Desc"}]';
  const result = safeParsePerplexityResults(content);
  assertEquals(result.parse_mode, "direct");
  assertEquals(result.results.length, 1);
  assertEquals(result.results[0].title, "Event A");
});

Deno.test("safeParsePerplexityResults: JSON wrapped in markdown", () => {
  const content = 'Here are the results:\n```json\n[{"title":"B","url":"https://b.org","description":"X"}]\n```';
  const result = safeParsePerplexityResults(content);
  assertEquals(result.parse_mode, "array_extract");
  assertEquals(result.results.length, 1);
});

Deno.test("safeParsePerplexityResults: object with results array", () => {
  const content = '{"results":[{"title":"C","url":"https://c.org","description":"Y"}]}';
  const result = safeParsePerplexityResults(content);
  assertEquals(result.parse_mode, "direct");
  assertEquals(result.results.length, 1);
});

Deno.test("safeParsePerplexityResults: garbage content falls back to citations", () => {
  const result = safeParsePerplexityResults("No events found today.", ["https://a.org", "https://b.org"]);
  assertEquals(result.parse_mode, "citations_fallback");
  assertEquals(result.results.length, 2);
  assertEquals(result.results[0].url, "https://a.org");
});

Deno.test("safeParsePerplexityResults: empty content + no citations = failed", () => {
  const result = safeParsePerplexityResults("", []);
  assertEquals(result.parse_mode, "failed");
  assertEquals(result.results.length, 0);
});

Deno.test("safeParsePerplexityResults: null content = failed", () => {
  const result = safeParsePerplexityResults(null as unknown as string);
  assertEquals(["citations_fallback", "failed"].includes(result.parse_mode), true);
});

// ── Dedupe key generation ──

Deno.test("generateDedupeKey: URL-based", () => {
  const key = generateDedupeKey("https://example.org/event?utm_source=x", null, null);
  assertEquals(key.startsWith("url:"), true);
  assertEquals(key.includes("utm_source"), false);
});

Deno.test("generateDedupeKey: title fallback", () => {
  const key = generateDedupeKey(null, "Community Resource Fair!!", null);
  assertEquals(key.startsWith("title:"), true);
  assertEquals(key, "title:community resource fair");
});

Deno.test("generateDedupeKey: snippet hash fallback", () => {
  const key = generateDedupeKey(null, null, "Some snippet text here for hashing");
  assertEquals(key.startsWith("snippet:"), true);
});

Deno.test("generateDedupeKey: deterministic for same URL", () => {
  const k1 = generateDedupeKey("https://example.org/event", null, null);
  const k2 = generateDedupeKey("https://example.org/event", null, null);
  assertEquals(k1, k2);
});

Deno.test("generateDedupeKey: strips www and trailing slash", () => {
  const k1 = generateDedupeKey("https://www.example.org/event/", null, null);
  const k2 = generateDedupeKey("https://example.org/event", null, null);
  assertEquals(k1, k2);
});

// ── Query lane builders ──

Deno.test("buildServiceCareQueries: returns max 2 queries", () => {
  const result = buildServiceCareQueries("Minneapolis MN");
  assertEquals(result.queries.length, 2);
  assertEquals(result.recencyFilter, "month");
});

Deno.test("buildVolunteerQueries: returns max 2 queries", () => {
  const result = buildVolunteerQueries("Denver CO", [], "week");
  assertEquals(result.queries.length, 2);
  assertEquals(result.recencyFilter, "week");
});

Deno.test("buildServiceCareQueries: incorporates tenant keywords", () => {
  const result = buildServiceCareQueries("Miami FL", ["refugee support", "ESL classes"]);
  assertEquals(result.queries.some(q => q.includes("refugee support")), true);
});

Deno.test("buildLongTailQuery: includes stable service terms", () => {
  const q = buildLongTailQuery("Chicago IL");
  assertEquals(q.includes("food pantry"), true);
  assertEquals(q.includes("Chicago IL"), true);
});

// ── Long-tail refresh timing ──

Deno.test("isLongTailRefreshDue: null = due", () => {
  assertEquals(isLongTailRefreshDue(null), true);
});

Deno.test("isLongTailRefreshDue: recent = not due", () => {
  assertEquals(isLongTailRefreshDue(new Date().toISOString()), false);
});

Deno.test("isLongTailRefreshDue: 31 days ago = due", () => {
  const old = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString();
  assertEquals(isLongTailRefreshDue(old), true);
});
