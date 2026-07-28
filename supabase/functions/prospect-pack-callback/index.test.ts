import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { validateBody } from "./index.ts";

// ── Unit tests for validation ──

Deno.test("validateBody: valid completed payload", () => {
  const result = validateBody({
    run_id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    entity_id: "b2c3d4e5-f6a7-8901-bcde-f12345678901",
    entity_type: "opportunity",
    status: "completed",
    pack: {
      org_summary: "Test org",
      mission_snapshot: "Serve communities",
      partnership_angles: ["Digital equity"],
      grant_alignments: ["FCC ACP"],
      suggested_outreach_angle: "Partnership intro",
      risks_notes: ["Small staff"],
    },
  });
  assertEquals(result.valid, true);
});

Deno.test("validateBody: valid failed payload", () => {
  const result = validateBody({
    run_id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    entity_id: "b2c3d4e5-f6a7-8901-bcde-f12345678901",
    status: "failed",
    error_message: "Firecrawl timeout",
  });
  assertEquals(result.valid, true);
});

Deno.test("validateBody: missing run_id", () => {
  const result = validateBody({
    entity_id: "b2c3d4e5-f6a7-8901-bcde-f12345678901",
    status: "completed",
    pack: { org_summary: "test" },
  });
  assertEquals(result.valid, false);
});

Deno.test("validateBody: invalid run_id", () => {
  const result = validateBody({
    run_id: "not-a-uuid",
    entity_id: "b2c3d4e5-f6a7-8901-bcde-f12345678901",
    status: "completed",
    pack: { org_summary: "test" },
  });
  assertEquals(result.valid, false);
});

Deno.test("validateBody: missing entity_id", () => {
  const result = validateBody({
    run_id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    status: "completed",
    pack: { org_summary: "test" },
  });
  assertEquals(result.valid, false);
});

Deno.test("validateBody: missing pack on completed", () => {
  const result = validateBody({
    run_id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    entity_id: "b2c3d4e5-f6a7-8901-bcde-f12345678901",
    status: "completed",
  });
  assertEquals(result.valid, false);
});

Deno.test("validateBody: missing error_message on failed", () => {
  const result = validateBody({
    run_id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    entity_id: "b2c3d4e5-f6a7-8901-bcde-f12345678901",
    status: "failed",
  });
  assertEquals(result.valid, false);
});

Deno.test("validateBody: invalid status", () => {
  const result = validateBody({
    run_id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    entity_id: "b2c3d4e5-f6a7-8901-bcde-f12345678901",
    status: "pending",
    pack: {},
  });
  assertEquals(result.valid, false);
});

Deno.test("validateBody: null body", () => {
  const result = validateBody(null);
  assertEquals(result.valid, false);
});

Deno.test("validateBody: defensive string coercion for run_id", () => {
  const result = validateBody({
    run_id: " a1b2c3d4-e5f6-7890-abcd-ef1234567890 ",
    entity_id: "b2c3d4e5-f6a7-8901-bcde-f12345678901",
    status: "completed",
    pack: { org_summary: "test" },
  });
  assertEquals(result.valid, true);
  if (result.valid) {
    assertEquals(result.data.run_id, "a1b2c3d4-e5f6-7890-abcd-ef1234567890");
  }
});

// ── Integration tests ──

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;
const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/prospect-pack-callback`;

Deno.test("prospect-pack-callback: rejects missing auth", async () => {
  const resp = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      run_id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      entity_id: "b2c3d4e5-f6a7-8901-bcde-f12345678901",
      status: "completed",
      pack: { org_summary: "test" },
    }),
  });
  const text = await resp.text();
  assertEquals(resp.status, 401);
});

Deno.test("prospect-pack-callback: rejects invalid auth", async () => {
  const resp = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer invalid-token-xyz",
    },
    body: JSON.stringify({
      run_id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      entity_id: "b2c3d4e5-f6a7-8901-bcde-f12345678901",
      status: "completed",
      pack: { org_summary: "test" },
    }),
  });
  const text = await resp.text();
  assertEquals(resp.status, 401);
});

Deno.test("prospect-pack-callback: rejects invalid JSON", async () => {
  const resp = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: "not json",
  });
  const text = await resp.text();
  // Will be 400 or 401 depending on auth - just verify we get an error
  assertEquals(resp.ok, false);
});

Deno.test("prospect-pack-callback: rejects GET method", async () => {
  const resp = await fetch(FUNCTION_URL, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
  });
  const text = await resp.text();
  assertEquals(resp.status, 405);
});
