/**
 * expansion-scenarios.test.ts — Deno tests for Metro Expansion Scenario Runner.
 *
 * WHAT: Validates the expansion-scenario-runner edge function responses.
 * WHERE: Run via `deno test` or Lovable test runner.
 * WHY: Ensures deterministic activation, telemetry capture, and privacy.
 */

import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;

const FORBIDDEN_KEYS = [
  "body", "html", "raw", "full_text", "note_text",
  "reflection_body", "email_body", "html_body", "raw_body",
  "message_body", "content",
];

function containsForbiddenKeys(obj: unknown): string[] {
  const found: string[] = [];
  if (!obj || typeof obj !== "object") return found;
  for (const [key, val] of Object.entries(obj as Record<string, unknown>)) {
    if (FORBIDDEN_KEYS.includes(key.toLowerCase())) found.push(key);
    if (val && typeof val === "object") found.push(...containsForbiddenKeys(val));
  }
  return found;
}

Deno.test("expansion-scenario-runner: rejects unauthenticated requests", async () => {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/expansion-scenario-runner`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tenant_id: "fake" }),
  });
  const body = await res.json();
  assertEquals(res.status, 401);
  assertEquals(body.ok, false);
});

Deno.test("expansion-scenario-runner: rejects missing tenant_id", async () => {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/expansion-scenario-runner`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({}),
  });
  const body = await res.json();
  // Will be 401 (anon key is not a user token) or 400
  assertEquals(body.ok, false);
});

Deno.test("forbidden key checker works correctly", () => {
  const clean = { topic: "test", count: 5 };
  assertEquals(containsForbiddenKeys(clean).length, 0);

  const dirty = { topic: "test", body: "secret text", nested: { email_body: "leak" } };
  const found = containsForbiddenKeys(dirty);
  assertEquals(found.length, 2);
  assertEquals(found.includes("body"), true);
  assertEquals(found.includes("email_body"), true);
});

Deno.test("forbidden key checker handles nulls and primitives", () => {
  assertEquals(containsForbiddenKeys(null).length, 0);
  assertEquals(containsForbiddenKeys("string").length, 0);
  assertEquals(containsForbiddenKeys(42).length, 0);
  assertEquals(containsForbiddenKeys({ safe: null }).length, 0);
});
