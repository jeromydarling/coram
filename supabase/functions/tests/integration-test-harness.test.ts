/**
 * Deno tests for Integration Test Harness edge functions.
 *
 * WHAT: Validates auth gating, CORS, and input validation for test harness functions.
 * WHERE: supabase/functions/tests/integration-test-harness.test.ts
 * WHY: Ensures operator-only test functions are properly secured.
 */

import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;

const OUTLOOK_TEST_URL = `${SUPABASE_URL}/functions/v1/outlook-connection-test`;
const UNSUB_FLOW_URL = `${SUPABASE_URL}/functions/v1/operator-unsubscribe-flow-test`;
const SUPPRESSION_URL = `${SUPABASE_URL}/functions/v1/operator-campaign-suppression-test`;

// ── outlook-connection-test ────────────────────────────────

Deno.test("outlook-connection-test rejects unauthenticated", async () => {
  const res = await fetch(OUTLOOK_TEST_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tenant_id: "00000000-0000-0000-0000-000000000001" }),
  });
  const body = await res.text();
  assertEquals(res.status, 401, `Expected 401, got ${res.status}: ${body}`);
});

Deno.test("outlook-connection-test rejects anon key (not admin)", async () => {
  const res = await fetch(OUTLOOK_TEST_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ANON_KEY}`,
    },
    body: JSON.stringify({ tenant_id: "00000000-0000-0000-0000-000000000001" }),
  });
  const body = await res.text();
  // Should be 401 (anon key is not a user session)
  const validStatuses = [401, 403];
  assertEquals(validStatuses.includes(res.status), true, `Expected 401/403, got ${res.status}: ${body}`);
});

Deno.test("outlook-connection-test OPTIONS returns CORS", async () => {
  const res = await fetch(OUTLOOK_TEST_URL, { method: "OPTIONS" });
  await res.text();
  assertEquals(res.status, 200);
  assertEquals(res.headers.get("access-control-allow-origin"), "*");
});

// ── operator-unsubscribe-flow-test ─────────────────────────

Deno.test("operator-unsubscribe-flow-test rejects unauthenticated", async () => {
  const res = await fetch(UNSUB_FLOW_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      tenant_id: "00000000-0000-0000-0000-000000000001",
      email: "test@example.org",
    }),
  });
  const body = await res.text();
  assertEquals(res.status, 401, `Expected 401, got ${res.status}: ${body}`);
});

Deno.test("operator-unsubscribe-flow-test rejects anon key", async () => {
  const res = await fetch(UNSUB_FLOW_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ANON_KEY}`,
    },
    body: JSON.stringify({
      tenant_id: "00000000-0000-0000-0000-000000000001",
      email: "test@example.org",
    }),
  });
  const body = await res.text();
  const validStatuses = [401, 403];
  assertEquals(validStatuses.includes(res.status), true, `Expected 401/403, got ${res.status}: ${body}`);
});

Deno.test("operator-unsubscribe-flow-test OPTIONS returns CORS", async () => {
  const res = await fetch(UNSUB_FLOW_URL, { method: "OPTIONS" });
  await res.text();
  assertEquals(res.status, 200);
  assertEquals(res.headers.get("access-control-allow-origin"), "*");
});

// ── operator-campaign-suppression-test ─────────────────────

Deno.test("operator-campaign-suppression-test rejects unauthenticated", async () => {
  const res = await fetch(SUPPRESSION_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      tenant_id: "00000000-0000-0000-0000-000000000001",
      email: "test@example.org",
    }),
  });
  const body = await res.text();
  assertEquals(res.status, 401, `Expected 401, got ${res.status}: ${body}`);
});

Deno.test("operator-campaign-suppression-test rejects anon key", async () => {
  const res = await fetch(SUPPRESSION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ANON_KEY}`,
    },
    body: JSON.stringify({
      tenant_id: "00000000-0000-0000-0000-000000000001",
      email: "test@example.org",
    }),
  });
  const body = await res.text();
  const validStatuses = [401, 403];
  assertEquals(validStatuses.includes(res.status), true, `Expected 401/403, got ${res.status}: ${body}`);
});

Deno.test("operator-campaign-suppression-test OPTIONS returns CORS", async () => {
  const res = await fetch(SUPPRESSION_URL, { method: "OPTIONS" });
  await res.text();
  assertEquals(res.status, 200);
  assertEquals(res.headers.get("access-control-allow-origin"), "*");
});

// ── Input validation ───────────────────────────────────────

Deno.test("operator-unsubscribe-flow-test rejects missing body fields (with anon)", async () => {
  const res = await fetch(UNSUB_FLOW_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ANON_KEY}`,
    },
    body: JSON.stringify({}),
  });
  const body = await res.text();
  // Either 401 (not admin) or 400 (missing fields) are acceptable
  const validStatuses = [400, 401, 403];
  assertEquals(validStatuses.includes(res.status), true, `Expected 400/401/403, got ${res.status}: ${body}`);
});

Deno.test("operator-campaign-suppression-test rejects missing body (with anon)", async () => {
  const res = await fetch(SUPPRESSION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ANON_KEY}`,
    },
    body: JSON.stringify({}),
  });
  const body = await res.text();
  const validStatuses = [400, 401, 403];
  assertEquals(validStatuses.includes(res.status), true, `Expected 400/401/403, got ${res.status}: ${body}`);
});
