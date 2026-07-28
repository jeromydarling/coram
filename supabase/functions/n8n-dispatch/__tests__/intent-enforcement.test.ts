import { assertEquals, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";

// ── Extracted logic from n8n-dispatch for unit testing ──

interface IntentProfile {
  module: string;
  required_all: string[];
  required_any: string[];
  blocked_patterns: string[];
  enforced_suffix: string;
  scope_mode: string;
}

const FALLBACK_PROFILES: Record<string, IntentProfile> = {
  grant: {
    module: "grant",
    required_all: ["grant"],
    required_any: [],
    blocked_patterns: ["-grant", "not grant", "without grant", "exclude grant", "non-grant"],
    enforced_suffix: "grant",
    scope_mode: "national",
  },
  event: {
    module: "event",
    required_all: [],
    required_any: ["event", "conference", "summit", "webinar", "workshop", "expo", "symposium"],
    blocked_patterns: ["-event", "not event", "without event", "exclude conference"],
    enforced_suffix: "(event OR conference OR summit OR webinar OR workshop OR expo OR symposium)",
    scope_mode: "national",
  },
  opportunity: {
    module: "opportunity",
    required_all: [],
    required_any: ["organization", "company", "nonprofit", "foundation", "employer", "firm", "startup"],
    blocked_patterns: ["-company", "not nonprofit", "exclude organization"],
    enforced_suffix: "(organization OR company OR nonprofit OR foundation OR employer OR firm OR startup)",
    scope_mode: "national",
  },
};

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

function buildEnforcedQuery(
  rawQuery: string,
  profile: IntentProfile,
  metroName: string | null,
): string {
  let enforced = rawQuery;
  if (profile.enforced_suffix) {
    enforced = `${enforced} ${profile.enforced_suffix}`;
  }
  if (metroName) {
    enforced = `${enforced} ("in ${metroName}" OR "${metroName}" OR "${metroName} area")`;
  }
  return enforced.trim();
}

// ── Profile loading tests ──

Deno.test("profile loading: fallback returns correct grant profile", () => {
  const p = FALLBACK_PROFILES["grant"];
  assertEquals(p.required_all, ["grant"]);
  assertEquals(p.required_any, []);
  assertEquals(p.enforced_suffix, "grant");
});

Deno.test("profile loading: fallback returns correct event profile", () => {
  const p = FALLBACK_PROFILES["event"];
  assertEquals(p.required_all, []);
  assertEquals(p.required_any.length >= 5, true);
  assertStringIncludes(p.enforced_suffix, "event OR conference");
});

Deno.test("profile loading: fallback returns correct opportunity profile", () => {
  const p = FALLBACK_PROFILES["opportunity"];
  assertEquals(p.required_all, []);
  assertEquals(p.required_any.includes("organization"), true);
  assertEquals(p.required_any.includes("nonprofit"), true);
});

// ── Sanitize query tests ──

Deno.test("sanitize: trims and collapses whitespace", () => {
  assertEquals(sanitizeQuery("  hello   world  "), "hello world");
});

Deno.test("sanitize: truncates at 500 chars", () => {
  const long = "a".repeat(600);
  assertEquals(sanitizeQuery(long).length, 500);
});

Deno.test("sanitize: handles empty string", () => {
  assertEquals(sanitizeQuery("   "), "");
});

// ── Blocked pattern tests ──

Deno.test("blocked: detects grant negation '-grant'", () => {
  assertEquals(checkBlockedPatterns("show me -grant results", FALLBACK_PROFILES.grant.blocked_patterns), "-grant");
});

Deno.test("blocked: detects 'not grant' case-insensitive", () => {
  assertEquals(checkBlockedPatterns("NOT GRANT search", FALLBACK_PROFILES.grant.blocked_patterns), "not grant");
});

Deno.test("blocked: detects 'non-grant' (matches '-grant' substring first)", () => {
  const result = checkBlockedPatterns("non-grant funding", FALLBACK_PROFILES.grant.blocked_patterns);
  // "non-grant" contains "-grant" which is checked first in the blocked list
  assertEquals(result !== null, true);
});

Deno.test("blocked: allows clean grant query", () => {
  assertEquals(checkBlockedPatterns("education grant opportunities", FALLBACK_PROFILES.grant.blocked_patterns), null);
});

Deno.test("blocked: detects event negation", () => {
  assertEquals(checkBlockedPatterns("-event stuff", FALLBACK_PROFILES.event.blocked_patterns), "-event");
});

Deno.test("blocked: detects 'exclude conference'", () => {
  assertEquals(checkBlockedPatterns("tech exclude conference", FALLBACK_PROFILES.event.blocked_patterns), "exclude conference");
});

Deno.test("blocked: allows clean event query", () => {
  assertEquals(checkBlockedPatterns("digital inclusion summit", FALLBACK_PROFILES.event.blocked_patterns), null);
});

Deno.test("blocked: detects opportunity negation '-company'", () => {
  assertEquals(checkBlockedPatterns("find -company partners", FALLBACK_PROFILES.opportunity.blocked_patterns), "-company");
});

Deno.test("blocked: allows clean opportunity query", () => {
  assertEquals(checkBlockedPatterns("affordable housing nonprofit", FALLBACK_PROFILES.opportunity.blocked_patterns), null);
});

// ── Grants less-strict enforcement tests ──

Deno.test("grants: enforced_suffix is just 'grant' (less strict)", () => {
  assertEquals(FALLBACK_PROFILES.grant.enforced_suffix, "grant");
});

Deno.test("grants: required_any is empty (no additional signals required)", () => {
  assertEquals(FALLBACK_PROFILES.grant.required_any.length, 0);
});

Deno.test("grants: required_all is just ['grant']", () => {
  assertEquals(FALLBACK_PROFILES.grant.required_all, ["grant"]);
});

Deno.test("grants: simple query builds correctly", () => {
  const enforced = buildEnforcedQuery("education funding", FALLBACK_PROFILES.grant, null);
  assertEquals(enforced, "education funding grant");
});

// ── Events required_any enforcement tests ──

Deno.test("events: enforced_suffix includes OR chain of keywords", () => {
  assertStringIncludes(FALLBACK_PROFILES.event.enforced_suffix, "event OR conference");
});

Deno.test("events: query builds with suffix appended", () => {
  const enforced = buildEnforcedQuery("digital inclusion", FALLBACK_PROFILES.event, null);
  assertStringIncludes(enforced, "digital inclusion");
  assertStringIncludes(enforced, "(event OR conference");
});

// ── Opportunities required_any enforcement tests ──

Deno.test("opportunities: enforced_suffix includes OR chain", () => {
  assertStringIncludes(FALLBACK_PROFILES.opportunity.enforced_suffix, "organization OR company");
});

Deno.test("opportunities: query builds with suffix appended", () => {
  const enforced = buildEnforcedQuery("affordable housing", FALLBACK_PROFILES.opportunity, null);
  assertStringIncludes(enforced, "affordable housing");
  assertStringIncludes(enforced, "(organization OR company");
});

// ── Metro scope tests ──

Deno.test("metro scope: appends metro clause when metro provided", () => {
  const enforced = buildEnforcedQuery("tech summit", FALLBACK_PROFILES.event, "Denver");
  assertStringIncludes(enforced, '("in Denver" OR "Denver" OR "Denver area")');
});

Deno.test("metro scope: no metro clause when null", () => {
  const enforced = buildEnforcedQuery("tech summit", FALLBACK_PROFILES.event, null);
  assertEquals(enforced.includes("area"), false);
});

Deno.test("metro scope: metro clause is deterministic", () => {
  const a = buildEnforcedQuery("test", FALLBACK_PROFILES.event, "Chicago");
  const b = buildEnforcedQuery("test", FALLBACK_PROFILES.event, "Chicago");
  assertEquals(a, b);
});

// ── Enforced query construction tests ──

Deno.test("enforced_query: always appends suffix even if user query contains keyword", () => {
  const enforced = buildEnforcedQuery("event summit", FALLBACK_PROFILES.event, null);
  // Should still have the suffix appended (deterministic, never clever)
  assertStringIncludes(enforced, "(event OR conference");
});

Deno.test("enforced_query: raw query is never returned unmodified", () => {
  const raw = "some search";
  const enforced = buildEnforcedQuery(raw, FALLBACK_PROFILES.event, null);
  assertEquals(enforced === raw, false);
});

Deno.test("enforced_query: full construction with metro", () => {
  const enforced = buildEnforcedQuery(
    "education",
    FALLBACK_PROFILES.grant,
    "Kansas City",
  );
  assertEquals(
    enforced,
    'education grant ("in Kansas City" OR "Kansas City" OR "Kansas City area")',
  );
});

Deno.test("enforced_query: grant without metro is simple", () => {
  const enforced = buildEnforcedQuery("STEM program", FALLBACK_PROFILES.grant, null);
  assertEquals(enforced, "STEM program grant");
});

// ── Edge cases ──

Deno.test("edge: empty enforced_suffix profile returns raw query only", () => {
  const customProfile: IntentProfile = {
    module: "test",
    required_all: [],
    required_any: [],
    blocked_patterns: [],
    enforced_suffix: "",
    scope_mode: "national",
  };
  assertEquals(buildEnforcedQuery("hello", customProfile, null), "hello");
});

Deno.test("edge: blocked patterns are case-insensitive", () => {
  assertEquals(checkBlockedPatterns("NOT GRANT search", ["-grant", "not grant"]), "not grant");
  assertEquals(checkBlockedPatterns("not grant search", ["-grant", "NOT GRANT"]), "NOT GRANT");
});
