import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;

const ROLLUP_URL = `${SUPABASE_URL}/functions/v1/communio-rollup-weekly`;

Deno.test("communio-rollup-weekly rejects unauthenticated", async () => {
  const res = await fetch(ROLLUP_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY },
    body: JSON.stringify({}),
  });
  assertEquals(res.status, 401);
  const body = await res.json();
  assertExists(body.error);
});

Deno.test("communio-rollup-weekly rejects invalid auth", async () => {
  const res = await fetch(ROLLUP_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
      Authorization: "Bearer invalid_token",
    },
    body: JSON.stringify({}),
  });
  assertEquals(res.status, 401);
  await res.json();
});

Deno.test("communio-rollup-weekly handles OPTIONS", async () => {
  const res = await fetch(ROLLUP_URL, { method: "OPTIONS" });
  assertEquals(res.status, 200);
  await res.text();
});
