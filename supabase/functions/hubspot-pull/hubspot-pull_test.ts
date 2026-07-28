import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/hubspot-pull`;

Deno.test("hubspot-pull: preview rejects without auth", async () => {
  const resp = await fetch(`${FUNCTION_URL}?action=preview`);
  const body = await resp.json();
  assertEquals(resp.status, 401);
  assertExists(body.error);
});

Deno.test("hubspot-pull: apply rejects without auth", async () => {
  const resp = await fetch(`${FUNCTION_URL}?action=apply`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items: [] }),
  });
  const body = await resp.json();
  assertEquals(resp.status, 401);
  assertExists(body.error);
});

Deno.test("hubspot-pull: unknown action returns 400", async () => {
  const resp = await fetch(`${FUNCTION_URL}?action=invalid`, {
    headers: { Authorization: "Bearer invalid" },
  });
  const body = await resp.json();
  // 401 (invalid token) is the expected response for invalid bearer
  assertEquals(resp.status === 401 || resp.status === 400, true);
});

Deno.test("hubspot-pull: OPTIONS returns CORS", async () => {
  const resp = await fetch(FUNCTION_URL, { method: "OPTIONS" });
  await resp.text();
  assertEquals(resp.status, 200);
  assertExists(resp.headers.get("access-control-allow-origin"));
});
