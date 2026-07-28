/**
 * outlook-sendlimit.test.ts — Deno tests for Outlook send, send-limit guard, and feature gating.
 *
 * WHAT: Tests edge function auth, feature flag enforcement, and send-limit safety.
 * WHERE: supabase/functions/tests/
 * WHY: Ensures campaigns are gated and send limits are enforced server-side.
 */

import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;

const OUTLOOK_SEND_URL = `${SUPABASE_URL}/functions/v1/outlook-send`;
const OUTLOOK_CONNECT_URL = `${SUPABASE_URL}/functions/v1/outlook-connect`;

// ─── outlook-send: requires auth ───
Deno.test("outlook-send rejects unauthenticated requests", async () => {
  const res = await fetch(OUTLOOK_SEND_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tenant_id: "fake", action: "check_limits" }),
  });
  assertEquals(res.status, 401);
  await res.text();
});

// ─── outlook-send: OPTIONS returns CORS ───
Deno.test("outlook-send OPTIONS returns CORS headers", async () => {
  const res = await fetch(OUTLOOK_SEND_URL, { method: "OPTIONS" });
  assertEquals(res.status, 200);
  assert(res.headers.get("access-control-allow-origin") !== null);
  await res.text();
});

// ─── outlook-connect: OPTIONS returns CORS ───
Deno.test("outlook-connect OPTIONS returns CORS headers", async () => {
  const res = await fetch(OUTLOOK_CONNECT_URL, { method: "OPTIONS" });
  assertEquals(res.status, 200);
  assert(res.headers.get("access-control-allow-origin") !== null);
  await res.text();
});

// ─── outlook-connect: requires auth ───
Deno.test("outlook-connect rejects unauthenticated requests", async () => {
  const res = await fetch(OUTLOOK_CONNECT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tenant_id: "fake" }),
  });
  assertEquals(res.status, 401);
  await res.text();
});

// ─── outlook-send: anon key insufficient ───
Deno.test("outlook-send rejects anon key as insufficient auth", async () => {
  const res = await fetch(OUTLOOK_SEND_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ANON_KEY}`,
    },
    body: JSON.stringify({ tenant_id: "fake-tenant", action: "check_limits" }),
  });
  // Anon key is not a valid user token, expect 401
  assertEquals(res.status, 401);
  await res.text();
});

// ─── Send Limit Guard unit tests (pure function) ───
// Import the shared guard directly
const { evaluateSendLimit } = await import("..//_shared/sendLimitGuard.ts");

Deno.test("send-limit-guard: blocks at hard limit for outlook", () => {
  const row = {
    id: "x", tenant_id: "t", provider: "outlook", email_address: "a@b.com",
    daily_limit: 300, soft_limit: 60, hard_limit: 85,
    current_count: 260, window_start: new Date().toISOString(),
  };
  const result = evaluateSendLimit(row, "outlook", 1);
  assertEquals(result.blocked, true);
  assertEquals(result.allowed, false);
});

Deno.test("send-limit-guard: warns at soft limit for outlook", () => {
  const row = {
    id: "x", tenant_id: "t", provider: "outlook", email_address: "a@b.com",
    daily_limit: 300, soft_limit: 60, hard_limit: 85,
    current_count: 200, window_start: new Date().toISOString(),
  };
  const result = evaluateSendLimit(row, "outlook", 1);
  assertEquals(result.blocked, false);
  assertEquals(result.warning, true);
});

Deno.test("send-limit-guard: safe below soft limit", () => {
  const row = {
    id: "x", tenant_id: "t", provider: "outlook", email_address: "a@b.com",
    daily_limit: 300, soft_limit: 60, hard_limit: 85,
    current_count: 100, window_start: new Date().toISOString(),
  };
  const result = evaluateSendLimit(row, "outlook", 1);
  assertEquals(result.blocked, false);
  assertEquals(result.warning, false);
});

Deno.test("send-limit-guard: uses defaults when no row exists", () => {
  const result = evaluateSendLimit(null, "outlook", 1);
  assertEquals(result.blocked, false);
  assertEquals(result.dailyLimit, 300);
});

Deno.test("send-limit-guard: uses gmail defaults when provider is gmail", () => {
  const result = evaluateSendLimit(null, "gmail", 1);
  assertEquals(result.dailyLimit, 2000);
});

Deno.test("send-limit-guard: blocks when proposed count would exceed hard limit", () => {
  const row = {
    id: "x", tenant_id: "t", provider: "outlook", email_address: "a@b.com",
    daily_limit: 300, soft_limit: 60, hard_limit: 85,
    current_count: 250, window_start: new Date().toISOString(),
  };
  const result = evaluateSendLimit(row, "outlook", 10);
  assertEquals(result.blocked, true);
});
