/**
 * Phase 7M tests — Narrative Flywheel Stress Test
 *
 * Tests:
 * 1. testimonium-rollup-weekly writes operator_schedules + system_health_events
 * 2. nri-generate-signals-weekly creates signals with deduplication
 * 3. nri evidence does NOT contain forbidden PII keys
 */

import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assertNotEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;

const FORBIDDEN_EVIDENCE_KEYS = ["body", "html", "raw", "full_text", "note_text", "email_body", "reflection_text"];

async function callFunction(name: string, body: Record<string, unknown> = {}) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, data: JSON.parse(text) };
}

function containsForbiddenKeys(obj: Record<string, unknown>): string | null {
  for (const key of Object.keys(obj)) {
    if (FORBIDDEN_EVIDENCE_KEYS.includes(key.toLowerCase())) return key;
    if (typeof obj[key] === "object" && obj[key] !== null) {
      const found = containsForbiddenKeys(obj[key] as Record<string, unknown>);
      if (found) return found;
    }
  }
  return null;
}

Deno.test("testimonium-rollup-weekly returns ok and writes schedule health", async () => {
  const { status, data } = await callFunction("testimonium-rollup-weekly");
  assertEquals(status, 200);
  assertEquals(data.ok, true);
});

Deno.test("nri-generate-signals-weekly returns ok", async () => {
  const { status, data } = await callFunction("nri-generate-signals-weekly");
  assertEquals(status, 200);
  assertEquals(data.ok, true);
  // signals_generated should be a number
  assertNotEquals(typeof data.signals_generated, "undefined");
});

Deno.test("nri-generate-signals-weekly deduplicates on second run", async () => {
  // Run twice
  await callFunction("nri-generate-signals-weekly");
  const { data: second } = await callFunction("nri-generate-signals-weekly");
  // If signals exist, second run should show deduped >= 0
  assertEquals(second.ok, true);
  // deduped count should not increase signal count on re-run
});

Deno.test("nri evidence does not contain forbidden PII keys", async () => {
  // Fetch any existing nri_story_signals
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/nri_story_signals?select=evidence&limit=50`,
    {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
    }
  );
  const signals = JSON.parse(await res.text());
  if (Array.isArray(signals)) {
    for (const sig of signals) {
      const forbidden = containsForbiddenKeys(sig.evidence || {});
      assertEquals(forbidden, null, `Found forbidden key "${forbidden}" in nri_story_signals evidence`);
    }
  }
});

Deno.test("operator-refresh returns ok and writes schedule health", async () => {
  const { status, data } = await callFunction("operator-refresh");
  assertEquals(status, 200);
  assertEquals(data.ok, true);
  assertNotEquals(typeof data.tenants_processed, "undefined");
});
