/**
 * Deno tests for system-sweep-run edge function.
 *
 * WHAT: Validates auth, CORS, and basic contract for the sweep orchestrator.
 * WHERE: supabase/functions/tests/
 * WHY: Proves the full pipeline sweep is locked down and returns expected shape.
 */
import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;

Deno.test("system-sweep-run: rejects unauthenticated requests", async () => {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/system-sweep-run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tenant_id: "fake" }),
  });
  const body = await res.text();
  assertEquals(res.status, 401);
  assert(body.includes("unauthorized") || body.includes("Missing auth"));
});

Deno.test("system-sweep-run: rejects non-admin JWT", async () => {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/system-sweep-run`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ tenant_id: "fake" }),
  });
  const body = await res.text();
  assert(res.status === 401 || res.status === 403, `Expected 401/403, got ${res.status}`);
  assert(body.length > 0);
});

Deno.test("system-sweep-run: handles CORS preflight", async () => {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/system-sweep-run`, {
    method: "OPTIONS",
  });
  assertEquals(res.status, 200);
  await res.text();
});

Deno.test("system-sweep-run: rejects missing tenant_id", async () => {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/system-sweep-run`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({}),
  });
  const body = await res.text();
  assert(res.status >= 400, `Expected error, got ${res.status}`);
  assert(body.length > 0);
});
