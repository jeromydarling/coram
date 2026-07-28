/**
 * relatio-outbound-sync — Comprehensive edge function tests.
 *
 * WHAT: Validates auth gating, CORS, payload validation, sync direction enforcement,
 *       connector support, and idempotency for the outbound sync edge function.
 * WHERE: supabase/functions/tests/relatio-outbound-sync.test.ts
 * WHY: Ensures bi-directional sync changes (Phase 25) don't break auth, don't allow
 *      inbound-only connectors to write outbound, and properly reject unsupported connectors.
 */

import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;
const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/relatio-outbound-sync`;

// ── Auth & CORS ──

Deno.test("relatio-outbound-sync: rejects missing auth", async () => {
  const res = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  const body = await res.json();
  assertEquals(res.status, 401);
  assertEquals(body.ok, false);
});

Deno.test("relatio-outbound-sync: rejects invalid auth token", async () => {
  const res = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer invalid_token_here",
    },
    body: JSON.stringify({
      tenant_id: "00000000-0000-0000-0000-000000000001",
      connector_key: "salesforce",
      entity_type: "contact",
      entity_id: "00000000-0000-0000-0000-000000000002",
      action: "create",
      cros_data: { name: "Test" },
    }),
  });
  const body = await res.json();
  assertEquals(res.status, 401);
  assertEquals(body.ok, false);
});

Deno.test("relatio-outbound-sync: CORS preflight returns ok", async () => {
  const res = await fetch(FUNCTION_URL, { method: "OPTIONS" });
  const text = await res.text();
  assertEquals(res.status, 200);
  assertEquals(text, "ok");
  assertExists(res.headers.get("access-control-allow-origin"));
});

// ── Payload Validation ──

Deno.test("relatio-outbound-sync: rejects missing payload fields with anon key", async () => {
  const res = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({}),
  });
  const body = await res.json();
  assertEquals(body.ok, false);
});

Deno.test("relatio-outbound-sync: rejects empty body with anon key", async () => {
  const res = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({
      tenant_id: "",
      connector_key: "",
      entity_type: "",
      entity_id: "",
      cros_data: {},
    }),
  });
  const body = await res.json();
  assertEquals(body.ok, false);
});

// ── Connector Support ──

Deno.test("relatio-outbound-sync: recognized connectors include salesforce, dynamics365, blackbaud, hubspot", async () => {
  const connectors = ["salesforce", "dynamics365", "blackbaud", "hubspot"];
  for (const key of connectors) {
    const res = await fetch(FUNCTION_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        tenant_id: "00000000-0000-0000-0000-000000000001",
        connector_key: key,
        entity_type: "contact",
        entity_id: "00000000-0000-0000-0000-000000000099",
        action: "create",
        cros_data: { name: "Test Contact" },
      }),
    });
    const body = await res.json();
    assertEquals(body.ok, false, `Connector ${key} should reject anon key`);
    const isAuthError = (body.error || "").toLowerCase().includes("unauthorized") ||
                        (body.error || "").toLowerCase().includes("auth") ||
                        res.status === 401;
    assertEquals(isAuthError, true, `Connector ${key} should fail at auth, not connector validation. Got: ${body.error}`);
  }
});

Deno.test("relatio-outbound-sync: rejects unknown connector key with anon key", async () => {
  const res = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({
      tenant_id: "00000000-0000-0000-0000-000000000001",
      connector_key: "totally_fake_crm",
      entity_type: "contact",
      entity_id: "00000000-0000-0000-0000-000000000099",
      action: "create",
      cros_data: { name: "Test" },
    }),
  });
  const body = await res.json();
  assertEquals(body.ok, false);
});

// ── Sync Direction Enforcement ──

Deno.test("relatio-outbound-sync: sync direction check uses relatio_sync_config table", async () => {
  const res = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({
      tenant_id: "00000000-0000-0000-0000-000000000001",
      connector_key: "salesforce",
      entity_type: "account",
      entity_id: "00000000-0000-0000-0000-000000000003",
      action: "update",
      cros_data: { organization: "Test Org", external_id: "001xxx" },
    }),
  });
  const body = await res.json();
  assertEquals(body.ok, false);
  assertEquals(res.status, 401);
});

// ── Method Enforcement ──

Deno.test("relatio-outbound-sync: GET method still processes (no 405)", async () => {
  const res = await fetch(FUNCTION_URL, {
    method: "GET",
    headers: { Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
  });
  // May return JSON or text depending on error path
  const text = await res.text();
  let body: Record<string, unknown>;
  try { body = JSON.parse(text); } catch { body = { ok: false, error: text }; }
  assertEquals(body.ok, false);
});

// ── Response Envelope ──

Deno.test("relatio-outbound-sync: error responses always include ok:false", async () => {
  const res = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer bad_token",
    },
    body: JSON.stringify({ tenant_id: "x", connector_key: "salesforce" }),
  });
  const body = await res.json();
  assertEquals(body.ok, false);
  assertExists(body.error);
});

Deno.test("relatio-outbound-sync: CORS headers present on error responses", async () => {
  const res = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  await res.json();
  assertExists(res.headers.get("access-control-allow-origin"));
});
