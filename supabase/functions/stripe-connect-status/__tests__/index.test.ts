/**
 * Deno tests for stripe-connect-status edge function.
 *
 * Tests: CORS, auth guard, body validation, error envelopes.
 */
import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;
const FN_URL = `${SUPABASE_URL}/functions/v1/stripe-connect-status`;

Deno.test("OPTIONS returns CORS headers with extended supabase headers", async () => {
  const res = await fetch(FN_URL, { method: "OPTIONS" });
  assertEquals(res.status, 200);
  assertEquals(res.headers.get("access-control-allow-origin"), "*");
  const ah = res.headers.get("access-control-allow-headers") ?? "";
  assertEquals(ah.includes("x-supabase-client-platform"), true);
  assertEquals(ah.includes("x-supabase-client-runtime"), true);
  await res.text();
});

Deno.test("No auth header returns 401", async () => {
  const res = await fetch(FN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "apikey": ANON_KEY },
    body: JSON.stringify({ tenant_id: "abc" }),
  });
  assertEquals(res.status, 401);
  const body = await res.json();
  assertEquals(body.ok, false);
  assertEquals(body.error, "unauthorized");
});

Deno.test("Invalid bearer token returns 401", async () => {
  const res = await fetch(FN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": ANON_KEY,
      "Authorization": "Bearer fake_token_12345",
    },
    body: JSON.stringify({ tenant_id: "abc" }),
  });
  assertEquals(res.status, 401);
  const body = await res.json();
  assertEquals(body.ok, false);
});

Deno.test("Missing tenant_id with valid auth format returns 401 (auth fails first)", async () => {
  const res = await fetch(FN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": ANON_KEY,
      "Authorization": "Bearer bad",
    },
    body: JSON.stringify({}),
  });
  assertEquals(res.status, 401);
  await res.text();
});

Deno.test("Error responses include CORS headers", async () => {
  const res = await fetch(FN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "apikey": ANON_KEY },
    body: JSON.stringify({}),
  });
  assertEquals(res.headers.get("access-control-allow-origin"), "*");
  await res.text();
});

Deno.test("Error response follows standard envelope", async () => {
  const res = await fetch(FN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "apikey": ANON_KEY },
    body: JSON.stringify({}),
  });
  const body = await res.json();
  assertEquals(typeof body.ok, "boolean");
  assertEquals(body.ok, false);
  assertExists(body.error);
  assertExists(body.message);
});
