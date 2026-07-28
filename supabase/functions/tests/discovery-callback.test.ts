import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";

// ── Set env BEFORE importing ──
Deno.env.set("ENRICHMENT_WORKER_SECRET", "test_enrich_secret");
Deno.env.set("N8N_SHARED_SECRET", "test_shared_secret");
Deno.env.set("SUPABASE_URL", "http://localhost:54321");
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key");

import { validateBody, authenticateServiceRequest } from "../discovery-callback/index.ts";

const VALID_RUN_ID = "12345678-1234-1234-1234-123456789abc";

// ── Unit Tests ──

Deno.test("validateBody: valid completed payload", () => {
  const result = validateBody({
    run_id: VALID_RUN_ID,
    status: "completed",
    module: "events",
    scope: "metro",
    items: [{ canonical_url: "https://example.com", title: "Test Event" }],
    briefing_json: { highlights: [] },
    briefing_md: "# Briefing",
  });
  assertEquals(result.valid, true);
  if (result.valid) {
    assertEquals(result.data.run_id, VALID_RUN_ID);
    assertEquals(result.data.status, "completed");
    assertEquals(result.data.items.length, 1);
  }
});

Deno.test("validateBody: valid failed payload", () => {
  const result = validateBody({
    run_id: VALID_RUN_ID,
    status: "failed",
    module: "grants",
    scope: "opportunity",
    error: { message: "timeout" },
  });
  assertEquals(result.valid, true);
});

Deno.test("validateBody: invalid run_id", () => {
  const result = validateBody({
    run_id: "not-a-uuid",
    status: "completed",
    module: "events",
    scope: "metro",
    items: [],
    briefing_json: {},
    briefing_md: "",
  });
  assertEquals(result.valid, false);
});

Deno.test("validateBody: invalid module", () => {
  const result = validateBody({
    run_id: VALID_RUN_ID,
    status: "completed",
    module: "invalid",
    scope: "metro",
    items: [],
    briefing_json: {},
    briefing_md: "",
  });
  assertEquals(result.valid, false);
});

Deno.test("validateBody: missing items for completed", () => {
  const result = validateBody({
    run_id: VALID_RUN_ID,
    status: "completed",
    module: "events",
    scope: "metro",
    briefing_json: {},
    briefing_md: "",
  });
  assertEquals(result.valid, false);
});

Deno.test("validateBody: missing briefing_md for completed", () => {
  const result = validateBody({
    run_id: VALID_RUN_ID,
    status: "completed",
    module: "events",
    scope: "metro",
    items: [],
    briefing_json: {},
  });
  assertEquals(result.valid, false);
});

Deno.test("validateBody: empty items array is valid", () => {
  const result = validateBody({
    run_id: VALID_RUN_ID,
    status: "completed",
    module: "people",
    scope: "opportunity",
    items: [],
    briefing_json: {},
    briefing_md: "No results found.",
  });
  assertEquals(result.valid, true);
  if (result.valid) {
    assertEquals(result.data.items.length, 0);
  }
});

Deno.test("validateBody: null body", () => {
  const result = validateBody(null);
  assertEquals(result.valid, false);
});

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
