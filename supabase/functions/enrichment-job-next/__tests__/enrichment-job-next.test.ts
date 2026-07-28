import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";

// ── Set env BEFORE importing ──
Deno.env.set("ENRICHMENT_WORKER_SECRET", "test_enrich_secret");
Deno.env.set("SUPABASE_URL", "http://localhost:54321");
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key");

import {
  authenticateRequest,
  parseQueryParams,
  buildJobResponse,
} from "../index.ts";

// ── Fixtures ──
const VALID_AUTH = { Authorization: "Bearer test_enrich_secret" };
const BAD_AUTH = { Authorization: "Bearer wrong-token" };
const BASE_URL = "http://localhost:8000/enrichment-job-next";

const JOB_FIXTURE = {
  run_id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
  entity_type: "event",
  entity_id: "11111111-2222-3333-4444-555555555555",
  source_url: "https://example.com/event",
  attempts: 1,
};

// ═══════════════════════════════════════
// authenticateRequest
// ═══════════════════════════════════════

Deno.test("auth: rejects missing authorization header", async () => {
  const req = new Request(BASE_URL, { method: "GET" });
  const result = authenticateRequest(req);
  assertEquals(result.ok, false);
  if (!result.ok) {
    const body = await result.response.json();
    assertEquals(result.response.status, 401);
    assertEquals(body.error, "Unauthorized");
  }
});

Deno.test("auth: rejects wrong bearer token", async () => {
  const req = new Request(BASE_URL, { method: "GET", headers: BAD_AUTH });
  const result = authenticateRequest(req);
  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.response.status, 401);
    await result.response.text(); // consume
  }
});

Deno.test("auth: accepts valid token", () => {
  const req = new Request(BASE_URL, { method: "GET", headers: VALID_AUTH });
  const result = authenticateRequest(req);
  assertEquals(result.ok, true);
});

Deno.test("auth: returns 503 when secret missing", async () => {
  const original = Deno.env.get("ENRICHMENT_WORKER_SECRET")!;
  Deno.env.delete("ENRICHMENT_WORKER_SECRET");
  const req = new Request(BASE_URL, { method: "GET" });
  const result = authenticateRequest(req);
  assertEquals(result.ok, false);
  if (!result.ok) {
    const body = await result.response.json();
    assertEquals(result.response.status, 503);
    assertEquals(body.error, "Server misconfigured");
  }
  Deno.env.set("ENRICHMENT_WORKER_SECRET", original);
});

// ═══════════════════════════════════════
// parseQueryParams
// ═══════════════════════════════════════

Deno.test("params: uses defaults when none provided", () => {
  const p = parseQueryParams(BASE_URL);
  assertEquals(p.leaseSeconds, 300);
  assertEquals(p.workerId, "default");
  assertEquals(p.maxAttempts, 3);
});

Deno.test("params: parses custom values", () => {
  const p = parseQueryParams(`${BASE_URL}?lease_seconds=60&worker_id=w1&max_attempts=5`);
  assertEquals(p.leaseSeconds, 60);
  assertEquals(p.workerId, "w1");
  assertEquals(p.maxAttempts, 5);
});

// ═══════════════════════════════════════
// buildJobResponse
// ═══════════════════════════════════════

Deno.test("response: returns job payload on success", async () => {
  const res = buildJobResponse(JOB_FIXTURE, null);
  const body = await res.json();
  assertEquals(res.status, 200);
  assertEquals(body.ok, true);
  assertEquals(body.job.run_id, JOB_FIXTURE.run_id);
  assertEquals(body.job.entity_type, "event");
  assertEquals(body.job.attempts, 1);
});

Deno.test("response: returns null job when no work available", async () => {
  const res = buildJobResponse(null, null);
  const body = await res.json();
  assertEquals(res.status, 200);
  assertEquals(body.ok, true);
  assertEquals(body.job, null);
});

Deno.test("response: returns 503 on DB error", async () => {
  const res = buildJobResponse(null, { message: "connection refused" });
  const body = await res.json();
  assertEquals(res.status, 503);
  assertEquals(body.ok, false);
  assertEquals(body.error, "Database unavailable");
});

// ═══════════════════════════════════════
// Method guard (via handleRequest — lightweight, no DB)
// ═══════════════════════════════════════

// Import handleRequest for method guard tests only (no DB call triggered)
import { handleRequest } from "../index.ts";

Deno.test({ name: "handler: rejects POST method", sanitizeOps: false, sanitizeResources: false, fn: async () => {
  const res = await handleRequest(new Request(BASE_URL, { method: "POST", headers: VALID_AUTH }));
  const body = await res.json();
  assertEquals(res.status, 405);
  assertEquals(body.ok, false);
}});

Deno.test({ name: "handler: returns CORS on OPTIONS", sanitizeOps: false, sanitizeResources: false, fn: async () => {
  const res = await handleRequest(new Request(BASE_URL, { method: "OPTIONS" }));
  assertEquals(res.status, 200);
  assert(res.headers.get("Access-Control-Allow-Origin") === "*");
}});
