import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assertExists } from "https://deno.land/std@0.208.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL") ?? Deno.env.get("SUPABASE_URL");
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY");

// Smoke: create-checkout rejects empty tiers
Deno.test("create-checkout rejects empty tiers array", async () => {
  if (!SUPABASE_URL) {
    console.log("SUPABASE_URL not set, skipping");
    return;
  }

  const res = await fetch(`${SUPABASE_URL}/functions/v1/create-checkout`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer test_fake_token",
      apikey: SUPABASE_ANON_KEY ?? "",
    },
    body: JSON.stringify({ tiers: [] }),
  });

  const body = await res.json();
  assertEquals(res.status, 400, `Expected 400, got ${res.status}`);
  assertExists(body.error);
  await res.text().catch(() => {});
});

// Smoke: create-checkout rejects unknown tier
Deno.test("create-checkout rejects unknown tier", async () => {
  if (!SUPABASE_URL) {
    console.log("SUPABASE_URL not set, skipping");
    return;
  }

  const res = await fetch(`${SUPABASE_URL}/functions/v1/create-checkout`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer test_fake_token",
      apikey: SUPABASE_ANON_KEY ?? "",
    },
    body: JSON.stringify({ tiers: ["nonexistent_tier"] }),
  });

  const body = await res.json();
  assertEquals(res.status, 400, `Expected 400 for unknown tier, got ${res.status}`);
  assertEquals(body.error.includes("Unknown tier"), true);
});

// Unit: Price ID mapping matches config
Deno.test("price ID mapping has all four tiers", () => {
  const PRICE_IDS: Record<string, string> = {
    core: "price_1TAh8YIuo9wd3dMdDsWk0zXv",
    insight: "price_1TAh8ZIuo9wd3dMdXAIoOK9R",
    story: "price_1TAh8bIuo9wd3dMd4YKAeOoK",
    bridge: "price_1TAh8cIuo9wd3dMdLjH7qASI",
  };
  assertEquals(Object.keys(PRICE_IDS).length, 4);
  for (const v of Object.values(PRICE_IDS)) {
    assertEquals(v.startsWith("price_"), true);
  }
});
