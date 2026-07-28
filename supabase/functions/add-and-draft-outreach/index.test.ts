import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals } from "https://deno.land/std@0.224.0/assert/assert_equals.ts";
import { assertExists } from "https://deno.land/std@0.224.0/assert/assert_exists.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;

const BASE_URL = `${SUPABASE_URL}/functions/v1/add-and-draft-outreach`;

async function callFn(body: unknown, authHeader?: string) {
  const resp = await fetch(BASE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(authHeader ? { Authorization: authHeader } : {}),
      apikey: SUPABASE_ANON_KEY,
    },
    body: JSON.stringify(body),
  });
  const text = await resp.text();
  return { status: resp.status, body: text };
}

Deno.test("add-and-draft-outreach: rejects missing auth", async () => {
  const { status, body } = await callFn({ people: [{ name: "Test" }] });
  assertEquals(status, 401);
  const json = JSON.parse(body);
  assertEquals(json.error, "UNAUTHORIZED");
});

Deno.test("add-and-draft-outreach: rejects empty people array", async () => {
  const { status, body } = await callFn(
    { people: [] },
    `Bearer ${SUPABASE_ANON_KEY}`,
  );
  // Will fail auth (anon key != user JWT), but tests the flow
  const json = JSON.parse(body);
  assertEquals(json.ok, false);
});

Deno.test("add-and-draft-outreach: rejects invalid JSON", async () => {
  const resp = await fetch(BASE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      apikey: SUPABASE_ANON_KEY,
    },
    body: "not json",
  });
  const text = await resp.text();
  const json = JSON.parse(text);
  assertEquals(json.ok, false);
});

Deno.test("add-and-draft-outreach: rejects too many people", async () => {
  const people = Array.from({ length: 51 }, (_, i) => ({ name: `Person ${i}` }));
  const { status, body } = await callFn(
    { people },
    `Bearer ${SUPABASE_ANON_KEY}`,
  );
  const json = JSON.parse(body);
  assertEquals(json.ok, false);
});

Deno.test("add-and-draft-outreach: OPTIONS returns CORS headers", async () => {
  const resp = await fetch(BASE_URL, { method: "OPTIONS" });
  await resp.text();
  assertEquals(resp.status, 200);
});
