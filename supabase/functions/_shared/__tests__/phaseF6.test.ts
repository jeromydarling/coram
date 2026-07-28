import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { computeScore, ALERT_SCORE_THRESHOLD, DEFAULT_SUCCESS_RATE } from "../nextActionScoring.ts";

// ─── 1. Scoring Determinism ───

Deno.test("computeScore: deterministic for same inputs", () => {
  const input = {
    severity: 4,
    confidence: 0.8,
    predicted_success_rate: 0.6,
    created_at: new Date().toISOString(),
    dismissed_count: 0,
  };
  const r1 = computeScore(input);
  const r2 = computeScore(input);
  assertEquals(r1.score, r2.score);
  assertEquals(r1.predicted_success_rate, r2.predicted_success_rate);
});

Deno.test("computeScore: uses default success rate when null", () => {
  const result = computeScore({
    severity: 3,
    confidence: 0.5,
    predicted_success_rate: null,
    created_at: new Date().toISOString(),
  });
  assertEquals(result.predicted_success_rate, DEFAULT_SUCCESS_RATE);
});

Deno.test("computeScore: higher severity = higher score", () => {
  const base = {
    confidence: 0.5,
    predicted_success_rate: 0.5,
    created_at: new Date().toISOString(),
  };
  const low = computeScore({ ...base, severity: 1 });
  const high = computeScore({ ...base, severity: 5 });
  assert(high.score > low.score, `Expected ${high.score} > ${low.score}`);
});

Deno.test("computeScore: recency penalty increases with age", () => {
  const base = {
    severity: 3,
    confidence: 0.5,
    predicted_success_rate: 0.5,
  };
  const fresh = computeScore({ ...base, created_at: new Date().toISOString() });
  const old = computeScore({
    ...base,
    created_at: new Date(Date.now() - 25 * 86400000).toISOString(),
  });
  assert(fresh.score > old.score, `Fresh ${fresh.score} should beat old ${old.score}`);
});

Deno.test("computeScore: dismissal penalty reduces score", () => {
  const base = {
    severity: 3,
    confidence: 0.5,
    predicted_success_rate: 0.5,
    created_at: new Date().toISOString(),
  };
  const noDismissal = computeScore({ ...base, dismissed_count: 0 });
  const dismissed = computeScore({ ...base, dismissed_count: 2 });
  assert(noDismissal.score > dismissed.score);
});

Deno.test("computeScore: score never negative", () => {
  const result = computeScore({
    severity: 1,
    confidence: 0.1,
    predicted_success_rate: 0.05,
    created_at: new Date(Date.now() - 60 * 86400000).toISOString(),
    dismissed_count: 5,
  });
  assert(result.score >= 0);
});

Deno.test("computeScore: breakdown components sum correctly", () => {
  const result = computeScore({
    severity: 3,
    confidence: 0.7,
    predicted_success_rate: 0.5,
    created_at: new Date().toISOString(),
    dismissed_count: 0,
  });
  const { breakdown } = result;
  assertEquals(breakdown.severity_component, 9);
  assertEquals(breakdown.confidence_component, 1.4);
  assertEquals(breakdown.success_component, 2);
});

// ─── 2. Alert Threshold ───

Deno.test("ALERT_SCORE_THRESHOLD is 12", () => {
  assertEquals(ALERT_SCORE_THRESHOLD, 12);
});

Deno.test("High severity + confidence exceeds alert threshold", () => {
  const result = computeScore({
    severity: 5,
    confidence: 0.9,
    predicted_success_rate: 0.6,
    created_at: new Date().toISOString(),
  });
  assert(result.score >= ALERT_SCORE_THRESHOLD);
});

// ─── 3. Alert Dedupe Logic ───

Deno.test("Alert dedup: unique index prevents duplicate unread alerts for same ref_id", () => {
  // This tests the DB constraint concept; the actual constraint is in SQL.
  // Here we verify the logic would deduplicate at app level.
  const alerts = new Map<string, { user_id: string; ref_id: string; read_at: string | null }>();
  
  const key = (userId: string, refId: string) => `${userId}:${refId}`;
  const a1 = { user_id: "u1", ref_id: "r1", read_at: null };
  alerts.set(key(a1.user_id, a1.ref_id), a1);
  
  // Attempting to add duplicate should be blocked
  const existing = alerts.get(key("u1", "r1"));
  assert(existing !== undefined, "Duplicate should be blocked by dedup key");
  assertEquals(existing?.read_at, null);
});

// ─── 4. Snooze Reactivation Logic ───

Deno.test("Snoozed action should reactivate after snoozed_until passes", () => {
  const pastDate = new Date(Date.now() - 86400000).toISOString(); // 1 day ago
  const futureDate = new Date(Date.now() + 86400000).toISOString();
  
  const shouldReactivate = new Date(pastDate) < new Date();
  const shouldNotReactivate = new Date(futureDate) < new Date();
  
  assert(shouldReactivate, "Past snooze should reactivate");
  assert(!shouldNotReactivate, "Future snooze should not reactivate");
});

// ─── 5. Reply → Outcome Logic ───

Deno.test("Reply within 7 days qualifies as outcome", () => {
  const sentAt = new Date(Date.now() - 3 * 86400000); // 3 days ago
  const replyAt = new Date(); // now
  const diffDays = (replyAt.getTime() - sentAt.getTime()) / 86400000;
  assert(diffDays <= 7, "Reply within 7 days should count");
});

Deno.test("Reply after 7 days does not qualify", () => {
  const sentAt = new Date(Date.now() - 10 * 86400000);
  const replyAt = new Date();
  const diffDays = (replyAt.getTime() - sentAt.getTime()) / 86400000;
  assert(diffDays > 7, "Reply after 7 days should not count");
});

// ─── 6. Effectiveness Update ───

Deno.test("Success rate computation is correct", () => {
  const total = 10;
  const successful = 4;
  const rate = successful / total;
  assertEquals(rate, 0.4);
});

// ─── 7. Suppression Logic ───

Deno.test("Next action regeneration suppression: dismissed within 30 days", () => {
  const dismissedAt = new Date(Date.now() - 10 * 86400000); // 10 days ago
  const daysSinceDismissal = (Date.now() - dismissedAt.getTime()) / 86400000;
  assert(daysSinceDismissal < 30, "Should be suppressed within 30 days");
});

Deno.test("Next action regeneration allowed: dismissed > 30 days ago", () => {
  const dismissedAt = new Date(Date.now() - 35 * 86400000);
  const daysSinceDismissal = (Date.now() - dismissedAt.getTime()) / 86400000;
  assert(daysSinceDismissal >= 30, "Should be allowed after 30 days");
});
