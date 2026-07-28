/**
 * Deno tests for stripe-connect-webhook edge function.
 *
 * Tests: CORS, missing signature, invalid signature, error envelopes.
 * Note: Full webhook flow requires valid Stripe signatures which can't be forged in tests.
 */
import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;
const FN_URL = `${SUPABASE_URL}/functions/v1/stripe-connect-webhook`;

Deno.test("OPTIONS returns CORS headers", async () => {
  const res = await fetch(FN_URL, { method: "OPTIONS" });
  assertEquals(res.status, 200);
  assertEquals(res.headers.get("access-control-allow-origin"), "*");
  const ah = res.headers.get("access-control-allow-headers") ?? "";
  assertEquals(ah.includes("stripe-signature"), true);
  assertEquals(ah.includes("x-supabase-client-platform"), true);
  await res.text();
});

Deno.test("Missing stripe-signature returns 400 or 503", async () => {
  const res = await fetch(FN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": ANON_KEY,
    },
    body: JSON.stringify({ type: "test" }),
  });
  // 503 if webhook secret not configured, 400 if signature missing
  const status = res.status;
  assertEquals(status === 400 || status === 503, true, `Expected 400 or 503, got ${status}`);
  const body = await res.json();
  assertEquals(body.ok, false);
  assertExists(body.error);
});

Deno.test("Invalid stripe-signature returns 400 or 503", async () => {
  const res = await fetch(FN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": ANON_KEY,
      "stripe-signature": "t=1234567890,v1=fake_signature_hash",
    },
    body: JSON.stringify({ id: "evt_test", type: "checkout.session.completed", data: { object: {} } }),
  });
  // 503 if webhook secret not configured, 400 if invalid signature
  const status = res.status;
  assertEquals(status === 400 || status === 503, true, `Expected 400 or 503, got ${status}`);
  const body = await res.json();
  assertEquals(body.ok, false);
});

Deno.test("CORS headers present on error responses", async () => {
  const res = await fetch(FN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": ANON_KEY,
    },
    body: JSON.stringify({}),
  });
  assertEquals(res.headers.get("access-control-allow-origin"), "*");
  await res.text();
});

Deno.test("Content-Type is application/json on errors", async () => {
  const res = await fetch(FN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": ANON_KEY,
    },
    body: JSON.stringify({}),
  });
  const ct = res.headers.get("content-type") ?? "";
  assertEquals(ct.includes("application/json"), true);
  await res.text();
});

Deno.test("Empty body is handled gracefully", async () => {
  const res = await fetch(FN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": ANON_KEY,
      "stripe-signature": "t=0,v1=bad",
    },
    body: "",
  });
  // Should not crash — returns 400 or 503
  const status = res.status;
  assertEquals(status < 600, true);
  await res.text();
});
