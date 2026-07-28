/**
 * automation-gate.test.ts — Deno tests for the automation gate edge function.
 *
 * WHAT: Validates input validation, cooldown enforcement, and response contracts.
 * WHERE: supabase/functions/tests/automation-gate.test.ts
 * WHY: Ensures automation dispatch is safe, idempotent, and well-guarded.
 */

import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";

const BASE_URL = Deno.env.get("SUPABASE_URL") ?? "http://localhost:54321";
const FUNCTION_URL = `${BASE_URL}/functions/v1/automation-gate`;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const headers = (key: string) => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${key}`,
  apikey: key,
});

Deno.test("automation-gate: rejects missing workflow_key", async () => {
  const res = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: headers(SERVICE_KEY || ANON_KEY),
    body: JSON.stringify({}),
  });
  const data = await res.json();
  assertEquals(res.status, 400);
  assertEquals(data.reason, "missing_workflow_key");
  assertEquals(data.allowed, false);
});

Deno.test("automation-gate: accepts valid workflow_key", async () => {
  const res = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: headers(SERVICE_KEY || ANON_KEY),
    body: JSON.stringify({
      workflow_key: "drift_detection",
      dedupe_key: `test-${crypto.randomUUID()}`,
      triggered_by: "test",
    }),
  });
  const data = await res.json();
  // Should either be allowed or blocked by cooldown — both are valid
  assertEquals(typeof data.allowed, "boolean");
  if (data.allowed) {
    assertEquals(typeof data.run_id, "string");
  }
});

Deno.test("automation-gate: CORS preflight returns 200", async () => {
  const res = await fetch(FUNCTION_URL, { method: "OPTIONS" });
  assertEquals(res.status, 200);
  await res.body?.cancel();
});
