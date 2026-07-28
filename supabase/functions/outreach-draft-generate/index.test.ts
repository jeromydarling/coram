import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { validateBody } from "./index.ts";

Deno.test("validateBody: valid partnership_intro", () => {
  const result = validateBody({
    opportunity_id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    outreach_mode: "partnership_intro",
  });
  assertEquals(result.valid, true);
});

Deno.test("validateBody: valid grant_collaboration with campaign", () => {
  const result = validateBody({
    opportunity_id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    outreach_mode: "grant_collaboration",
    campaign_id: "b2c3d4e5-f6a7-8901-bcde-f12345678901",
    contact_names: ["Jane Doe", "John Smith"],
  });
  assertEquals(result.valid, true);
  if (result.valid) {
    assertEquals(result.data.contact_names?.length, 2);
  }
});

Deno.test("validateBody: valid follow_up", () => {
  const result = validateBody({
    opportunity_id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    outreach_mode: "follow_up",
  });
  assertEquals(result.valid, true);
});

Deno.test("validateBody: invalid mode", () => {
  const result = validateBody({
    opportunity_id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    outreach_mode: "cold_call",
  });
  assertEquals(result.valid, false);
});

Deno.test("validateBody: missing opportunity_id", () => {
  const result = validateBody({
    outreach_mode: "partnership_intro",
  });
  assertEquals(result.valid, false);
});

Deno.test("validateBody: invalid opportunity_id", () => {
  const result = validateBody({
    opportunity_id: "not-a-uuid",
    outreach_mode: "partnership_intro",
  });
  assertEquals(result.valid, false);
});

Deno.test("validateBody: invalid campaign_id", () => {
  const result = validateBody({
    opportunity_id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    outreach_mode: "partnership_intro",
    campaign_id: "bad",
  });
  assertEquals(result.valid, false);
});

Deno.test("validateBody: null body", () => {
  const result = validateBody(null);
  assertEquals(result.valid, false);
});

Deno.test("validateBody: all five modes accepted", () => {
  const modes = ["partnership_intro", "grant_collaboration", "event_networking", "leadership_intro", "follow_up"];
  for (const mode of modes) {
    const result = validateBody({
      opportunity_id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      outreach_mode: mode,
    });
    assertEquals(result.valid, true, `Mode ${mode} should be valid`);
  }
});

// Integration tests
const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;
const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/outreach-draft-generate`;

Deno.test("outreach-draft-generate: rejects missing auth", async () => {
  const resp = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      opportunity_id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      outreach_mode: "partnership_intro",
    }),
  });
  const text = await resp.text();
  assertEquals(resp.status, 401);
});

Deno.test("outreach-draft-generate: rejects GET", async () => {
  const resp = await fetch(FUNCTION_URL, {
    method: "GET",
    headers: { Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
  });
  const text = await resp.text();
  assertEquals(resp.status, 405);
});
