import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";

// ── Set env BEFORE importing ──
Deno.env.set("ENRICHMENT_WORKER_SECRET", "test_enrich_secret");
Deno.env.set("N8N_SHARED_SECRET", "test_shared_secret");
Deno.env.set("SUPABASE_URL", "http://localhost:54321");
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key");

import {
  validateEnvelope,
  authenticateRequest,
  buildDuplicateResponse,
  buildSuccessResponse,
  deriveJobStatus,
  extractSuggestedContacts,
  handleRequest,
} from "../index.ts";

// ── Fixtures ──
const VALID_AUTH_HEADERS = {
  Authorization: "Bearer test_enrich_secret",
  "Content-Type": "application/json",
};
const VALID_SHARED_HEADERS = {
  "X-Api-Key": "test_shared_secret",
  "Content-Type": "application/json",
};
const BAD_AUTH_HEADERS = {
  Authorization: "Bearer wrong-token",
  "Content-Type": "application/json",
};
const BASE_URL = "http://localhost:8000/enrichment-callback";

function validPayload(overrides: Record<string, unknown> = {}) {
  return {
    run_id: "aaaaaaaa-1111-2222-3333-444444444444",
    workflow: "enrich_event",
    status: "success",
    entity_type: "event",
    entity_id: "bbbbbbbb-1111-2222-3333-444444444444",
    source_url: "https://example.com/event",
    scrape: { ok: true, bytes: 4096 },
    enrichment: { title: "Annual Gala", date: "2026-03-15" },
    error: null,
    occurred_at: "2026-02-09T12:00:00Z",
    ...overrides,
  };
}

// ═══════════════════════════════════════
// validateEnvelope (pure, no I/O)
// ═══════════════════════════════════════

Deno.test("validate: accepts valid success payload", () => {
  const r = validateEnvelope(validPayload());
  assertEquals(r.valid, true);
});

Deno.test("validate: accepts all three entity types", () => {
  for (const t of ["event", "opportunity", "grant"]) {
    const r = validateEnvelope(validPayload({ entity_type: t }));
    assertEquals(r.valid, true);
  }
});

Deno.test("validate: accepts all three status values", () => {
  for (const s of ["success", "error", "no_data"]) {
    const overrides: Record<string, unknown> = { status: s };
    if (s === "error") overrides.error = { code: "X", message: "Y" };
    const r = validateEnvelope(validPayload(overrides));
    assertEquals(r.valid, true);
  }
});

Deno.test("validate: rejects missing fields", () => {
  const r = validateEnvelope({ run_id: "abc" });
  assertEquals(r.valid, false);
  assert((r as { errors: string[] }).errors.length >= 5);
});

Deno.test("validate: rejects invalid status", () => {
  const r = validateEnvelope(validPayload({ status: "banana" }));
  assertEquals(r.valid, false);
});

Deno.test("validate: rejects invalid entity_type", () => {
  const r = validateEnvelope(validPayload({ entity_type: "contact" }));
  assertEquals(r.valid, false);
});

Deno.test("validate: rejects non-object body", () => {
  assertEquals(validateEnvelope("string").valid, false);
  assertEquals(validateEnvelope(null).valid, false);
  assertEquals(validateEnvelope(42).valid, false);
});

Deno.test("validate: rejects array enrichment", () => {
  assertEquals(validateEnvelope(validPayload({ enrichment: [1, 2] })).valid, false);
});

Deno.test("validate: rejects null enrichment", () => {
  assertEquals(validateEnvelope(validPayload({ enrichment: null })).valid, false);
});

Deno.test("validate: accepts error envelope with error object", () => {
  const r = validateEnvelope(validPayload({
    status: "error",
    enrichment: {},
    error: { code: "TIMEOUT", message: "Timed out" },
  }));
  assertEquals(r.valid, true);
});

Deno.test("validate: rejects error object missing code", () => {
  assertEquals(validateEnvelope(validPayload({ error: { message: "x" } })).valid, false);
});

Deno.test("validate: rejects error object missing message", () => {
  assertEquals(validateEnvelope(validPayload({ error: { code: "x" } })).valid, false);
});

Deno.test("validate: rejects scrape missing ok", () => {
  assertEquals(validateEnvelope(validPayload({ scrape: { bytes: 1 } })).valid, false);
});

Deno.test("validate: rejects scrape missing bytes", () => {
  assertEquals(validateEnvelope(validPayload({ scrape: { ok: true } })).valid, false);
});

// ═══════════════════════════════════════
// authenticateRequest (reads env, no I/O)
// ═══════════════════════════════════════

Deno.test("auth: rejects missing header", async () => {
  const r = authenticateRequest(new Request(BASE_URL, { method: "POST" }));
  assertEquals(r.ok, false);
  if (!r.ok) {
    assertEquals(r.response.status, 401);
    await r.response.text();
  }
});

Deno.test("auth: rejects wrong token", async () => {
  const r = authenticateRequest(new Request(BASE_URL, {
    method: "POST",
    headers: BAD_AUTH_HEADERS,
  }));
  assertEquals(r.ok, false);
  if (!r.ok) {
    assertEquals(r.response.status, 401);
    await r.response.text();
  }
});

Deno.test("auth: accepts valid token", () => {
  const r = authenticateRequest(new Request(BASE_URL, {
    method: "POST",
    headers: VALID_AUTH_HEADERS,
  }));
  assertEquals(r.ok, true);
});

Deno.test("auth: accepts shared secret via X-Api-Key", () => {
  const r = authenticateRequest(new Request(BASE_URL, {
    method: "POST",
    headers: VALID_SHARED_HEADERS,
  }));
  assertEquals(r.ok, true);
});

Deno.test("auth: returns 503 when secrets not configured", async () => {
  const originalEnrich = Deno.env.get("ENRICHMENT_WORKER_SECRET")!;
  const originalShared = Deno.env.get("N8N_SHARED_SECRET")!;
  Deno.env.delete("ENRICHMENT_WORKER_SECRET");
  Deno.env.delete("N8N_SHARED_SECRET");
  const r = authenticateRequest(new Request(BASE_URL, { method: "POST" }));
  assertEquals(r.ok, false);
  if (!r.ok) {
    assertEquals(r.response.status, 503);
    await r.response.text();
  }
  Deno.env.set("ENRICHMENT_WORKER_SECRET", originalEnrich);
  Deno.env.set("N8N_SHARED_SECRET", originalShared);
});

// ═══════════════════════════════════════
// deriveJobStatus (pure)
// ═══════════════════════════════════════

Deno.test("deriveJobStatus: error → failed", () => {
  assertEquals(deriveJobStatus("error"), "failed");
});

Deno.test("deriveJobStatus: success → completed", () => {
  assertEquals(deriveJobStatus("success"), "completed");
});

Deno.test("deriveJobStatus: no_data → completed", () => {
  assertEquals(deriveJobStatus("no_data"), "completed");
});

// ═══════════════════════════════════════
// extractSuggestedContacts (pure, with normalization)
// ═══════════════════════════════════════

Deno.test("extractSuggestedContacts: returns normalized contacts when present", () => {
  const contacts = [
    { name: "Alice", email: "alice@example.com", confidence: 0.9 },
    { name: "Bob", phone: "555-1234" },
  ];
  const result = extractSuggestedContacts({ suggested_contacts: contacts }, "https://fallback.com");
  assertEquals(result.length, 2);
  assertEquals(result[0].name, "Alice");
  assertEquals(result[0].email, "alice@example.com");
  assertEquals(result[0].confidence, 0.9);
  assertEquals(result[0].source_url, "https://fallback.com"); // fallback
  assertEquals(result[1].name, "Bob");
  assertEquals(result[1].phone, "555-1234");
  assertEquals(result[1].confidence, null); // missing → null
});

Deno.test("extractSuggestedContacts: uses contact source_url over fallback", () => {
  const contacts = [{ name: "Carol", source_url: "https://specific.com/page" }];
  const result = extractSuggestedContacts({ suggested_contacts: contacts }, "https://fallback.com");
  assertEquals(result[0].source_url, "https://specific.com/page");
});

Deno.test("extractSuggestedContacts: returns empty array when absent", () => {
  const result = extractSuggestedContacts({ title: "Test" }, "https://fallback.com");
  assertEquals(result.length, 0);
});

Deno.test("extractSuggestedContacts: returns empty array when not array", () => {
  const result = extractSuggestedContacts({ suggested_contacts: "not array" }, "https://x.com");
  assertEquals(result.length, 0);
});

Deno.test("extractSuggestedContacts: returns empty array when null", () => {
  const result = extractSuggestedContacts({ suggested_contacts: null }, "https://x.com");
  assertEquals(result.length, 0);
});

Deno.test("extractSuggestedContacts: normalizes non-object items", () => {
  const result = extractSuggestedContacts({ suggested_contacts: [42, null, "str"] }, "https://x.com");
  assertEquals(result.length, 3);
  assertEquals(result[0].name, null);
  assertEquals(result[0].source_url, "https://x.com");
});

// ═══════════════════════════════════════
// buildDuplicateResponse / buildSuccessResponse (pure)
// ═══════════════════════════════════════

Deno.test("buildDuplicateResponse: returns 200 duplicate=true", async () => {
  const res = buildDuplicateResponse("existing-id-42");
  const body = await res.json();
  assertEquals(res.status, 200);
  assertEquals(body.ok, true);
  assertEquals(body.duplicate, true);
  assertEquals(body.result_id, "existing-id-42");
});

Deno.test("buildSuccessResponse: returns 200 duplicate=false", async () => {
  const res = buildSuccessResponse("new-id-77");
  const body = await res.json();
  assertEquals(res.status, 200);
  assertEquals(body.ok, true);
  assertEquals(body.duplicate, false);
  assertEquals(body.result_id, "new-id-77");
});

Deno.test("buildSuccessResponse: includes warnings when provided", async () => {
  const res = buildSuccessResponse("id-1", ["warning1", "warning2"]);
  const body = await res.json();
  assertEquals(res.status, 200);
  assertEquals(body.ok, true);
  assertEquals(body.warnings.length, 2);
});

Deno.test("buildSuccessResponse: no warnings key when empty", async () => {
  const res = buildSuccessResponse("id-1", []);
  const body = await res.json();
  assertEquals(body.warnings, undefined);
});

// ═══════════════════════════════════════
// handleRequest: method guards & validation (no DB needed)
// ═══════════════════════════════════════

Deno.test({ name: "handler: rejects GET method", sanitizeOps: false, sanitizeResources: false, fn: async () => {
  const res = await handleRequest(new Request(BASE_URL, { method: "GET", headers: VALID_AUTH_HEADERS }));
  const body = await res.json();
  assertEquals(res.status, 405);
  assertEquals(body.ok, false);
}});

Deno.test({ name: "handler: returns CORS on OPTIONS", sanitizeOps: false, sanitizeResources: false, fn: async () => {
  const res = await handleRequest(new Request(BASE_URL, { method: "OPTIONS" }));
  assertEquals(res.status, 200);
  assert(res.headers.get("Access-Control-Allow-Origin") === "*");
}});

Deno.test({ name: "handler: rejects non-JSON body", sanitizeOps: false, sanitizeResources: false, fn: async () => {
  const res = await handleRequest(new Request(BASE_URL, {
    method: "POST",
    headers: VALID_AUTH_HEADERS,
    body: "not json",
  }));
  const body = await res.json();
  assertEquals(res.status, 400);
  assertEquals(body.error, "Invalid JSON");
}});

Deno.test({ name: "handler: rejects invalid envelope via handler", sanitizeOps: false, sanitizeResources: false, fn: async () => {
  const res = await handleRequest(new Request(BASE_URL, {
    method: "POST",
    headers: VALID_AUTH_HEADERS,
    body: JSON.stringify({ run_id: "abc" }),
  }));
  const body = await res.json();
  assertEquals(res.status, 400);
  assertEquals(body.ok, false);
  assert(Array.isArray(body.errors));
}});

Deno.test({ name: "handler: rejects invalid status via handler", sanitizeOps: false, sanitizeResources: false, fn: async () => {
  const res = await handleRequest(new Request(BASE_URL, {
    method: "POST",
    headers: VALID_AUTH_HEADERS,
    body: JSON.stringify(validPayload({ status: "invalid" })),
  }));
  const body = await res.json();
  assertEquals(res.status, 400);
  assertEquals(body.ok, false);
}});

Deno.test({ name: "handler: rejects invalid entity_type via handler", sanitizeOps: false, sanitizeResources: false, fn: async () => {
  const res = await handleRequest(new Request(BASE_URL, {
    method: "POST",
    headers: VALID_AUTH_HEADERS,
    body: JSON.stringify(validPayload({ entity_type: "contact" })),
  }));
  const body = await res.json();
  assertEquals(res.status, 400);
  assertEquals(body.ok, false);
}});
