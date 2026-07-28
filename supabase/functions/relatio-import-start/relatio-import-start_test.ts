import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/relatio-import-start`;

Deno.test("relatio-import-start: rejects without auth", async () => {
  const resp = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tenant_id: "fake", integration_key: "hubspot" }),
  });
  const body = await resp.json();
  assertEquals(resp.status, 401);
  assertExists(body.error);
});

Deno.test("relatio-import-start: rejects GET method", async () => {
  const resp = await fetch(FUNCTION_URL);
  const body = await resp.json();
  // 405 or 401 depending on auth check order
  assertEquals(resp.status === 405 || resp.status === 401, true);
  assertExists(body.error);
});

Deno.test("relatio-import-start: OPTIONS returns CORS", async () => {
  const resp = await fetch(FUNCTION_URL, { method: "OPTIONS" });
  await resp.text();
  assertEquals(resp.status, 200);
  assertExists(resp.headers.get("access-control-allow-origin"));
});
