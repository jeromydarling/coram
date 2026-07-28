import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";

// ── Set env BEFORE importing ──
Deno.env.set("ENRICHMENT_WORKER_SECRET", "test_enrich_secret");
Deno.env.set("SUPABASE_URL", "http://localhost:54321");
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key");

import {
  authenticateRequest,
  validateBody,
  buildDuplicateResponse,
  buildCreatedResponse,
  handleRequest,
} from "../index.ts";

// ── Fixtures ──
const VALID_AUTH = { Authorization: "Bearer test_enrich_secret" };
const BAD_AUTH = { Authorization: "Bearer wrong-token" };
const BASE_URL = "http://localhost:8000/enrichment-job-enqueue";

const DETERMINISTIC_RUN_ID = "aaaaaaaa-1111-2222-3333-444444444444";
const DETERMINISTIC_ENTITY_ID = "bbbbbbbb-1111-2222-3333-444444444444";

const VALID_BODY = {
  run_id: DETERMINISTIC_RUN_ID,
  entity_type: "grant",
  entity_id: DETERMINISTIC_ENTITY_ID,
  source_url: "https://example.com/grant-page",
};

const VALID_BODY_NO_RUN_ID = {
  entity_type: "event",
  entity_id: DETERMINISTIC_ENTITY_ID,
  source_url: "https://example.com/event-page",
};

// ═══════════════════════════════════════
// authenticateRequest
// ═══════════════════════════════════════

Deno.test("enqueue auth: rejects missing header", async () => {
  const req = new Request(BASE_URL, { method: "POST" });
  const result = await authenticateRequest(req);
  assertEquals(result.ok, false);
  if (!result.ok) {
    const body = await result.response.json();
    assertEquals(result.response.status, 401);
    assertEquals(body.error, "Unauthorized");
  }
});

Deno.test("enqueue auth: rejects wrong token", async () => {
  const req = new Request(BASE_URL, { method: "POST", headers: BAD_AUTH });
  const result = await authenticateRequest(req);
  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.response.status, 401);
    await result.response.text();
  }
});

Deno.test("enqueue auth: accepts valid token", async () => {
  const req = new Request(BASE_URL, { method: "POST", headers: VALID_AUTH });
  const result = await authenticateRequest(req);
  assertEquals(result.ok, true);
});

Deno.test("enqueue auth: 503 when secret missing", async () => {
  const original = Deno.env.get("ENRICHMENT_WORKER_SECRET")!;
  Deno.env.delete("ENRICHMENT_WORKER_SECRET");
  const origUrl = Deno.env.get("SUPABASE_URL");
  const origAnon = Deno.env.get("SUPABASE_ANON_KEY");
  Deno.env.delete("SUPABASE_URL");
  Deno.env.delete("SUPABASE_ANON_KEY");
  try {
    const req = new Request(BASE_URL, { method: "POST" });
    const result = await authenticateRequest(req);
    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.response.status, 503);
      const body = await result.response.json();
      assertEquals(body.error, "Server misconfigured");
    }
  } finally {
    Deno.env.set("ENRICHMENT_WORKER_SECRET", original);
    if (origUrl) Deno.env.set("SUPABASE_URL", origUrl);
    if (origAnon) Deno.env.set("SUPABASE_ANON_KEY", origAnon);
  }
});

// ═══════════════════════════════════════
// validateBody
// ═══════════════════════════════════════

Deno.test("validate: accepts valid body with run_id", () => {
  const result = validateBody(VALID_BODY);
  assertEquals(result.valid, true);
  if (result.valid) {
    assertEquals(result.data.run_id, DETERMINISTIC_RUN_ID);
    assertEquals(result.data.entity_type, "grant");
  }
});

Deno.test("validate: accepts valid body without run_id", () => {
  const result = validateBody(VALID_BODY_NO_RUN_ID);
  assertEquals(result.valid, true);
  if (result.valid) {
    assertEquals(result.data.run_id, undefined);
  }
});

Deno.test("validate: rejects non-object body", () => {
  const result = validateBody("not an object");
  assertEquals(result.valid, false);
  if (!result.valid) {
    assert(result.errors.length > 0);
  }
});

Deno.test("validate: rejects null body", () => {
  const result = validateBody(null);
  assertEquals(result.valid, false);
});

Deno.test("validate: rejects invalid entity_type", () => {
  const result = validateBody({ ...VALID_BODY, entity_type: "invoice" });
  assertEquals(result.valid, false);
  if (!result.valid) {
    assert(result.errors.some(e => e.includes("entity_type")));
  }
});

Deno.test("validate: rejects invalid entity_id (not uuid)", () => {
  const result = validateBody({ ...VALID_BODY, entity_id: "not-a-uuid" });
  assertEquals(result.valid, false);
  if (!result.valid) {
    assert(result.errors.some(e => e.includes("entity_id")));
  }
});

Deno.test("validate: rejects missing entity_id", () => {
  const { entity_id: _, ...body } = VALID_BODY;
  const result = validateBody(body);
  assertEquals(result.valid, false);
  if (!result.valid) {
    assert(result.errors.some(e => e.includes("entity_id")));
  }
});

Deno.test("validate: rejects invalid source_url", () => {
  const result = validateBody({ ...VALID_BODY, source_url: "ftp://bad" });
  assertEquals(result.valid, false);
  if (!result.valid) {
    assert(result.errors.some(e => e.includes("source_url")));
  }
});

Deno.test("validate: rejects missing source_url", () => {
  const { source_url: _, ...body } = VALID_BODY;
  const result = validateBody(body);
  assertEquals(result.valid, false);
  if (!result.valid) {
    assert(result.errors.some(e => e.includes("source_url")));
  }
});

Deno.test("validate: rejects invalid run_id format", () => {
  const result = validateBody({ ...VALID_BODY, run_id: "not-uuid" });
  assertEquals(result.valid, false);
  if (!result.valid) {
    assert(result.errors.some(e => e.includes("run_id")));
  }
});

Deno.test("validate: collects multiple errors", () => {
  const result = validateBody({ entity_type: "bad", entity_id: "bad", source_url: "bad" });
  assertEquals(result.valid, false);
  if (!result.valid) {
    assert(result.errors.length >= 3);
  }
});

// ═══════════════════════════════════════
// buildDuplicateResponse / buildCreatedResponse
// ═══════════════════════════════════════

Deno.test("duplicate response: 200 with duplicate=true", async () => {
  const job = { id: "test-id", run_id: DETERMINISTIC_RUN_ID, status: "queued" };
  const res = buildDuplicateResponse(job);
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.ok, true);
  assertEquals(body.duplicate, true);
  assertEquals(body.job.run_id, DETERMINISTIC_RUN_ID);
});

Deno.test("created response: 201 with duplicate=false", async () => {
  const job = { id: "new-id", run_id: DETERMINISTIC_RUN_ID, status: "queued" };
  const res = buildCreatedResponse(job);
  assertEquals(res.status, 201);
  const body = await res.json();
  assertEquals(body.ok, true);
  assertEquals(body.duplicate, false);
  assertEquals(body.job.status, "queued");
});

// ═══════════════════════════════════════
// handleRequest — method guards (no DB)
// ═══════════════════════════════════════

Deno.test({ name: "handler: rejects GET method", sanitizeOps: false, sanitizeResources: false, fn: async () => {
  const res = await handleRequest(new Request(BASE_URL, { method: "GET", headers: VALID_AUTH }));
  const body = await res.json();
  assertEquals(res.status, 405);
  assertEquals(body.ok, false);
}});

Deno.test({ name: "handler: returns CORS on OPTIONS", sanitizeOps: false, sanitizeResources: false, fn: async () => {
  const res = await handleRequest(new Request(BASE_URL, { method: "OPTIONS" }));
  assertEquals(res.status, 200);
  assert(res.headers.get("Access-Control-Allow-Origin") === "*");
}});

Deno.test({ name: "handler: rejects invalid JSON", sanitizeOps: false, sanitizeResources: false, fn: async () => {
  const res = await handleRequest(new Request(BASE_URL, {
    method: "POST",
    headers: { ...VALID_AUTH, "Content-Type": "application/json" },
    body: "not json{{{",
  }));
  const body = await res.json();
  assertEquals(res.status, 400);
  assertEquals(body.error, "Invalid JSON");
}});

Deno.test({ name: "handler: rejects invalid body fields", sanitizeOps: false, sanitizeResources: false, fn: async () => {
  const res = await handleRequest(new Request(BASE_URL, {
    method: "POST",
    headers: { ...VALID_AUTH, "Content-Type": "application/json" },
    body: JSON.stringify({ entity_type: "bad" }),
  }));
  const body = await res.json();
  assertEquals(res.status, 400);
  assert(body.errors.length > 0);
}});
