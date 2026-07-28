import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { normalizeEnvelope, normalizeOpportunitySignals } from "../index.ts";
import type { CanonicalSignal, IngestEnvelope } from "../index.ts";

// ── Fixtures ──

const payloadShapeSignals = {
  workflow_key: "opportunity_monitor",
  run_id: "dddddddd-1111-2222-3333-444444444444",
  opportunity_id: "opp-001",
  payload: {
    result: {
      signals: [
        {
          signal_type: "leadership_change",
          signal_value: "New CEO appointed: Jane Doe",
          source_url: "https://example.com/news/ceo",
          confidence: 0.92,
          detected_at: "2026-02-01T00:00:00Z",
        },
        {
          signal_type: "funding_round",
          signal_value: "Series B $50M raised",
          source_url: "https://example.com/funding",
          confidence: 0.85,
          detected_at: "2026-02-02T00:00:00Z",
        },
      ],
    },
  },
};

const resultShapeChanges = {
  workflow_key: "opportunity_monitor",
  run_id: "dddddddd-1111-2222-3333-555555555555",
  opportunity_id: "opp-001",
  result: {
    counts: { total: 2, changed: 1, new: 0, stale: 1 },
    changes: [
      {
        opportunity_id: "opp-001",
        fields_changed: ["stage"],
        summary: "Stage changed to Discovery Held",
      },
    ],
    recommendations: [
      {
        type: "info",
        message: "1 opportunity has been updated",
        priority: "low",
      },
    ],
  },
};

// ── normalizeEnvelope tests ──

Deno.test("normalizeEnvelope: prefers 'payload' over 'result'", () => {
  const body = {
    workflow_key: "partner_enrich",
    run_id: "aaa",
    payload: { a: 1 },
    result: { b: 2 },
  };
  const env = normalizeEnvelope(body);
  assertEquals((env.payload as Record<string, unknown>).a, 1);
  assertEquals((env.payload as Record<string, unknown>).b, undefined);
});

Deno.test("normalizeEnvelope: falls back to 'result' when 'payload' missing", () => {
  const body = {
    workflow_key: "opportunity_monitor",
    run_id: "bbb",
    result: { x: 42 },
  };
  const env = normalizeEnvelope(body);
  assertEquals((env.payload as Record<string, unknown>).x, 42);
});

Deno.test("normalizeEnvelope: returns empty object when both missing", () => {
  const body = { workflow_key: "partner_enrich", run_id: "ccc" };
  const env = normalizeEnvelope(body);
  assertEquals(Object.keys(env.payload).length, 0);
});

Deno.test("normalizeEnvelope: carries through top-level metadata", () => {
  const body = {
    workflow_key: "opportunity_monitor",
    run_id: "ddd",
    payload: { data: true },
    org_id: "org-1",
    org_name: "Test Org",
    metro_id: "metro-1",
    inputs_hash: "hash-1",
    opportunity_id: "opp-1",
  };
  const env = normalizeEnvelope(body);
  assertEquals(env.org_id, "org-1");
  assertEquals(env.org_name, "Test Org");
  assertEquals(env.metro_id, "metro-1");
  assertEquals(env.inputs_hash, "hash-1");
  assertEquals(env.opportunity_id, "opp-1");
});

// ── normalizeOpportunitySignals tests ──

Deno.test("normalizeOpportunitySignals: Format A (result.signals) produces canonical output", () => {
  const env = normalizeEnvelope(payloadShapeSignals);
  const signals = normalizeOpportunitySignals(env.payload);

  assertEquals(signals.length, 2);
  assertEquals(signals[0].signal_type, "leadership_change");
  assertEquals(signals[0].signal_value, "New CEO appointed: Jane Doe");
  assertEquals(signals[0].source_url, "https://example.com/news/ceo");
  assertEquals(signals[0].confidence, 0.92);
  assertEquals(signals[0].detected_at, "2026-02-01T00:00:00Z");
  assertEquals(signals[1].signal_type, "funding_round");
});

Deno.test("normalizeOpportunitySignals: Format B (changes+recommendations) produces canonical output", () => {
  const env = normalizeEnvelope(resultShapeChanges);
  const signals = normalizeOpportunitySignals(env.payload);

  assertEquals(signals.length, 2);
  // First signal from changes
  assertEquals(signals[0].signal_type, "stage");
  assertEquals(signals[0].signal_value, "Stage changed to Discovery Held");
  assertEquals(signals[0].source_url, "");
  assertEquals(signals[0].confidence, 0.7);
  // Second signal from recommendations
  assertEquals(signals[1].signal_type, "info");
  assertEquals(signals[1].signal_value, "1 opportunity has been updated");
  assertEquals(signals[1].confidence, 0.6);
});

Deno.test("normalizeOpportunitySignals: both formats produce same shape", () => {
  const signalsA = normalizeOpportunitySignals(normalizeEnvelope(payloadShapeSignals).payload);
  const signalsB = normalizeOpportunitySignals(normalizeEnvelope(resultShapeChanges).payload);

  // Both return CanonicalSignal[]
  for (const signals of [signalsA, signalsB]) {
    for (const s of signals) {
      assertEquals(typeof s.signal_type, "string");
      assertEquals(typeof s.signal_value, "string");
      assertEquals(typeof s.source_url, "string");
      assertEquals(s.confidence === null || typeof s.confidence === "number", true);
      assertEquals(typeof s.detected_at, "string");
    }
  }
});

Deno.test("normalizeOpportunitySignals: empty payload returns empty array", () => {
  assertEquals(normalizeOpportunitySignals({}).length, 0);
  assertEquals(normalizeOpportunitySignals({ result: { signals: [] } }).length, 0);
  assertEquals(normalizeOpportunitySignals({ changes: [] }).length, 0);
});

Deno.test("normalizeOpportunitySignals: Format A preferred over Format B when both present", () => {
  const payload = {
    result: {
      signals: [
        { signal_type: "from_a", signal_value: "A", source_url: "", confidence: 1, detected_at: "2026-01-01T00:00:00Z" },
      ],
    },
    changes: [
      { fields_changed: ["from_b"], summary: "B" },
    ],
  };
  const signals = normalizeOpportunitySignals(payload);
  assertEquals(signals.length, 1);
  assertEquals(signals[0].signal_type, "from_a");
});
