import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;
const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/hubspot-push`;

Deno.test("hubspot-push: rejects missing auth", async () => {
  const resp = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ opportunity_ids: [] }),
  });
  const body = await resp.json();
  assertEquals(resp.status, 401);
  assertExists(body.error);
});

Deno.test("hubspot-push: rejects invalid bearer token", async () => {
  const resp = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer invalid-token-value",
    },
    body: JSON.stringify({ opportunity_ids: [] }),
  });
  const body = await resp.json();
  assertEquals(resp.status, 401);
  assertExists(body.error);
});

Deno.test("hubspot-push: OPTIONS returns CORS headers", async () => {
  const resp = await fetch(FUNCTION_URL, { method: "OPTIONS" });
  await resp.text();
  assertEquals(resp.status, 200);
  assertExists(resp.headers.get("access-control-allow-origin"));
});
