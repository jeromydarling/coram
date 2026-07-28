import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";

// ── Set env BEFORE importing ──
Deno.env.set("ENRICHMENT_WORKER_SECRET", "test_enrich_secret");
Deno.env.set("N8N_SHARED_SECRET", "test_shared_secret");
Deno.env.set("SUPABASE_URL", "http://localhost:54321");
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key");

import {
  authenticateServiceRequest,
  validateInput,
} from "../event-coattendance/index.ts";

const VALID_UUID = "12345678-1234-1234-1234-123456789abc";
const VALID_UUID2 = "22345678-1234-1234-1234-123456789abc";

// ── Validation Tests ──

Deno.test("validateInput: valid payload", () => {
  const result = validateInput({
    run_id: VALID_UUID,
    event_item_id: VALID_UUID,
    opportunity_ids: [VALID_UUID2],
  });
  assertEquals(result.valid, true);
  if (result.valid) {
    assertEquals(result.data.attendance_type, "attended");
  }
});

Deno.test("validateInput: missing event_item_id", () => {
  const result = validateInput({
    run_id: VALID_UUID,
    opportunity_ids: [VALID_UUID2],
  });
  assertEquals(result.valid, false);
});

Deno.test("validateInput: empty opportunity_ids", () => {
  const result = validateInput({
    run_id: VALID_UUID,
    event_item_id: VALID_UUID,
    opportunity_ids: [],
  });
  assertEquals(result.valid, false);
});

Deno.test("validateInput: invalid UUID in opportunity_ids", () => {
  const result = validateInput({
    run_id: VALID_UUID,
    event_item_id: VALID_UUID,
    opportunity_ids: ["not-a-uuid"],
  });
  assertEquals(result.valid, false);
});

Deno.test("validateInput: custom attendance_type", () => {
  const result = validateInput({
    run_id: VALID_UUID,
    event_item_id: VALID_UUID,
    opportunity_ids: [VALID_UUID2],
    attendance_type: "speaking",
  });
  assertEquals(result.valid, true);
  if (result.valid) {
    assertEquals(result.data.attendance_type, "speaking");
  }
});

Deno.test("validateInput: invalid attendance_type", () => {
  const result = validateInput({
    run_id: VALID_UUID,
    event_item_id: VALID_UUID,
    opportunity_ids: [VALID_UUID2],
    attendance_type: "invalid",
  });
  assertEquals(result.valid, false);
});

Deno.test("validateInput: null body", () => {
  const result = validateInput(null);
  assertEquals(result.valid, false);
});

// ── Auth Tests ──

Deno.test("auth: rejects missing token", () => {
  const req = new Request("http://localhost/test", { method: "POST" });
  assertEquals(authenticateServiceRequest(req), false);
});

Deno.test("auth: accepts enrichment secret", () => {
  const req = new Request("http://localhost/test", {
    method: "POST",
    headers: { "x-api-key": "test_enrich_secret" },
  });
  assertEquals(authenticateServiceRequest(req), true);
});

Deno.test("auth: accepts service role key via Bearer", () => {
  const req = new Request("http://localhost/test", {
    method: "POST",
    headers: { "authorization": "Bearer test-service-role-key" },
  });
  assertEquals(authenticateServiceRequest(req), true);
});
