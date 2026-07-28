/**
 * Deno tests for scenario-list edge function.
 *
 * WHAT: Validates auth and basic contract for scenario listing.
 * WHERE: supabase/functions/tests/
 * WHY: Proves scenario registry is admin-only.
 */
import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;

Deno.test("scenario-list: rejects unauthenticated requests", async () => {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/scenario-list`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  const body = await res.text();
  assertEquals(res.status, 401);
  assert(body.includes("unauthorized") || body.includes("Missing auth"));
});

Deno.test("scenario-list: rejects non-admin JWT", async () => {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/scenario-list`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({}),
  });
  const body = await res.text();
  assert(res.status === 401 || res.status === 403, `Expected 401/403, got ${res.status}`);
  assert(body.length > 0);
});

Deno.test("scenario-list: handles CORS preflight", async () => {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/scenario-list`, {
    method: "OPTIONS",
  });
  assertEquals(res.status, 200);
  await res.text();
});
