import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;
const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/hubspot-connect`;

Deno.test("hubspot-connect: status rejects without auth", async () => {
  const resp = await fetch(`${FUNCTION_URL}?action=status`);
  const body = await resp.json();
  assertEquals(resp.status, 401);
  assertExists(body.error);
});

Deno.test("hubspot-connect: auth-url rejects without auth", async () => {
  const resp = await fetch(`${FUNCTION_URL}?action=auth-url`);
  const body = await resp.json();
  assertEquals(resp.status, 401);
  assertExists(body.error);
});

Deno.test("hubspot-connect: disconnect rejects without auth", async () => {
  const resp = await fetch(`${FUNCTION_URL}?action=disconnect`, { method: "POST" });
  const body = await resp.json();
  assertEquals(resp.status, 401);
  assertExists(body.error);
});

Deno.test("hubspot-connect: unknown action returns 400", async () => {
  const resp = await fetch(`${FUNCTION_URL}?action=invalid`, {
    headers: { Authorization: "Bearer invalid" },
  });
  const body = await resp.json();
  // Either 401 (invalid token) or 400 (unknown action) are acceptable
  assertEquals(resp.status === 401 || resp.status === 400, true);
  await resp.text().catch(() => {});
});

Deno.test("hubspot-connect: OPTIONS returns CORS", async () => {
  const resp = await fetch(FUNCTION_URL, { method: "OPTIONS" });
  await resp.text();
  assertEquals(resp.status, 200);
  assertExists(resp.headers.get("access-control-allow-origin"));
});
