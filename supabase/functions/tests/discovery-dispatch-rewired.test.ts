import { assertEquals, assertExists } from "https://deno.land/std@0.208.0/assert/mod.ts";

// ── Set env BEFORE importing ──
Deno.env.set("ENRICHMENT_WORKER_SECRET", "test_enrich_secret");
Deno.env.set("N8N_SHARED_SECRET", "test_shared_secret");
Deno.env.set("SUPABASE_URL", "http://localhost:54321");
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key");
Deno.env.set("N8N_WEBHOOK_BASE_URL", "http://localhost:5678");

import { validateInput, authenticateServiceRequest } from "../discovery-dispatch/index.ts";

const VALID_UUID = "12345678-1234-1234-1234-123456789abc";

// ── validateInput ──

Deno.test("validateInput: valid metro scope - events", () => {
  const result = validateInput({ module: "events", scope: "metro", metro_id: VALID_UUID });
  assertEquals(result.valid, true);
  if (result.valid) {
    assertEquals(result.data.module, "events");
    assertEquals(result.data.scope, "metro");
  }
});

Deno.test("validateInput: valid metro scope - grants", () => {
  const result = validateInput({ module: "grants", scope: "metro", metro_id: VALID_UUID });
  assertEquals(result.valid, true);
});

Deno.test("validateInput: valid metro scope - people", () => {
  const result = validateInput({ module: "people", scope: "metro", metro_id: VALID_UUID });
  assertEquals(result.valid, true);
});

Deno.test("validateInput: valid opportunity scope", () => {
  const result = validateInput({ module: "grants", scope: "opportunity", opportunity_id: VALID_UUID });
  assertEquals(result.valid, true);
});

Deno.test("validateInput: invalid module", () => {
  const result = validateInput({ module: "invalid", scope: "metro", metro_id: VALID_UUID });
  assertEquals(result.valid, false);
});

Deno.test("validateInput: missing metro_id for metro scope", () => {
  const result = validateInput({ module: "events", scope: "metro" });
  assertEquals(result.valid, false);
});

Deno.test("validateInput: missing opportunity_id for opportunity scope", () => {
  const result = validateInput({ module: "people", scope: "opportunity" });
  assertEquals(result.valid, false);
});

Deno.test("validateInput: null body", () => {
  const result = validateInput(null);
  assertEquals(result.valid, false);
});

Deno.test("validateInput: invalid UUID for metro_id", () => {
  const result = validateInput({ module: "events", scope: "metro", metro_id: "not-uuid" });
  assertEquals(result.valid, false);
});

// ── authenticateServiceRequest ──

Deno.test("discovery-dispatch auth: rejects missing token", () => {
  const req = new Request("http://localhost/test", { method: "POST" });
  assertEquals(authenticateServiceRequest(req), false);
});

Deno.test("discovery-dispatch auth: accepts enrichment secret via x-api-key", () => {
  const req = new Request("http://localhost/test", {
    method: "POST",
    headers: { "x-api-key": "test_enrich_secret" },
  });
  assertEquals(authenticateServiceRequest(req), true);
});

Deno.test("discovery-dispatch auth: accepts service role key via Bearer", () => {
  const req = new Request("http://localhost/test", {
    method: "POST",
    headers: { "authorization": "Bearer test-service-role-key" },
  });
  assertEquals(authenticateServiceRequest(req), true);
});

Deno.test("discovery-dispatch auth: accepts n8n shared secret via Bearer", () => {
  const req = new Request("http://localhost/test", {
    method: "POST",
    headers: { "authorization": "Bearer test_shared_secret" },
  });
  assertEquals(authenticateServiceRequest(req), true);
});

Deno.test("discovery-dispatch auth: rejects invalid token", () => {
  const req = new Request("http://localhost/test", {
    method: "POST",
    headers: { "x-api-key": "wrong_secret" },
  });
  assertEquals(authenticateServiceRequest(req), false);
});
