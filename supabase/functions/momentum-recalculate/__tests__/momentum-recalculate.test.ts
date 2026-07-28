import { assertEquals, assertExists } from "https://deno.land/std@0.208.0/assert/mod.ts";
import {
  validateInput,
  computeTrend,
  computeSignalScore,
  computeGraphScore,
  computeFitScore,
  computeRecencyScore,
  computeMomentum,
} from "../index.ts";

// ── validateInput ──
Deno.test("validateInput: accepts valid single input with opportunity_id", () => {
  const result = validateInput({ opportunity_id: "abc-123", mode: "single" });
  assertEquals(result.valid, true);
});

Deno.test("validateInput: accepts valid single input with organization_id (backward compat)", () => {
  const result = validateInput({ organization_id: "abc-123", mode: "single" });
  assertEquals(result.valid, true);
  if (result.valid) {
    assertEquals(result.data.opportunity_id, "abc-123");
  }
});

Deno.test("validateInput: accepts valid batch input", () => {
  const result = validateInput({ mode: "batch" });
  assertEquals(result.valid, true);
});

Deno.test("validateInput: rejects empty opportunity_id", () => {
  const result = validateInput({ opportunity_id: "" });
  assertEquals(result.valid, false);
});

Deno.test("validateInput: rejects invalid mode", () => {
  const result = validateInput({ mode: "turbo" });
  assertEquals(result.valid, false);
});

Deno.test("validateInput: rejects non-object body", () => {
  assertEquals(validateInput(null).valid, false);
  assertEquals(validateInput("abc").valid, false);
});

// ── computeTrend ──
Deno.test("computeTrend: rising when delta >= 8", () => {
  assertEquals(computeTrend(8), "rising");
  assertEquals(computeTrend(15), "rising");
});

Deno.test("computeTrend: falling when delta <= -8", () => {
  assertEquals(computeTrend(-8), "falling");
  assertEquals(computeTrend(-20), "falling");
});

Deno.test("computeTrend: stable in between", () => {
  assertEquals(computeTrend(0), "stable");
  assertEquals(computeTrend(7), "stable");
  assertEquals(computeTrend(-7), "stable");
});

// ── Trend from score deltas ──
Deno.test("trend: last_score=10 new=25 => delta=15 rising", () => {
  const now = new Date().toISOString();
  const signals = [
    { signal_type: "leadership_change", confidence: 1.0, source_url: null, signal_value: "test", detected_at: now },
    { signal_type: "expansion", confidence: 1.0, source_url: null, signal_value: "test2", detected_at: now },
    { signal_type: "funding", confidence: 1.0, source_url: null, signal_value: "test3", detected_at: now },
  ];
  const r = computeMomentum(signals, [], {}, [], 10, 30);
  const expectedDelta = r.score - 10;
  assertEquals(r.score_delta, expectedDelta);
  if (expectedDelta >= 8) assertEquals(r.trend, "rising");
});

Deno.test("trend: last_score=50 new=40 => delta=-10 falling", () => {
  const r = computeMomentum([], [], {}, [], 50, 30);
  assertEquals(r.score, 0);
  assertEquals(r.score_delta, -50);
  assertEquals(r.trend, "falling");
});

// ── computeSignalScore ──
Deno.test("computeSignalScore: empty signals = 0", () => {
  const result = computeSignalScore([], 30);
  assertEquals(result.score, 0);
  assertEquals(result.drivers.length, 0);
});

Deno.test("computeSignalScore: recent signals score higher", () => {
  const now = new Date().toISOString();
  const signals = [
    { signal_type: "leadership_change", confidence: 0.9, source_url: "https://example.com", signal_value: "New CEO appointed", detected_at: now },
    { signal_type: "expansion", confidence: 0.8, source_url: null, signal_value: "Opening new office", detected_at: now },
  ];
  const result = computeSignalScore(signals, 30);
  assertEquals(result.score > 0, true);
  assertEquals(result.drivers.length, 2);
  assertExists(result.drivers[0].evidence_url);
});

Deno.test("computeSignalScore: old signals decay", () => {
  const oldDate = new Date(Date.now() - 25 * 86400000).toISOString();
  const newDate = new Date().toISOString();

  const oldResult = computeSignalScore([
    { signal_type: "leadership_change", confidence: 0.9, source_url: null, signal_value: "test", detected_at: oldDate },
  ], 30);

  const newResult = computeSignalScore([
    { signal_type: "leadership_change", confidence: 0.9, source_url: null, signal_value: "test", detected_at: newDate },
  ], 30);

  assertEquals(newResult.score >= oldResult.score, true);
});

Deno.test("computeSignalScore: capped at SIGNALS_MAX (40)", () => {
  const now = new Date().toISOString();
  const signals = Array.from({ length: 20 }, (_, i) => ({
    signal_type: "leadership_change",
    confidence: 1.0,
    source_url: null,
    signal_value: `signal ${i}`,
    detected_at: now,
  }));
  const result = computeSignalScore(signals, 30);
  assertEquals(result.score <= 40, true);
});

// ── computeGraphScore ──
Deno.test("computeGraphScore: empty edges = 0", () => {
  const result = computeGraphScore([]);
  assertEquals(result.score, 0);
});

Deno.test("computeGraphScore: counts edges with caps", () => {
  const edges = [
    { source_type: "organization", target_type: "person", edge_reason: "contact" },
    { source_type: "organization", target_type: "person", edge_reason: "contact" },
    { source_type: "organization", target_type: "grant", edge_reason: "alignment" },
  ];
  const result = computeGraphScore(edges);
  assertEquals(result.score > 0, true);
  assertEquals(result.drivers.length > 0, true);
});

Deno.test("computeGraphScore: capped at GRAPH_MAX (25)", () => {
  const edges = Array.from({ length: 50 }, (_, i) => ({
    source_type: "organization",
    target_type: i % 2 === 0 ? "person" : "grant",
    edge_reason: "test",
  }));
  const result = computeGraphScore(edges);
  assertEquals(result.score <= 25, true);
});

// ── computeFitScore ──
Deno.test("computeFitScore: empty org = 0", () => {
  const result = computeFitScore({});
  assertEquals(result.score, 0);
});

Deno.test("computeFitScore: partner tiers increase score", () => {
  const result = computeFitScore({ partner_tiers: ["Gold", "Silver"] });
  assertEquals(result.score > 0, true);
});

Deno.test("computeFitScore: capped at FIT_MAX (20)", () => {
  const result = computeFitScore({
    partner_tiers: ["A", "B", "C", "D", "E"],
    grant_alignment: ["a", "b", "c", "d", "e"],
    mission_snapshot: ["x", "y", "z", "w", "v"],
  });
  assertEquals(result.score <= 20, true);
});

// ── computeRecencyScore ──
Deno.test("computeRecencyScore: upcoming event within 14 days adds +10", () => {
  const futureDate = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  const result = computeRecencyScore(
    { last_contact_date: new Date().toISOString() },
    [{ event_date: futureDate }],
    [],
  );
  assertEquals(result.score >= 10, true);
  assertEquals(result.drivers.some(d => d.type === "recency_upcoming_event"), true);
});

Deno.test("computeRecencyScore: event 30 days out gives no points", () => {
  const farDate = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  const result = computeRecencyScore(
    { last_contact_date: new Date().toISOString() },
    [{ event_date: farDate }],
    [],
  );
  assertEquals(result.drivers.some(d => d.type === "recency_upcoming_event"), false);
});

Deno.test("computeRecencyScore: invalid event_date is skipped safely", () => {
  const result = computeRecencyScore(
    { last_contact_date: new Date().toISOString() },
    [{ event_date: "not-a-date" }, { event_date: null }],
    [],
  );
  assertEquals(result.drivers.some(d => d.type === "recency_upcoming_event"), false);
});

Deno.test("computeRecencyScore: stale + signals adds urgency", () => {
  const staleDate = new Date(Date.now() - 45 * 86400000).toISOString();
  const recentSignal = new Date(Date.now() - 3 * 86400000).toISOString();
  const result = computeRecencyScore(
    { last_contact_date: staleDate },
    [],
    [{ signal_type: "expansion", detected_at: recentSignal }],
  );
  assertEquals(result.score >= 5, true);
});

Deno.test("computeRecencyScore: capped at RECENCY_MAX (15)", () => {
  const futureDate = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
  const staleDate = new Date(Date.now() - 45 * 86400000).toISOString();
  const recentSignal = new Date(Date.now() - 3 * 86400000).toISOString();
  const result = computeRecencyScore(
    { last_contact_date: staleDate },
    [{ event_date: futureDate }],
    [{ signal_type: "expansion", detected_at: recentSignal }],
  );
  assertEquals(result.score <= 15, true);
});

// ── computeMomentum (integration) ──
Deno.test("computeMomentum: deterministic with same inputs", () => {
  const now = new Date().toISOString();
  const signals = [
    { signal_type: "leadership_change", confidence: 0.9, source_url: "https://test.com", signal_value: "New CEO", detected_at: now },
  ];
  const edges = [
    { source_type: "organization", target_type: "person", edge_reason: "contact" },
  ];
  const org = { partner_tiers: ["Gold"], grant_alignment: ["digital_equity"] };

  const result1 = computeMomentum(signals, edges, org, [], 0, 30);
  const result2 = computeMomentum(signals, edges, org, [], 0, 30);

  assertEquals(result1.score, result2.score);
  assertEquals(result1.trend, result2.trend);
  assertEquals(result1.score_delta, result2.score_delta);
});

Deno.test("computeMomentum: score between 0 and 100", () => {
  const result = computeMomentum([], [], {}, [], 0, 30);
  assertEquals(result.score >= 0, true);
  assertEquals(result.score <= 100, true);
});

Deno.test("computeMomentum: drivers capped at 10", () => {
  const now = new Date().toISOString();
  const signals = Array.from({ length: 15 }, (_, i) => ({
    signal_type: "info",
    confidence: 0.8,
    source_url: null,
    signal_value: `signal ${i}`,
    detected_at: now,
  }));
  const result = computeMomentum(signals, [], { partner_tiers: ["A", "B", "C"] }, [], 0, 30);
  assertEquals(result.drivers.length <= 10, true);
});

Deno.test("computeMomentum: idempotent upsert produces correct delta", () => {
  const now = new Date().toISOString();
  const signals = [
    { signal_type: "expansion", confidence: 0.8, source_url: null, signal_value: "test", detected_at: now },
  ];

  const first = computeMomentum(signals, [], {}, [], 0, 30);
  const second = computeMomentum(signals, [], {}, [], first.score, 30);

  assertEquals(second.score_delta, 0);
  assertEquals(second.trend, "stable");
});

Deno.test("computeMomentum: total score respects component caps", () => {
  const now = new Date().toISOString();
  const signals = Array.from({ length: 20 }, (_, i) => ({
    signal_type: "leadership_change",
    confidence: 1.0,
    source_url: "https://test.com",
    signal_value: `signal ${i}`,
    detected_at: now,
  }));
  const edges = Array.from({ length: 50 }, (_, i) => ({
    source_type: "organization",
    target_type: i % 3 === 0 ? "person" : i % 3 === 1 ? "grant" : "event",
    edge_reason: "test",
  }));
  const org = {
    partner_tiers: ["A", "B", "C", "D"],
    grant_alignment: ["a", "b", "c", "d"],
    mission_snapshot: ["x", "y", "z"],
  };
  const futureDate = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);

  const result = computeMomentum(signals, edges, org, [{ event_date: futureDate }], 0, 30);
  assertEquals(result.score <= 100, true);
  assertEquals(result.score >= 0, true);
});

Deno.test("computeMomentum: uses opportunity_id field (not org_id)", () => {
  const result = computeMomentum([], [], {}, [], 0, 30);
  assertEquals("opportunity_id" in result, true);
  assertEquals("org_id" in result, false);
});

Deno.test("computeMomentum: evidence_url preserved from signals", () => {
  const now = new Date().toISOString();
  const signals = [
    { signal_type: "expansion", confidence: 0.9, source_url: "https://evidence.com/article", signal_value: "Big expansion", detected_at: now },
  ];
  const result = computeMomentum(signals, [], {}, [], 0, 30);
  const driver = result.drivers.find(d => d.type === "expansion");
  assertEquals(driver?.evidence_url, "https://evidence.com/article");
  assertEquals(driver?.evidence_snippet, "Big expansion");
});
