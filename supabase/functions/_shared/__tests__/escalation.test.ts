import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { evaluateEscalation } from "../escalation.ts";

Deno.test("escalation: no change → no LLM", () => {
  const r = evaluateEscalation({ changed: false, baseline: false, confidence: 0.3, wordDelta: 100, rawTextLength: 500 });
  assertEquals(r.shouldEscalate, false);
  assertEquals(r.reason, "no_change");
});

Deno.test("escalation: baseline → no LLM", () => {
  const r = evaluateEscalation({ changed: true, baseline: true, confidence: 0.3, wordDelta: 100, rawTextLength: 500 });
  assertEquals(r.shouldEscalate, false);
  assertEquals(r.reason, "baseline_snapshot");
});

Deno.test("escalation: high confidence → no LLM", () => {
  const r = evaluateEscalation({ changed: true, baseline: false, confidence: 0.9, wordDelta: 100, rawTextLength: 500 });
  assertEquals(r.shouldEscalate, false);
  assertEquals(r.reason, "high_confidence");
});

Deno.test("escalation: empty input → safe no-op", () => {
  const r = evaluateEscalation({ changed: true, baseline: false, confidence: 0.3, wordDelta: 100, rawTextLength: 0 });
  assertEquals(r.shouldEscalate, false);
  assertEquals(r.reason, "empty_input");
});

Deno.test("escalation: small word delta → no LLM", () => {
  const r = evaluateEscalation({ changed: true, baseline: false, confidence: 0.3, wordDelta: 10, rawTextLength: 500 });
  assertEquals(r.shouldEscalate, false);
  assertEquals(r.reason, "word_delta_below_threshold");
});

Deno.test("escalation: low confidence + large delta → escalate", () => {
  const r = evaluateEscalation({ changed: true, baseline: false, confidence: 0.4, wordDelta: 100, rawTextLength: 500 });
  assertEquals(r.shouldEscalate, true);
  assertEquals(r.llmUsed, false); // caller sets this
});

Deno.test("escalation: exact threshold confidence → no LLM", () => {
  const r = evaluateEscalation({ changed: true, baseline: false, confidence: 0.7, wordDelta: 100, rawTextLength: 500 });
  assertEquals(r.shouldEscalate, false);
});

Deno.test("escalation: exact threshold word delta → escalate", () => {
  const r = evaluateEscalation({ changed: true, baseline: false, confidence: 0.5, wordDelta: 50, rawTextLength: 500 });
  assertEquals(r.shouldEscalate, true);
});
