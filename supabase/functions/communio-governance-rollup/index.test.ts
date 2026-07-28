import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;

const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/communio-governance-rollup`;

Deno.test("rejects unauthenticated requests", async () => {
  const res = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY },
    body: JSON.stringify({}),
  });
  assertEquals(res.status, 401);
  const body = await res.json();
  assertExists(body.error);
});

Deno.test("rejects requests with invalid auth", async () => {
  const res = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
      Authorization: "Bearer invalid_token_here",
    },
    body: JSON.stringify({}),
  });
  assertEquals(res.status, 401);
  const body = await res.json();
  assertExists(body.error);
});

Deno.test("handles OPTIONS (CORS preflight)", async () => {
  const res = await fetch(FUNCTION_URL, { method: "OPTIONS" });
  assertEquals(res.status, 200);
  await res.text(); // consume body
});
