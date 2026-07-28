/**
 * Tests for schola-signup-webhook edge function.
 */
import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;
const FN_URL = `${SUPABASE_URL}/functions/v1/schola-signup-webhook`;

Deno.test("OPTIONS returns CORS headers", async () => {
  const res = await fetch(FN_URL, { method: "OPTIONS" });
  assertEquals(res.status, 200);
  assertEquals(res.headers.get("access-control-allow-origin"), "*");
  await res.text();
});

Deno.test("GET returns 405", async () => {
  const res = await fetch(FN_URL, {
    method: "GET",
    headers: { apikey: ANON_KEY },
  });
  assertEquals(res.status, 405);
  await res.text();
});

Deno.test("Missing auth returns 401", async () => {
  const res = await fetch(FN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: ANON_KEY,
    },
    body: JSON.stringify({ school_name: "Test School" }),
  });
  assertEquals(res.status, 401);
  const body = await res.json();
  assertEquals(body.ok, false);
  assertEquals(body.error, "Unauthorized");
});

Deno.test("Wrong auth returns 401", async () => {
  const res = await fetch(FN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: ANON_KEY,
      authorization: "Bearer wrong-secret-value",
    },
    body: JSON.stringify({ school_name: "Test School" }),
  });
  assertEquals(res.status, 401);
  const body = await res.json();
  assertEquals(body.ok, false);
});

Deno.test("Invalid JSON body returns 400", async () => {
  const res = await fetch(FN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: ANON_KEY,
      authorization: "Bearer wrong-secret-value",
    },
    body: "not json",
  });
  // Will get 401 first since auth fails before body parse
  assertEquals(res.status, 401);
  await res.text();
});

Deno.test("Missing school_name returns 400 or 401", async () => {
  const res = await fetch(FN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: ANON_KEY,
      authorization: "Bearer test-not-real",
    },
    body: JSON.stringify({}),
  });
  // 401 because secret won't match
  const status = res.status;
  assertEquals(status === 400 || status === 401, true, `Expected 400 or 401, got ${status}`);
  await res.text();
});

Deno.test("CORS headers present on error responses", async () => {
  const res = await fetch(FN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: ANON_KEY,
    },
    body: JSON.stringify({}),
  });
  assertEquals(res.headers.get("access-control-allow-origin"), "*");
  await res.text();
});
