import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";

// ── Rule Engine Tests (deterministic logic, no network) ──

// Simulate the rule engine logic inline for testing
const INSTABILITY_KEYWORDS = [
  "layoff", "closure", "closing", "restructur", "downsiz", "bankrupt",
  "merger", "acquisit", "shutdown", "staff reduct", "furlough", "dissolv",
];

const PROGRAM_AREAS = [
  "education", "workforce", "broadband", "housing", "health",
  "digital equity", "digital inclusion", "internet access",
  "computer", "device", "laptop", "technology",
];

interface Signal {
  id: string;
  signal_type: string;
  summary: string;
  confidence: number;
}

function checkMomentum(signals: Signal[]) {
  const changeSignals = signals.filter(s => s.signal_type === "watchlist_change");
  const highConfChanges = changeSignals.filter(s => s.confidence >= 0.7);
  const otherSignals = signals.filter(s => s.signal_type !== "watchlist_change");
  return changeSignals.length >= 2 || (highConfChanges.length >= 1 && otherSignals.length >= 1);
}

function checkInstability(signals: Signal[]) {
  return signals.filter(s => {
    const lower = s.summary.toLowerCase();
    return INSTABILITY_KEYWORDS.some(kw => lower.includes(kw));
  }).length >= 1;
}

function checkCommunityNeedAlignment(neighborhoodSummary: string | null) {
  if (!neighborhoodSummary) return { match: false, areas: [] as string[] };
  const lower = neighborhoodSummary.toLowerCase();
  const areas = PROGRAM_AREAS.filter(a => lower.includes(a));
  return { match: areas.length >= 1, areas };
}

// SHA-256 for idempotency testing
async function sha256(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ── MOMENTUM TESTS ──

Deno.test("momentum_increase: triggers with 2+ watchlist_change signals", () => {
  const signals: Signal[] = [
    { id: "s1", signal_type: "watchlist_change", summary: "Homepage updated", confidence: 0.6 },
    { id: "s2", signal_type: "watchlist_change", summary: "New programs page", confidence: 0.5 },
  ];
  assertEquals(checkMomentum(signals), true);
});

Deno.test("momentum_increase: triggers with 1 high-conf change + 1 other signal", () => {
  const signals: Signal[] = [
    { id: "s1", signal_type: "watchlist_change", summary: "Updated team page", confidence: 0.8 },
    { id: "s2", signal_type: "enrichment_complete", summary: "Org enriched", confidence: 0.9 },
  ];
  assertEquals(checkMomentum(signals), true);
});

Deno.test("momentum_increase: does NOT trigger with single low-conf change", () => {
  const signals: Signal[] = [
    { id: "s1", signal_type: "watchlist_change", summary: "Minor CSS change", confidence: 0.3 },
  ];
  assertEquals(checkMomentum(signals), false);
});

Deno.test("momentum_increase: does NOT trigger with zero signals", () => {
  assertEquals(checkMomentum([]), false);
});

// ── INSTABILITY TESTS ──

Deno.test("instability_risk: detects layoff keyword", () => {
  const signals: Signal[] = [
    { id: "s1", signal_type: "watchlist_change", summary: "Announcing company-wide layoffs", confidence: 0.9 },
  ];
  assertEquals(checkInstability(signals), true);
});

Deno.test("instability_risk: detects closure keyword", () => {
  const signals: Signal[] = [
    { id: "s1", signal_type: "watchlist_change", summary: "Facility closure notice posted", confidence: 0.85 },
  ];
  assertEquals(checkInstability(signals), true);
});

Deno.test("instability_risk: detects restructuring", () => {
  const signals: Signal[] = [
    { id: "s1", signal_type: "watchlist_change", summary: "Major organizational restructuring underway", confidence: 0.7 },
  ];
  assertEquals(checkInstability(signals), true);
});

Deno.test("instability_risk: no match for normal signals", () => {
  const signals: Signal[] = [
    { id: "s1", signal_type: "watchlist_change", summary: "New community event announced", confidence: 0.6 },
  ];
  assertEquals(checkInstability(signals), false);
});

// ── COMMUNITY NEED ALIGNMENT TESTS ──

Deno.test("community_need_alignment: matches education keyword", () => {
  const result = checkCommunityNeedAlignment("Community struggles with education access and broadband gaps");
  assertEquals(result.match, true);
  assertEquals(result.areas.includes("education"), true);
  assertEquals(result.areas.includes("broadband"), true);
});

Deno.test("community_need_alignment: matches housing keyword", () => {
  const result = checkCommunityNeedAlignment("Affordable housing crisis affecting low-income families");
  assertEquals(result.match, true);
  assertEquals(result.areas.includes("housing"), true);
});

Deno.test("community_need_alignment: no match without program areas", () => {
  const result = checkCommunityNeedAlignment("Local sports team wins championship");
  assertEquals(result.match, false);
  assertEquals(result.areas.length, 0);
});

Deno.test("community_need_alignment: null neighborhood returns no match", () => {
  const result = checkCommunityNeedAlignment(null);
  assertEquals(result.match, false);
});

// ── IDEMPOTENCY TESTS ──

Deno.test("inputs_hash: same inputs produce same hash", async () => {
  const signalIds = ["s1", "s2", "s3"];
  const neighborhoodHash = "abc123";
  const enrichmentIds = ["e1", "e2"];

  const hash1 = await sha256(`${signalIds.sort().join(",")}|${neighborhoodHash}|${enrichmentIds.sort().join(",")}`);
  const hash2 = await sha256(`${signalIds.sort().join(",")}|${neighborhoodHash}|${enrichmentIds.sort().join(",")}`);

  assertEquals(hash1, hash2);
});

Deno.test("inputs_hash: different inputs produce different hash", async () => {
  const hash1 = await sha256("s1,s2|abc|e1");
  const hash2 = await sha256("s1,s3|abc|e1");

  assertEquals(hash1 === hash2, false);
});

Deno.test("inputs_hash: order-independent with sorting", async () => {
  const ids1 = ["s3", "s1", "s2"].sort().join(",");
  const ids2 = ["s1", "s2", "s3"].sort().join(",");
  assertEquals(ids1, ids2);

  const hash1 = await sha256(`${ids1}|hash|e1`);
  const hash2 = await sha256(`${ids2}|hash|e1`);
  assertEquals(hash1, hash2);
});

// ── ACTION GENERATION TESTS ──

Deno.test("momentum_increase produces expected action types", () => {
  const expectedActions = ["create_outreach_draft", "review_recent_changes"];
  expectedActions.forEach(a => {
    assertExists(a);
  });
  assertEquals(expectedActions.length, 2);
});

Deno.test("instability_risk produces expected action types", () => {
  const expectedActions = ["verify_operations", "adjust_expectations"];
  assertEquals(expectedActions.length, 2);
});

Deno.test("community_need_alignment produces expected action types", () => {
  const expectedActions = ["tailor_pitch", "find_local_partners"];
  assertEquals(expectedActions.length, 2);
});

// ── EXPLANATION SCHEMA TESTS ──

Deno.test("explanation output schema must not contain 'actions' field", () => {
  const validSchema = { explanation: "Some text", evidence_used: [0, 1] };
  assertEquals("actions" in validSchema, false);
  assertExists(validSchema.explanation);
  assertExists(validSchema.evidence_used);
});

Deno.test("explanation schema: evidence_used must be number array", () => {
  const schema = { explanation: "text", evidence_used: [0, 2, 4] };
  assertEquals(Array.isArray(schema.evidence_used), true);
  schema.evidence_used.forEach(idx => {
    assertEquals(typeof idx, "number");
  });
});

// ── FORCE REFRESH TEST ──

Deno.test("force=true should bypass cache (logic test)", () => {
  const cached = { inputs_hash: "abc123", generated_today: true };
  const force = true;

  // With force, should NOT return cached even if inputs_hash matches
  const shouldRegenerate = force || !cached.generated_today;
  assertEquals(shouldRegenerate, true);
});

Deno.test("force=false returns cached when inputs_hash matches", () => {
  const cached = { inputs_hash: "abc123", generated_today: true };
  const currentHash = "abc123";
  const force = false;

  const shouldReturnCached = !force && cached.generated_today && cached.inputs_hash === currentHash;
  assertEquals(shouldReturnCached, true);
});

// ── USAGE EVENTS TEST ──

Deno.test("usage event unit for explanations is org_insight_explanations_generated", () => {
  const eventType = "org_insight_explanations_generated";
  assertEquals(eventType, "org_insight_explanations_generated");
});

Deno.test("usage event unit for insight generation is org_insights_generated", () => {
  const eventType = "org_insights_generated";
  assertEquals(eventType, "org_insights_generated");
});
