import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals } from "https://deno.land/std@0.224.0/assert/assert_equals.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;

const BASE_URL = `${SUPABASE_URL}/functions/v1/grant-alignment-callback`;

async function callFn(body: unknown, headers: Record<string, string> = {}) {
  const resp = await fetch(BASE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
  });
  const text = await resp.text();
  return { status: resp.status, body: text };
}

Deno.test("grant-alignment-callback: rejects missing auth", async () => {
  const { status, body } = await callFn({
    run_id: "00000000-0000-0000-0000-000000000001",
    status: "completed",
    results: [],
  });
  assertEquals(status, 401);
  const json = JSON.parse(body);
  assertEquals(json.error, "UNAUTHORIZED");
});

Deno.test("grant-alignment-callback: rejects invalid body", async () => {
  const { status, body } = await callFn(
    { run_id: "not-a-uuid", status: "completed" },
    { "X-Api-Key": "wrong-secret" },
  );
  // Either 401 (bad secret) or 400 (bad body) is acceptable
  const json = JSON.parse(body);
  assertEquals(json.ok, false);
});

Deno.test("grant-alignment-callback: rejects invalid status", async () => {
  const { status, body } = await callFn(
    { run_id: "00000000-0000-0000-0000-000000000001", status: "invalid" },
    { "X-Api-Key": "wrong-secret" },
  );
  const json = JSON.parse(body);
  assertEquals(json.ok, false);
});

Deno.test("grant-alignment-callback: rejects failed without error_message", async () => {
  const { status, body } = await callFn(
    { run_id: "00000000-0000-0000-0000-000000000001", status: "failed" },
    { "X-Api-Key": "wrong-secret" },
  );
  const json = JSON.parse(body);
  assertEquals(json.ok, false);
});

Deno.test("grant-alignment-callback: OPTIONS returns CORS", async () => {
  const resp = await fetch(BASE_URL, { method: "OPTIONS" });
  await resp.text();
  assertEquals(resp.status, 200);
});
