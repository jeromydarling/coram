import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

Deno.env.set("DENO_TEST", "1");
Deno.env.set("SUPABASE_URL", "http://localhost:54321");
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "test-key");
Deno.env.set("SUPABASE_ANON_KEY", "test-anon-key");

import { validateBody } from "../index.ts";

// ── validateBody tests ──

Deno.test("validateBody: valid run_id", () => {
  const result = validateBody({ run_id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890" });
  assertEquals(result.valid, true);
  if (result.valid) {
    assertEquals(result.data.run_id, "a1b2c3d4-e5f6-7890-abcd-ef1234567890");
    assertEquals(result.data.campaign_name, undefined);
  }
});

Deno.test("validateBody: valid run_id with campaign_name", () => {
  const result = validateBody({
    run_id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    campaign_name: "My custom campaign",
  });
  assertEquals(result.valid, true);
  if (result.valid) {
    assertEquals(result.data.campaign_name, "My custom campaign");
  }
});

Deno.test("validateBody: missing run_id fails", () => {
  const result = validateBody({});
  assertEquals(result.valid, false);
  if (!result.valid) {
    assertEquals(result.error.includes("run_id"), true);
  }
});

Deno.test("validateBody: invalid run_id fails", () => {
  const result = validateBody({ run_id: "not-a-uuid" });
  assertEquals(result.valid, false);
});

Deno.test("validateBody: null body fails", () => {
  const result = validateBody(null);
  assertEquals(result.valid, false);
});

Deno.test("validateBody: string body fails", () => {
  const result = validateBody("some string");
  assertEquals(result.valid, false);
});

Deno.test("validateBody: campaign_name is trimmed and capped", () => {
  const longName = "A".repeat(300);
  const result = validateBody({
    run_id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    campaign_name: longName,
  });
  assertEquals(result.valid, true);
  if (result.valid) {
    assertEquals(result.data.campaign_name!.length, 200);
  }
});

Deno.test("validateBody: non-string campaign_name ignored", () => {
  const result = validateBody({
    run_id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    campaign_name: 123,
  });
  assertEquals(result.valid, true);
  if (result.valid) {
    assertEquals(result.data.campaign_name, undefined);
  }
});
