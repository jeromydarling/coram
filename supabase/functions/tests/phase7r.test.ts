/**
 * Phase 7R — Narrative Economy tests.
 *
 * WHAT: Tests narrative-detect-moments and narrative-build-outline edge functions.
 * WHERE: Deno test runner.
 * WHY: Ensures deterministic moment detection, deduplication, and no PII leakage.
 */

import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;

const headers = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${ANON_KEY}`,
  apikey: ANON_KEY,
};

Deno.test("narrative-detect-moments returns ok", async () => {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/narrative-detect-moments`, {
    method: "POST",
    headers,
    body: JSON.stringify({}),
  });
  const body = await res.json();
  assertEquals(res.status, 200);
  assertEquals(body.ok, true);
  assertExists(body.moments_created);
  assertExists(body.rollups_scanned);
});

Deno.test("narrative-detect-moments is idempotent (second run same window)", async () => {
  // First run
  const res1 = await fetch(`${SUPABASE_URL}/functions/v1/narrative-detect-moments`, {
    method: "POST",
    headers,
    body: JSON.stringify({}),
  });
  const body1 = await res1.json();
  assertEquals(body1.ok, true);
  const first = body1.moments_created;

  // Second run — should create 0 new moments
  const res2 = await fetch(`${SUPABASE_URL}/functions/v1/narrative-detect-moments`, {
    method: "POST",
    headers,
    body: JSON.stringify({}),
  });
  const body2 = await res2.json();
  assertEquals(body2.ok, true);
  assertEquals(body2.moments_created, 0);
});

Deno.test("narrative-build-outline requires tenant_id", async () => {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/narrative-build-outline`, {
    method: "POST",
    headers,
    body: JSON.stringify({}),
  });
  const body = await res.json();
  assertEquals(res.status, 400);
  assertEquals(body.ok, false);
});

Deno.test("narrative-build-outline with fake tenant returns gracefully", async () => {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/narrative-build-outline`, {
    method: "POST",
    headers,
    body: JSON.stringify({ tenant_id: "00000000-0000-0000-0000-000000000000" }),
  });
  const body = await res.json();
  assertEquals(res.status, 200);
  assertEquals(body.ok, true);
  assertEquals(body.drafts_created, 0);
});

Deno.test("narrative-detect-moments response has no PII fields", async () => {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/narrative-detect-moments`, {
    method: "POST",
    headers,
    body: JSON.stringify({}),
  });
  const raw = await res.text();
  const forbidden = ["email_body", "phone_number", "ssn", "password"];
  for (const key of forbidden) {
    assertEquals(raw.includes(key), false, `Response must not contain PII key: ${key}`);
  }
});
