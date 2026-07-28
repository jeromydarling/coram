/**
 * lumen-detect.test.ts — Deno tests for the Lumen foresight detection edge function.
 *
 * WHAT: Validates CORS, response shape, and optional tenant filtering.
 * WHERE: supabase/functions/tests/lumen-detect.test.ts
 * WHY: Ensures nightly foresight detection runs safely and returns deterministic shape.
 */

import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";

const BASE_URL = Deno.env.get("SUPABASE_URL") ?? "http://localhost:54321";
const FUNCTION_URL = `${BASE_URL}/functions/v1/lumen-detect`;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

const headers = (key: string) => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${key}`,
  apikey: key,
});

Deno.test("lumen-detect: CORS preflight returns 200", async () => {
  const res = await fetch(FUNCTION_URL, { method: "OPTIONS" });
  assertEquals(res.status, 200);
  await res.body?.cancel();
});

Deno.test("lumen-detect: returns ok shape with stats", async () => {
  const res = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: headers(SERVICE_KEY || ANON_KEY),
    body: JSON.stringify({}),
  });
  const data = await res.json();
  assertEquals(data.ok, true);
  assertEquals(typeof data.signals_detected, "number");
  assertEquals(typeof data.created, "number");
  assertEquals(typeof data.updated, "number");
});

Deno.test("lumen-detect: accepts tenant_id filter", async () => {
  const fakeTenantId = "00000000-0000-0000-0000-000000000000";
  const res = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: headers(SERVICE_KEY || ANON_KEY),
    body: JSON.stringify({ tenant_id: fakeTenantId }),
  });
  const data = await res.json();
  assertEquals(data.ok, true);
  // With a fake tenant, no signals should be detected
  assertEquals(data.signals_detected, 0);
});
