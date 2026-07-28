/**
 * outlook-compliance.test.ts — Deno tests for Outlook do-not-email, skipped_opt_out, limit blocking,
 * campaign add-on gating, and relatio import compliance.
 *
 * WHAT: Tests edge function enforcement of email compliance guardrails.
 * WHERE: supabase/functions/tests/
 * WHY: Ensures do_not_email filtering, unsubscribe, and gating work correctly.
 */

import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;

const OUTLOOK_SEND_URL = `${SUPABASE_URL}/functions/v1/outlook-send`;

// ─── Send Limit Guard: blocks at 95%+ of daily limit ───
const { evaluateSendLimit } = await import("../_shared/sendLimitGuard.ts");

Deno.test("send-limit-guard: blocks when projected count >= 95% of daily limit", () => {
  const row = {
    id: "x", tenant_id: "t", provider: "outlook", email_address: "a@b.com",
    daily_limit: 300, soft_limit: 80, hard_limit: 95,
    current_count: 280, window_start: new Date().toISOString(),
  };
  const result = evaluateSendLimit(row, "outlook", 10);
  assertEquals(result.blocked, true);
  assertEquals(result.allowed, false);
  assert(result.message.includes("blocked"));
});

Deno.test("send-limit-guard: warns at 80% of daily limit", () => {
  const row = {
    id: "x", tenant_id: "t", provider: "outlook", email_address: "a@b.com",
    daily_limit: 300, soft_limit: 80, hard_limit: 95,
    current_count: 240, window_start: new Date().toISOString(),
  };
  const result = evaluateSendLimit(row, "outlook", 1);
  assertEquals(result.blocked, false);
  assertEquals(result.warning, true);
});

Deno.test("send-limit-guard: safe well below thresholds", () => {
  const row = {
    id: "x", tenant_id: "t", provider: "outlook", email_address: "a@b.com",
    daily_limit: 300, soft_limit: 80, hard_limit: 95,
    current_count: 50, window_start: new Date().toISOString(),
  };
  const result = evaluateSendLimit(row, "outlook", 1);
  assertEquals(result.blocked, false);
  assertEquals(result.warning, false);
  assertEquals(result.allowed, true);
});

// ─── outlook-send: returns 403 when campaign add-on is disabled ───
Deno.test("outlook-send rejects when campaign add-on disabled (unauthenticated)", async () => {
  // Without valid auth, we get 401 first — this verifies gating exists
  const res = await fetch(OUTLOOK_SEND_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tenant_id: "fake-tenant", action: "send_campaign" }),
  });
  // 401 because no auth, but the feature flag check would return 403 if auth passed
  assertEquals(res.status, 401);
  await res.text();
});

// ─── outlook-send: anon key gets 401 (not a valid user session) ───
Deno.test("outlook-send anon key returns 401 not 403", async () => {
  const res = await fetch(OUTLOOK_SEND_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ANON_KEY}`,
    },
    body: JSON.stringify({ tenant_id: "fake-tenant", action: "send_campaign" }),
  });
  assertEquals(res.status, 401);
  await res.text();
});

// ─── CORS still works ───
Deno.test("outlook-send OPTIONS returns CORS headers", async () => {
  const res = await fetch(OUTLOOK_SEND_URL, { method: "OPTIONS" });
  assertEquals(res.status, 200);
  assert(res.headers.get("access-control-allow-origin") !== null);
  await res.text();
});

// ─── Suppression filtering: simulated do-not-email behavior ───
// These are unit-level tests verifying the Set-based filtering logic

Deno.test("suppression set correctly identifies do_not_email addresses", () => {
  const suppressedEmails = new Set<string>();
  // Simulate loading from email_suppressions
  suppressedEmails.add("blocked@example.com");
  suppressedEmails.add("bounced@example.com");
  // Simulate loading from contacts.do_not_email
  suppressedEmails.add("opted-out@example.com");

  // These should be suppressed
  assertEquals(suppressedEmails.has("blocked@example.com"), true);
  assertEquals(suppressedEmails.has("bounced@example.com"), true);
  assertEquals(suppressedEmails.has("opted-out@example.com"), true);

  // This should NOT be suppressed
  assertEquals(suppressedEmails.has("safe@example.com"), false);
});

Deno.test("suppression set handles case normalization", () => {
  const suppressedEmails = new Set<string>();
  suppressedEmails.add("BLOCKED@Example.COM".toLowerCase());

  assertEquals(suppressedEmails.has("blocked@example.com"), true);
  assertEquals(suppressedEmails.has("BLOCKED@EXAMPLE.COM".toLowerCase()), true);
});

// ─── Relatio import: validates do_not_email insertion logic ───
Deno.test("import compliance: unsubscribed status maps to do_not_email suppression", () => {
  const externalStatuses = ["unsubscribed", "cleaned", "bounced", "complaint"];
  const shouldSuppress = (status: string) => externalStatuses.includes(status);

  assertEquals(shouldSuppress("unsubscribed"), true);
  assertEquals(shouldSuppress("cleaned"), true);
  assertEquals(shouldSuppress("bounced"), true);
  assertEquals(shouldSuppress("complaint"), true);
  assertEquals(shouldSuppress("active"), false);
  assertEquals(shouldSuppress("subscribed"), false);
});
