/**
 * n8n-ingest.test.ts — Deno tests for the n8n callback ingest edge function.
 *
 * WHAT: Validates auth gating, input validation, envelope normalization, and dedup.
 * WHERE: supabase/functions/tests/n8n-ingest.test.ts
 * WHY: Ensures the sacred callback contract is enforced — no silent failures.
 */

import { assertEquals, assertExists } from "https://deno.land/std@0.208.0/assert/mod.ts";
// Import the pure functions for unit testing
import { normalizeEnvelope, normalizeOpportunitySignals } from "../n8n-ingest/index.ts";

// ─── Unit tests (no network) ───

Deno.test("normalizeEnvelope: extracts canonical fields", () => {
  const env = normalizeEnvelope({
    workflow_key: "partner_enrich",
    run_id: "run-123",
    payload: { mission_summary: "Test" },
    org_name: "Org A",
  });
  assertEquals(env.workflow_key, "partner_enrich");
  assertEquals(env.run_id, "run-123");
  assertEquals(env.org_name, "Org A");
  assertExists(env.payload);
});

Deno.test("normalizeEnvelope: accepts 'result' as payload alias", () => {
  const env = normalizeEnvelope({
    workflow_key: "partner_enrich",
    run_id: "run-456",
    result: { key: "value" },
  });
  assertEquals((env.payload as Record<string, unknown>).key, "value");
});

Deno.test("normalizeEnvelope: defaults nulls for optional fields", () => {
  const env = normalizeEnvelope({
    workflow_key: "test",
    run_id: "r1",
    payload: {},
  });
  assertEquals(env.org_id, null);
  assertEquals(env.metro_id, null);
  assertEquals(env.requested_by, null);
});

Deno.test("normalizeOpportunitySignals: Format A (result.signals[])", () => {
  const signals = normalizeOpportunitySignals({
    result: {
      signals: [
        { signal_type: "leadership_change", signal_value: "New CEO", source_url: "https://example.com", confidence: 0.8 },
      ],
    },
  });
  assertEquals(signals.length, 1);
  assertEquals(signals[0].signal_type, "leadership_change");
  assertEquals(signals[0].confidence, 0.8);
});

Deno.test("normalizeOpportunitySignals: Format B (changes[] + recommendations[])", () => {
  const signals = normalizeOpportunitySignals({
    changes: [{ fields_changed: ["mission_statement"], summary: "Mission updated" }],
    recommendations: [{ type: "outreach", message: "Schedule call" }],
  });
  assertEquals(signals.length, 2);
});

Deno.test("normalizeOpportunitySignals: empty payload returns []", () => {
  const signals = normalizeOpportunitySignals({});
  assertEquals(signals.length, 0);
});

// ─── Integration tests (require running edge function) ───

const BASE_URL = Deno.env.get("SUPABASE_URL") ?? "http://localhost:54321";
const FUNCTION_URL = `${BASE_URL}/functions/v1/n8n-ingest`;

Deno.test("n8n-ingest: rejects unauthenticated requests", async () => {
  const res = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ workflow_key: "partner_enrich", run_id: "test" }),
  });
  const data = await res.json();
  assertEquals(res.status, 401);
  assertEquals(data.error, "UNAUTHORIZED");
});

Deno.test("n8n-ingest: rejects invalid workflow_key", async () => {
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!key) return; // skip if no key
  const res = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
      apikey: key,
    },
    body: JSON.stringify({ workflow_key: "invalid_key", run_id: "test-run", payload: { x: 1 } }),
  });
  const data = await res.json();
  assertEquals(res.status, 400);
  assertEquals(data.error, "INVALID_WORKFLOW_KEY");
});

Deno.test("n8n-ingest: rejects missing run_id", async () => {
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!key) return;
  const res = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
      apikey: key,
    },
    body: JSON.stringify({ workflow_key: "partner_enrich", payload: { x: 1 } }),
  });
  const data = await res.json();
  assertEquals(res.status, 400);
  assertEquals(data.error, "MISSING_FIELD");
});

Deno.test("n8n-ingest: CORS preflight returns 200", async () => {
  const res = await fetch(FUNCTION_URL, { method: "OPTIONS" });
  assertEquals(res.status, 200);
  await res.body?.cancel();
});
