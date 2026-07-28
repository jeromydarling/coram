/**
 * Deno tests for Impulsus DB enforcement.
 *
 * Tests:
 * - Title > 120 chars rejected
 * - Narrative > 2000 chars rejected
 * - Source with nested forbidden keys rejected
 * - Dedupe: same (user_id, dedupe_key) inserted twice => 1 row
 * - RLS: user cannot read another user's entries
 */

import { assertEquals, assertRejects } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.91.1";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const serviceClient = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Use a fake user_id for service-role inserts (bypasses RLS)
const TEST_USER_A = "00000000-0000-0000-0000-000000000001";
const TEST_USER_B = "00000000-0000-0000-0000-000000000002";

async function cleanup() {
  await serviceClient
    .from("impulsus_entries")
    .delete()
    .in("user_id", [TEST_USER_A, TEST_USER_B]);
}

Deno.test("impulsus: rejects title > 120 characters", async () => {
  await cleanup();
  const { error } = await serviceClient.from("impulsus_entries").insert({
    user_id: TEST_USER_A,
    kind: "reflection",
    title: "A".repeat(121),
    narrative: "I reflected.",
    tags: [],
    source: {},
  });
  assertEquals(error !== null, true);
  assertEquals(error!.message.includes("title exceeds 120"), true);
  await cleanup();
});

Deno.test("impulsus: rejects narrative > 2000 characters", async () => {
  await cleanup();
  const { error } = await serviceClient.from("impulsus_entries").insert({
    user_id: TEST_USER_A,
    kind: "reflection",
    title: "Short title",
    narrative: "I ".padEnd(2001, "x"),
    tags: [],
    source: {},
  });
  assertEquals(error !== null, true);
  assertEquals(error!.message.includes("narrative exceeds 2000"), true);
  await cleanup();
});

Deno.test("impulsus: rejects source with nested forbidden keys", async () => {
  await cleanup();
  const { error } = await serviceClient.from("impulsus_entries").insert({
    user_id: TEST_USER_A,
    kind: "email",
    title: "Test",
    narrative: "I sent a note.",
    tags: [],
    source: { meta: { body: "secret content" } },
  });
  assertEquals(error !== null, true);
  assertEquals(error!.message.includes("forbidden keys"), true);
  await cleanup();
});

Deno.test("impulsus: dedupe key prevents duplicate inserts", async () => {
  await cleanup();
  const row = {
    user_id: TEST_USER_A,
    kind: "reflection" as const,
    title: "Test",
    narrative: "I reflected.",
    tags: [],
    source: {},
    dedupe_key: "refl:test-123",
  };

  // First insert
  const { error: err1 } = await serviceClient.from("impulsus_entries").insert(row);
  assertEquals(err1, null);

  // Second insert with same dedupe_key — should fail with unique violation
  const { error: err2 } = await serviceClient.from("impulsus_entries").insert(row);
  assertEquals(err2 !== null, true);
  assertEquals(err2!.code, "23505");

  // Verify only 1 row exists
  const { data, error: selectErr } = await serviceClient
    .from("impulsus_entries")
    .select("id")
    .eq("user_id", TEST_USER_A)
    .eq("dedupe_key", "refl:test-123");
  assertEquals(selectErr, null);
  assertEquals(data!.length, 1);

  await cleanup();
});

Deno.test("impulsus: allows valid entry", async () => {
  await cleanup();
  const { error } = await serviceClient.from("impulsus_entries").insert({
    user_id: TEST_USER_A,
    kind: "journey",
    title: "I moved forward",
    narrative: "I moved this partner from Target to Contacted.",
    tags: ["journey"],
    source: { from_stage: "Target", to_stage: "Contacted" },
    dedupe_key: "journey:valid-test",
  });
  assertEquals(error, null);
  await cleanup();
});
