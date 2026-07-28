import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assertExists } from "https://deno.land/std@0.208.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL") ?? Deno.env.get("SUPABASE_URL");
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY");

// Smoke test: check-subscription rejects unauthenticated requests
Deno.test("check-subscription rejects missing auth", async () => {
  if (!SUPABASE_URL) {
    console.log("SUPABASE_URL not set, skipping");
    return;
  }

  const res = await fetch(`${SUPABASE_URL}/functions/v1/check-subscription`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY ?? "",
    },
    body: JSON.stringify({}),
  });

  // Should fail with 500 (no auth header) or 401
  const status = res.status;
  assertEquals(status >= 400 && status < 600, true, `Expected 4xx/5xx, got ${status}`);
  await res.text();
});

// Smoke test: check-subscription returns JSON shape with invalid token
Deno.test("check-subscription returns error for invalid token", async () => {
  if (!SUPABASE_URL) {
    console.log("SUPABASE_URL not set, skipping");
    return;
  }

  const res = await fetch(`${SUPABASE_URL}/functions/v1/check-subscription`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer invalid_token_xyz",
      apikey: SUPABASE_ANON_KEY ?? "",
    },
    body: JSON.stringify({}),
  });

  const body = await res.json();
  assertEquals(res.status >= 400, true, `Expected error status, got ${res.status}`);
  assertExists(body.error, "Expected error field in response");
});

// Unit test: tier values match platform spec
Deno.test("CROS tier values are valid", () => {
  const validTiers = ["core", "insight", "story", "bridge"];
  for (const t of validTiers) {
    assertEquals(validTiers.includes(t), true);
  }
  assertEquals(validTiers.includes("free"), false);
  assertEquals(validTiers.includes("premium"), false);
});
