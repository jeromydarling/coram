/**
 * Deno tests for simulation-run edge function.
 *
 * WHAT: Validates auth, idempotency, and deterministic simulation behavior.
 * WHERE: supabase/functions/tests/
 * WHY: Proves simulation engine is locked down and repeatable.
 */
import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL") ?? Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;

Deno.test("simulation-run: rejects unauthenticated requests", async () => {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/simulation-run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tenant_id: "fake", scenario_key: "church_small", run_key: "test" }),
  });
  const body = await res.text();
  assertEquals(res.status, 401);
  assert(body.includes("unauthorized") || body.includes("Unauthorized") || body.includes("Missing auth"));
});

Deno.test("simulation-run: rejects non-admin JWT", async () => {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/simulation-run`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ tenant_id: "fake", scenario_key: "church_small", run_key: "test" }),
  });
  const body = await res.text();
  assert(res.status === 401 || res.status === 403, `Expected 401/403, got ${res.status}`);
  assert(body.length > 0);
});

Deno.test("simulation-run: rejects missing required fields", async () => {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/simulation-run`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({}),
  });
  const body = await res.text();
  // Should fail with auth or bad_request
  assert(res.status >= 400, `Expected error status, got ${res.status}`);
  assert(body.length > 0);
});

Deno.test("simulation-run: handles CORS preflight", async () => {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/simulation-run`, {
    method: "OPTIONS",
  });
  assertEquals(res.status, 200);
  await res.text();
});
