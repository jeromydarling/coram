import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { compileMetroKeywords, buildNewsSearchQueries } from "../_shared/metroKeywordCompiler.ts";

// ── Mock Supabase client ──

function mockSb(data: {
  settings?: any;
  metroKws?: any[];
  globalKws?: any[];
}) {
  return {
    from: (table: string) => ({
      select: () => ({
        eq: (_col: string, _val: any) => ({
          eq: (_col2: string, _val2: any) => ({
            data: table === "metro_news_keywords"
              ? (data.metroKws ?? [])
              : (data.globalKws ?? []).filter((k: any) => k.enabled),
            error: null,
          }),
          maybeSingle: () => ({
            data: data.settings ?? null,
            error: null,
          }),
          data: table === "global_news_keywords"
            ? (data.globalKws ?? []).filter((k: any) => k.enabled)
            : [],
          error: null,
        }),
      }),
    }),
  };
}

// ── Tests ──

Deno.test("compileMetroKeywords - uses global defaults when no metro keywords", async () => {
  const sb = mockSb({
    globalKws: [
      { keyword: "eviction", category: "need_signals", weight: 8, match_mode: "phrase", enabled: true },
      { keyword: "job training", category: "workforce", weight: 6, match_mode: "phrase", enabled: true },
    ],
  });

  const result = await compileMetroKeywords(sb as any, "test-metro-id");
  assertEquals(result.settings.use_global_defaults, true);
  assertEquals(result.keywords.length, 2);
  assertEquals(result.keywords[0].keyword, "eviction"); // higher weight first
});

Deno.test("compileMetroKeywords - metro overrides win on dedup", async () => {
  const sb = mockSb({
    metroKws: [
      { keyword: "eviction", category: "need_signals", weight: 10, match_mode: "any", enabled: true },
    ],
    globalKws: [
      { keyword: "eviction", category: "need_signals", weight: 5, match_mode: "phrase", enabled: true },
      { keyword: "job fair", category: "local_events", weight: 6, match_mode: "phrase", enabled: true },
    ],
  });

  const result = await compileMetroKeywords(sb as any, "test-metro-id");
  assertEquals(result.keywords.length, 2);
  const eviction = result.keywords.find(k => k.keyword === "eviction")!;
  assertEquals(eviction.weight, 10); // metro override wins
  assertEquals(eviction.match_mode, "any");
});

Deno.test("compileMetroKeywords - respects max_keywords cap", async () => {
  const globalKws = Array.from({ length: 50 }, (_, i) => ({
    keyword: `keyword_${i}`, category: "need_signals", weight: 5, match_mode: "phrase" as const, enabled: true,
  }));

  const sb = mockSb({
    settings: { use_global_defaults: true, max_keywords: 10, radius_miles: 50 },
    globalKws,
  });

  const result = await compileMetroKeywords(sb as any, "test-metro-id");
  assertEquals(result.keywords.length, 10);
  assertEquals(result.settings.max_keywords, 10);
});

Deno.test("compileMetroKeywords - no globals when use_global_defaults=false", async () => {
  const sb = mockSb({
    settings: { use_global_defaults: false, max_keywords: 40, radius_miles: 50 },
    metroKws: [
      { keyword: "local term", category: "local_events", weight: 7, match_mode: "phrase", enabled: true },
    ],
    globalKws: [
      { keyword: "eviction", category: "need_signals", weight: 8, match_mode: "phrase", enabled: true },
    ],
  });

  const result = await compileMetroKeywords(sb as any, "test-metro-id");
  assertEquals(result.keywords.length, 1);
  assertEquals(result.keywords[0].keyword, "local term");
});

Deno.test("buildNewsSearchQueries - generates queries with metro geo terms", () => {
  const keywords = [
    { keyword: "eviction", category: "need_signals", weight: 8, match_mode: "phrase" as const },
    { keyword: "shelter opening", category: "need_signals", weight: 7, match_mode: "phrase" as const },
    { keyword: "nonprofit grant", category: "partner_signals", weight: 7, match_mode: "phrase" as const },
    { keyword: "broadband expansion", category: "policy", weight: 7, match_mode: "phrase" as const },
    { keyword: "resource fair", category: "local_events", weight: 6, match_mode: "phrase" as const },
    { keyword: "job training", category: "workforce", weight: 6, match_mode: "phrase" as const },
    { keyword: "digital divide", category: "education", weight: 7, match_mode: "phrase" as const },
  ];

  const queries = buildNewsSearchQueries("Minneapolis-St. Paul", keywords);
  assert(queries.length >= 4);
  assert(queries.length <= 10);

  // Every query should include geo terms
  for (const q of queries) {
    assert(q.query.includes("Minneapolis"), `Missing metro name in: ${q.query}`);
  }
});

Deno.test("buildNewsSearchQueries - handles compound metro names", () => {
  const keywords = [
    { keyword: "eviction", category: "need_signals", weight: 8, match_mode: "phrase" as const },
  ];

  const queries = buildNewsSearchQueries("Minneapolis-St. Paul", keywords);
  assert(queries.length > 0);
  // Should contain both parts of the compound name
  assert(queries[0].query.includes("St. Paul") || queries[0].query.includes("Saint Paul"));
});

Deno.test("buildNewsSearchQueries - empty keywords returns empty", () => {
  const queries = buildNewsSearchQueries("Chicago", []);
  assertEquals(queries.length, 0);
});

Deno.test("buildNewsSearchQueries - match_mode formatting", () => {
  const keywords = [
    { keyword: "warming center", category: "need_signals", weight: 8, match_mode: "phrase" as const },
    { keyword: "rent assistance program", category: "need_signals", weight: 7, match_mode: "all" as const },
    { keyword: "shelter", category: "need_signals", weight: 6, match_mode: "any" as const },
  ];

  const queries = buildNewsSearchQueries("Chicago", keywords);
  assert(queries.length > 0);
  const q = queries[0].query;
  // phrase mode should quote
  assert(q.includes('"warming center"'), `Expected quoted phrase in: ${q}`);
});
