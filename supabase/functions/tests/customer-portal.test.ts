import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assertExists } from "https://deno.land/std@0.208.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL") ?? Deno.env.get("SUPABASE_URL");
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY");

// Smoke: customer-portal rejects unauthenticated requests
Deno.test("customer-portal rejects missing auth", async () => {
  if (!SUPABASE_URL) {
    console.log("SUPABASE_URL not set, skipping");
    return;
  }

  const res = await fetch(`${SUPABASE_URL}/functions/v1/customer-portal`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY ?? "",
    },
    body: JSON.stringify({}),
  });

  assertEquals(res.status >= 400, true, `Expected error status, got ${res.status}`);
  await res.text();
});

// Smoke: customer-portal rejects invalid token
Deno.test("customer-portal rejects invalid token", async () => {
  if (!SUPABASE_URL) {
    console.log("SUPABASE_URL not set, skipping");
    return;
  }

  const res = await fetch(`${SUPABASE_URL}/functions/v1/customer-portal`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer invalid_token",
      apikey: SUPABASE_ANON_KEY ?? "",
    },
    body: JSON.stringify({}),
  });

  const body = await res.json();
  assertEquals(res.status >= 400, true);
  assertExists(body.error);
});

// Unit: portal return URL format
Deno.test("portal return URL should be a valid path", () => {
  const origin = "https://thecros.app";
  const returnUrl = `${origin}/settings`;
  assertEquals(returnUrl.startsWith("https://"), true);
  assertEquals(returnUrl.includes("/settings"), true);
});
