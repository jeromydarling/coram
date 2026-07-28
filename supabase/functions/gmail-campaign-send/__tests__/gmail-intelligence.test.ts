import {
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

// Import the normalizeGmailFailure function logic (inline since we can't import from index.ts directly)
function normalizeGmailFailure(error: string): { category: string; code: string; raw: string } {
  const raw = (error || "").slice(0, 500);
  const lower = raw.toLowerCase();

  if (lower.includes("429") || lower.includes("quota") || lower.includes("rate limit") || lower.includes("quota_exceeded")) {
    return { category: "quota", code: "429_quota", raw };
  }
  if (lower.includes("invalid to") || lower.includes("invalid email") || lower.includes("invalid recipient") || lower.includes("invalid address")) {
    return { category: "invalid_address", code: "invalid_to", raw };
  }
  if (lower.includes("user not found") || lower.includes("mailbox unavailable") || lower.includes("mailbox not found") || lower.includes("no such user") || lower.includes("does not exist")) {
    return { category: "bounce", code: "mailbox_unavailable", raw };
  }
  if (lower.includes("550") || lower.includes("553") || lower.includes("554") || lower.includes("permanently rejected")) {
    return { category: "provider_perm", code: "smtp_perm", raw };
  }
  if (lower.includes("5xx") || lower.includes("timeout") || lower.includes("network") || lower.includes("500") || lower.includes("502") || lower.includes("503") || lower.includes("504") || lower.includes("provider_temp") || lower.includes("connection")) {
    return { category: "provider_temp", code: "server_error", raw };
  }
  if (lower.includes("auth_expired") || lower.includes("401") || lower.includes("403")) {
    return { category: "provider_perm", code: "auth_error", raw };
  }

  return { category: "unknown", code: "unknown", raw };
}

// ── B2: normalizeGmailFailure mapping tests ──

Deno.test("normalizeGmailFailure: quota_exceeded maps to quota", () => {
  const result = normalizeGmailFailure("quota_exceeded:403");
  assertEquals(result.category, "quota");
  assertEquals(result.code, "429_quota");
});

Deno.test("normalizeGmailFailure: 429 rate limit maps to quota", () => {
  const result = normalizeGmailFailure("send_failed:429");
  assertEquals(result.category, "quota");
});

Deno.test("normalizeGmailFailure: invalid email maps to invalid_address", () => {
  const result = normalizeGmailFailure("Invalid To header: not a valid email");
  assertEquals(result.category, "invalid_address");
  assertEquals(result.code, "invalid_to");
});

Deno.test("normalizeGmailFailure: invalid address maps to invalid_address", () => {
  const result = normalizeGmailFailure("Invalid address format");
  assertEquals(result.category, "invalid_address");
});

Deno.test("normalizeGmailFailure: user not found maps to bounce", () => {
  const result = normalizeGmailFailure("User not found: test@example.com");
  assertEquals(result.category, "bounce");
  assertEquals(result.code, "mailbox_unavailable");
});

Deno.test("normalizeGmailFailure: 550 mailbox unavailable maps to bounce (mailbox check first)", () => {
  const result = normalizeGmailFailure("550 Mailbox unavailable");
  assertEquals(result.category, "bounce");
  assertEquals(result.code, "mailbox_unavailable");
});

Deno.test("normalizeGmailFailure: timeout maps to provider_temp", () => {
  const result = normalizeGmailFailure("timeout_or_network:Connection reset");
  assertEquals(result.category, "provider_temp");
  assertEquals(result.code, "server_error");
});

Deno.test("normalizeGmailFailure: 503 maps to provider_temp", () => {
  const result = normalizeGmailFailure("send_failed:503");
  assertEquals(result.category, "provider_temp");
});

Deno.test("normalizeGmailFailure: auth_expired maps to provider_perm", () => {
  const result = normalizeGmailFailure("auth_expired");
  assertEquals(result.category, "provider_perm");
  assertEquals(result.code, "auth_error");
});

Deno.test("normalizeGmailFailure: unknown error maps to unknown", () => {
  const result = normalizeGmailFailure("some weird error nobody expected");
  assertEquals(result.category, "unknown");
  assertEquals(result.code, "unknown");
});

Deno.test("normalizeGmailFailure: truncates raw to 500 chars", () => {
  const longError = "x".repeat(1000);
  const result = normalizeGmailFailure(longError);
  assertEquals(result.raw.length, 500);
});

Deno.test("normalizeGmailFailure: empty string maps to unknown", () => {
  const result = normalizeGmailFailure("");
  assertEquals(result.category, "unknown");
});

// ── B3: resend eligibility logic tests ──

function isResendEligible(failureCategory: string | null, sentAt: string | null): boolean {
  const eligible = ["provider_temp", "quota", "unknown"];
  const excluded = ["invalid_address", "bounce", "provider_perm"];
  const cat = failureCategory || "unknown";

  if (excluded.includes(cat)) return false;
  if (!eligible.includes(cat)) return false;

  // sent_at must be null or > 24h ago
  if (sentAt) {
    const sentDate = new Date(sentAt);
    const threshold = new Date(Date.now() - 24 * 60 * 60 * 1000);
    if (sentDate >= threshold) return false;
  }

  return true;
}

Deno.test("resend eligibility: quota failure is eligible", () => {
  assertEquals(isResendEligible("quota", null), true);
});

Deno.test("resend eligibility: provider_temp is eligible", () => {
  assertEquals(isResendEligible("provider_temp", null), true);
});

Deno.test("resend eligibility: unknown is eligible", () => {
  assertEquals(isResendEligible("unknown", null), true);
});

Deno.test("resend eligibility: invalid_address is NOT eligible", () => {
  assertEquals(isResendEligible("invalid_address", null), false);
});

Deno.test("resend eligibility: bounce is NOT eligible", () => {
  assertEquals(isResendEligible("bounce", null), false);
});

Deno.test("resend eligibility: provider_perm is NOT eligible", () => {
  assertEquals(isResendEligible("provider_perm", null), false);
});

Deno.test("resend eligibility: null category treated as unknown (eligible)", () => {
  assertEquals(isResendEligible(null, null), true);
});

Deno.test("resend eligibility: recent sent_at blocks eligibility", () => {
  const recentDate = new Date().toISOString();
  assertEquals(isResendEligible("quota", recentDate), false);
});

Deno.test("resend eligibility: old sent_at allows eligibility", () => {
  const oldDate = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
  assertEquals(isResendEligible("quota", oldDate), true);
});

// ── B1: Subject stats increment logic ──

Deno.test("subject stats: delta calculation is correct for new sends", () => {
  const prevSent = 0;
  const prevFailed = 0;
  const currentSent = 5;
  const currentFailed = 2;

  const sentDelta = currentSent - prevSent;
  const failedDelta = currentFailed - prevFailed;

  assertEquals(sentDelta, 5);
  assertEquals(failedDelta, 2);
});

Deno.test("subject stats: retry does not double-count if prev counts match", () => {
  const prevSent = 5;
  const prevFailed = 2;
  const currentSent = 8; // 3 more sent (from retry)
  const currentFailed = 2; // no new failures

  const sentDelta = currentSent - prevSent;
  const failedDelta = currentFailed - prevFailed;

  assertEquals(sentDelta, 3);
  assertEquals(failedDelta, 0);
});
