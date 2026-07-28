/**
 * Phase 7S — Testimonium Export Layer tests
 */

import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;

Deno.test("testimonium-export-build rejects unauthenticated", async () => {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/testimonium-export-build`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: ANON_KEY },
    body: JSON.stringify({ tenant_id: "test", period_start: "2026-01-01", period_end: "2026-03-31", export_type: "quarterly" }),
  });
  const data = await res.json();
  assertEquals(res.status, 401);
  assertEquals(data.ok, false);
});

Deno.test("testimonium-export-build rejects missing fields", async () => {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/testimonium-export-build`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: ANON_KEY,
      Authorization: `Bearer ${ANON_KEY}`,
    },
    body: JSON.stringify({ tenant_id: "test" }),
  });
  const data = await res.json();
  // Either 400 or 401 depending on auth
  assertExists(data.error);
});

Deno.test("testimonium-export-render rejects missing export_id", async () => {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/testimonium-export-render`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: ANON_KEY,
      Authorization: `Bearer ${ANON_KEY}`,
    },
    body: JSON.stringify({}),
  });
  const data = await res.json();
  assertEquals(res.status, 400);
  assertEquals(data.ok, false);
});

Deno.test("testimonium-export-render rejects nonexistent export", async () => {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/testimonium-export-render`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: ANON_KEY,
      Authorization: `Bearer ${ANON_KEY}`,
    },
    body: JSON.stringify({ export_id: "00000000-0000-0000-0000-000000000000" }),
  });
  const data = await res.json();
  assertEquals(data.ok, false);
});
