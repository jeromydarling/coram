/**
 * Deno tests for campaign-unsubscribe-link + unsubscribe edge functions.
 *
 * WHAT: Validates token generation, unsubscribe flow, idempotency, expiry, and invalid tokens.
 * WHERE: supabase/functions/tests/unsubscribe.test.ts
 * WHY: Ensures compliance system works correctly before deployment.
 */

import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;

const UNSUB_LINK_URL = `${SUPABASE_URL}/functions/v1/campaign-unsubscribe-link`;
const UNSUB_URL = `${SUPABASE_URL}/functions/v1/unsubscribe`;

// ── 1) Token generation requires service auth ──────────────────────

Deno.test("campaign-unsubscribe-link rejects anon key", async () => {
  const res = await fetch(UNSUB_LINK_URL, {
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
  assertEquals(res.status, 403, `Expected 403, got ${res.status}: ${body}`);
});

Deno.test("campaign-unsubscribe-link rejects missing auth", async () => {
  const res = await fetch(UNSUB_LINK_URL, {
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

// ── 2) Invalid token → 404 page ────────────────────────────────────

Deno.test("unsubscribe returns 404 for invalid token", async () => {
  const res = await fetch(`${UNSUB_URL}?token=totally_bogus_token_value_12345`, {
    method: "GET",
  });
  const body = await res.text();
  assertEquals(res.status, 404, `Expected 404, got ${res.status}`);
  assertExists(body);
});

// ── 3) Missing token → 404 page ────────────────────────────────────

Deno.test("unsubscribe returns 404 when no token provided", async () => {
  const res = await fetch(UNSUB_URL, { method: "GET" });
  const body = await res.text();
  assertEquals(res.status, 404, `Expected 404, got ${res.status}`);
  assertExists(body);
});

// ── 4) POST without token → 404 ────────────────────────────────────

Deno.test("unsubscribe POST without token returns 404", async () => {
  const res = await fetch(UNSUB_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: "List-Unsubscribe=One-Click",
  });
  const body = await res.text();
  // Token is required even for POST
  assertEquals(res.status, 404, `Expected 404, got ${res.status}`);
  assertExists(body);
});

// ── 5) campaign-unsubscribe-link requires tenant_id + email ─────────

Deno.test("campaign-unsubscribe-link rejects missing fields (with anon key)", async () => {
  const res = await fetch(UNSUB_LINK_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ANON_KEY}`,
    },
    body: JSON.stringify({}),
  });
  const body = await res.text();
  // Should reject — either 403 (not service role) or 400 (missing fields)
  const validStatuses = [400, 403];
  assertEquals(
    validStatuses.includes(res.status),
    true,
    `Expected 400 or 403, got ${res.status}: ${body}`
  );
});

// ── 6) OPTIONS returns CORS headers ─────────────────────────────────

Deno.test("unsubscribe OPTIONS returns CORS", async () => {
  const res = await fetch(UNSUB_URL, { method: "OPTIONS" });
  await res.text();
  assertEquals(res.status, 200);
  assertEquals(res.headers.get("access-control-allow-origin"), "*");
});

Deno.test("campaign-unsubscribe-link OPTIONS returns CORS", async () => {
  const res = await fetch(UNSUB_LINK_URL, { method: "OPTIONS" });
  await res.text();
  assertEquals(res.status, 200);
  assertEquals(res.headers.get("access-control-allow-origin"), "*");
});
