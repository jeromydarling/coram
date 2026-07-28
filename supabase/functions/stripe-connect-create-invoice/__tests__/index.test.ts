/**
 * Deno tests for stripe-connect-create-invoice edge function.
 *
 * Tests: CORS, auth, validation, error envelopes, required fields.
 */
import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;
const FN_URL = `${SUPABASE_URL}/functions/v1/stripe-connect-create-invoice`;

Deno.test("OPTIONS returns CORS with extended headers", async () => {
  const res = await fetch(FN_URL, { method: "OPTIONS" });
  assertEquals(res.status, 200);
  assertEquals(res.headers.get("access-control-allow-origin"), "*");
  const ah = res.headers.get("access-control-allow-headers") ?? "";
  assertEquals(ah.includes("x-supabase-client-platform"), true);
  await res.text();
});

Deno.test("Missing auth returns 401 with envelope", async () => {
  const res = await fetch(FN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "apikey": ANON_KEY },
    body: JSON.stringify({ tenant_id: "t", description: "test", amount_cents: 1000 }),
  });
  assertEquals(res.status, 401);
  const body = await res.json();
  assertEquals(body.ok, false);
  assertEquals(body.error, "unauthorized");
  assertExists(body.message);
});

Deno.test("Invalid token returns 401", async () => {
  const res = await fetch(FN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": ANON_KEY,
      "Authorization": "Bearer not_a_real_token",
    },
    body: JSON.stringify({ tenant_id: "t", description: "test", amount_cents: 1000 }),
  });
  assertEquals(res.status, 401);
  await res.text();
});

Deno.test("Missing required fields returns 401 (auth fails before validation)", async () => {
  const res = await fetch(FN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": ANON_KEY,
      "Authorization": "Bearer fake",
    },
    body: JSON.stringify({}),
  });
  // Auth should fail first
  assertEquals(res.status, 401);
  await res.text();
});

Deno.test("All error responses include CORS headers", async () => {
  const res = await fetch(FN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "apikey": ANON_KEY },
    body: JSON.stringify({}),
  });
  assertEquals(res.headers.get("access-control-allow-origin"), "*");
  const ah = res.headers.get("access-control-allow-headers") ?? "";
  assertEquals(ah.includes("content-type"), true);
  await res.text();
});

Deno.test("Content-Type is application/json on errors", async () => {
  const res = await fetch(FN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "apikey": ANON_KEY },
    body: JSON.stringify({}),
  });
  const ct = res.headers.get("content-type") ?? "";
  assertEquals(ct.includes("application/json"), true);
  await res.text();
});
