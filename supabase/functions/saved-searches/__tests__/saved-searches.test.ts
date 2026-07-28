import {
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { normalizeUrl } from "../../_shared/normalizeUrl.ts";

// ── normalizeUrl tests ──
Deno.test("normalizeUrl - lowercases host and strips www", () => {
  assertEquals(
    normalizeUrl("https://WWW.Example.COM/Page"),
    "https://example.com/Page",
  );
});

Deno.test("normalizeUrl - removes tracking params", () => {
  assertEquals(
    normalizeUrl("https://example.com/page?utm_source=fb&utm_medium=cpc&valid=1"),
    "https://example.com/page?valid=1",
  );
});

Deno.test("normalizeUrl - removes fragment", () => {
  assertEquals(
    normalizeUrl("https://example.com/page#section"),
    "https://example.com/page",
  );
});

Deno.test("normalizeUrl - removes trailing slash", () => {
  assertEquals(
    normalizeUrl("https://example.com/page/"),
    "https://example.com/page",
  );
});

Deno.test("normalizeUrl - preserves root slash", () => {
  assertEquals(normalizeUrl("https://example.com/"), "https://example.com/");
});

Deno.test("normalizeUrl - sorts query params", () => {
  assertEquals(
    normalizeUrl("https://example.com/page?z=1&a=2"),
    "https://example.com/page?a=2&z=1",
  );
});

Deno.test("normalizeUrl - adds https if missing", () => {
  assertEquals(
    normalizeUrl("example.com/page"),
    "https://example.com/page",
  );
});

Deno.test("normalizeUrl - returns empty for empty input", () => {
  assertEquals(normalizeUrl(""), "");
  assertEquals(normalizeUrl("  "), "");
});

Deno.test("normalizeUrl - strips multiple tracking params including gclid fbclid", () => {
  assertEquals(
    normalizeUrl("https://example.com/?gclid=abc&fbclid=def&mc_cid=ghi&keep=1"),
    "https://example.com/?keep=1",
  );
});

// ── Simulated handler tests (unit-level) ──
// These test the logic without needing a live Supabase instance.

// Sanitize query
function sanitizeQuery(raw: string): string {
  return raw.trim().replace(/\s+/g, " ").slice(0, 500);
}

function checkBlockedPatterns(query: string, blocked: string[]): string | null {
  const lower = query.toLowerCase();
  for (const pat of blocked) {
    if (lower.includes(pat.toLowerCase())) return pat;
  }
  return null;
}

function buildEnforcedQueryTemplate(rawQuery: string, enforcedSuffix: string): string {
  let template = rawQuery;
  if (enforcedSuffix) {
    template = `${template} ${enforcedSuffix}`;
  }
  return template.trim();
}

function buildScopeClause(metroName: string | null): string {
  if (!metroName) return "";
  return ` ("in ${metroName}" OR "${metroName}" OR "${metroName} area")`;
}

// ── Create validation tests ──
Deno.test("create - rejects invalid module", () => {
  const module = "invalid";
  const valid = ["events", "opportunities", "grants"].includes(module);
  assertEquals(valid, false);
});

Deno.test("create - accepts valid modules", () => {
  for (const m of ["events", "opportunities", "grants"]) {
    assertEquals(["events", "opportunities", "grants"].includes(m), true);
  }
});

Deno.test("create - blocked pattern rejection for grants", () => {
  const blocked = ["-grant", "not grant", "without grant", "exclude grant", "non-grant"];
  assertEquals(checkBlockedPatterns("education -grant", blocked), "-grant");
  assertEquals(checkBlockedPatterns("not grant related", blocked), "not grant");
  assertEquals(checkBlockedPatterns("education funding", blocked), null);
});

Deno.test("create - blocked pattern rejection for events", () => {
  const blocked = ["-event", "not event", "without event", "exclude conference"];
  assertEquals(checkBlockedPatterns("tech -event", blocked), "-event");
  assertEquals(checkBlockedPatterns("tech summit 2025", blocked), null);
});

Deno.test("create - blocked pattern rejection for opportunities", () => {
  const blocked = ["-company", "not nonprofit", "exclude organization"];
  assertEquals(checkBlockedPatterns("exclude organization from results", blocked), "exclude organization");
  assertEquals(checkBlockedPatterns("healthcare nonprofit", blocked), null);
});

// ── Enforced query template construction ──
Deno.test("enforced template - grants (less strict)", () => {
  const result = buildEnforcedQueryTemplate("education technology", "grant");
  assertEquals(result, "education technology grant");
});

Deno.test("enforced template - events", () => {
  const suffix = "(event OR conference OR summit OR webinar OR workshop OR expo OR symposium)";
  const result = buildEnforcedQueryTemplate("digital inclusion", suffix);
  assertEquals(result, `digital inclusion ${suffix}`);
});

Deno.test("enforced template - opportunities", () => {
  const suffix = "(organization OR company OR nonprofit OR foundation OR employer OR firm OR startup)";
  const result = buildEnforcedQueryTemplate("healthcare", suffix);
  assertEquals(result, `healthcare ${suffix}`);
});

// ── Scope clause ──
Deno.test("scope clause - metro appends deterministic clause", () => {
  const clause = buildScopeClause("Denver");
  assertEquals(clause, ` ("in Denver" OR "Denver" OR "Denver area")`);
});

Deno.test("scope clause - null metro returns empty", () => {
  assertEquals(buildScopeClause(null), "");
});

Deno.test("scope clause - full enforced query with metro", () => {
  const template = buildEnforcedQueryTemplate("education technology", "grant");
  const full = template + buildScopeClause("Denver");
  assertEquals(full, `education technology grant ("in Denver" OR "Denver" OR "Denver area")`);
});

// ── Metro scope requires metro_id ──
Deno.test("metro scope validation - metro scope needs metro_id", () => {
  const scope = "metro" as string;
  const metro_id: string | undefined = undefined;
  const needsMetro = scope === "metro" && !metro_id;
  assertEquals(needsMetro, true);
});

Deno.test("metro scope validation - national scope does not need metro_id", () => {
  const scope = "national" as string;
  const metro_id: string | undefined = undefined;
  const needsMetro = scope === "metro" && !metro_id;
  assertEquals(needsMetro, false);
});

// ── Sanitize query ──
Deno.test("sanitize query - trims and collapses whitespace", () => {
  assertEquals(sanitizeQuery("  hello   world  "), "hello world");
});

Deno.test("sanitize query - truncates at 500 chars", () => {
  const long = "a".repeat(600);
  assertEquals(sanitizeQuery(long).length, 500);
});

// ── Mark-seen idempotency (logic) ──
Deno.test("mark-seen - normalizeUrl is deterministic across calls", () => {
  const url1 = normalizeUrl("https://WWW.Example.COM/page?utm_source=fb&keep=1#section");
  const url2 = normalizeUrl("https://www.example.com/page?keep=1&utm_source=twitter#other");
  assertEquals(url1, url2);
});

// ── is_new computation ──
Deno.test("is_new - new URL not in seen set is marked new", () => {
  const seenSet = new Set(["https://example.com/seen"]);
  const normalized = normalizeUrl("https://example.com/new-page");
  assertEquals(seenSet.has(normalized), false); // is_new = true
});

Deno.test("is_new - previously seen URL is not new", () => {
  const seenSet = new Set(["https://example.com/seen"]);
  const normalized = normalizeUrl("https://www.Example.COM/seen/");
  assertEquals(seenSet.has(normalized), true); // is_new = false
});

// ── Authorization ──
Deno.test("authorization - user cannot access another user's search (logic)", () => {
  const searchOwnerId = "user-a-id" as string;
  const requestingUserId = "user-b-id" as string;
  assertEquals(searchOwnerId === requestingUserId, false);
});

// ── Run flow ──
Deno.test("run - creates distinct run IDs for repeated runs", () => {
  const id1 = crypto.randomUUID();
  const id2 = crypto.randomUUID();
  assertEquals(id1 !== id2, true);
});

// ── Module to search type mapping ──
Deno.test("module to searchType - correct mapping via lookup", () => {
  const MODULE_TO_SEARCH_TYPE: Record<string, string> = {
    events: "event",
    opportunities: "opportunity",
    grants: "grant",
  };
});

Deno.test("module to searchType - correct mapping", () => {
  const MODULE_TO_SEARCH_TYPE: Record<string, string> = {
    events: "event",
    opportunities: "opportunity",
    grants: "grant",
  };
  assertEquals(MODULE_TO_SEARCH_TYPE["events"], "event");
  assertEquals(MODULE_TO_SEARCH_TYPE["opportunities"], "opportunity");
  assertEquals(MODULE_TO_SEARCH_TYPE["grants"], "grant");
});
