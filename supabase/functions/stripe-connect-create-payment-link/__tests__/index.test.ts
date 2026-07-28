/**
 * Deno tests for stripe-connect-create-payment-link edge function.
 *
 * Tests: CORS, auth, validation, error envelopes.
 */
import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;
const FN_URL = `${SUPABASE_URL}/functions/v1/stripe-connect-create-payment-link`;

Deno.test("OPTIONS returns CORS with extended headers", async () => {
  const res = await fetch(FN_URL, { method: "OPTIONS" });
  assertEquals(res.status, 200);
  assertEquals(res.headers.get("access-control-allow-origin"), "*");
  const ah = res.headers.get("access-control-allow-headers") ?? "";
  assertEquals(ah.includes("x-supabase-client-platform"), true);
  assertEquals(ah.includes("x-supabase-client-runtime-version"), true);
  await res.text();
});

Deno.test("No auth returns 401", async () => {
  const res = await fetch(FN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "apikey": ANON_KEY },
    body: JSON.stringify({ tenant_id: "t", title: "Test", amount_cents: 500 }),
  });
  assertEquals(res.status, 401);
  const body = await res.json();
  assertEquals(body.ok, false);
  assertEquals(body.error, "unauthorized");
});

Deno.test("Bogus bearer returns 401", async () => {
  const res = await fetch(FN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": ANON_KEY,
      "Authorization": "Bearer completely_invalid",
    },
    body: JSON.stringify({ tenant_id: "t", title: "Test", amount_cents: 500 }),
  });
  assertEquals(res.status, 401);
  await res.text();
});

Deno.test("Error envelope is consistent", async () => {
  const res = await fetch(FN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "apikey": ANON_KEY },
    body: JSON.stringify({}),
  });
  const body = await res.json();
  assertEquals(body.ok, false);
  assertExists(body.error);
  assertExists(body.message);
});

Deno.test("CORS headers on all error responses", async () => {
  const res = await fetch(FN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "apikey": ANON_KEY },
    body: JSON.stringify({}),
  });
  assertEquals(res.headers.get("access-control-allow-origin"), "*");
  await res.text();
});
