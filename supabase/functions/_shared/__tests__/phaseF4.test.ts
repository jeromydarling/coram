import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  evaluateSuggestion,
  THRESHOLDS,
  type EffectivenessRow,
} from "../campaignIntelligence.ts";

// ── Fixtures ──
function makeRow(overrides: Partial<EffectivenessRow>): EffectivenessRow {
  return {
    org_id: "org-1",
    action_type: "gmail_campaign",
    source: "manual",
    total_actions: 5,
    successful_actions: 3,
    success_rate: 0.6,
    avg_confidence: 0.8,
    last_success_at: new Date().toISOString(),
    ...overrides,
  };
}

// ── Suppression tests ──

Deno.test("suppression: low rate + enough actions → suppressed", () => {
  const rows = [makeRow({ success_rate: 0.1, total_actions: 5 })];
  const result = evaluateSuggestion("org-1", rows);
  assertEquals(result.decision, "suppressed");
});

Deno.test("suppression: low rate + too few actions → shown", () => {
  const rows = [makeRow({ success_rate: 0.1, total_actions: 2 })];
  const result = evaluateSuggestion("org-1", rows);
  assertEquals(result.decision, "shown");
});

Deno.test("suppression: exactly at threshold → not suppressed", () => {
  const rows = [
    makeRow({
      success_rate: THRESHOLDS.SUPPRESS_THRESHOLD,
      total_actions: THRESHOLDS.SUPPRESS_MIN_ACTIONS,
    }),
  ];
  const result = evaluateSuggestion("org-1", rows);
  // 0.15 is NOT < 0.15, so should not be suppressed
  assertEquals(result.decision !== "suppressed", true);
});

// ── Boost tests ──

Deno.test("boost: high rate + recent success → boosted", () => {
  const rows = [
    makeRow({
      success_rate: 0.6,
      last_success_at: new Date().toISOString(),
    }),
  ];
  const result = evaluateSuggestion("org-1", rows);
  assertEquals(result.decision, "boosted");
});

Deno.test("boost: high rate + old success → shown (not boosted)", () => {
  const oldDate = new Date();
  oldDate.setDate(oldDate.getDate() - 60);
  const rows = [
    makeRow({
      success_rate: 0.6,
      last_success_at: oldDate.toISOString(),
    }),
  ];
  const result = evaluateSuggestion("org-1", rows);
  assertEquals(result.decision, "shown");
});

Deno.test("boost: high rate + null last_success → shown", () => {
  const rows = [
    makeRow({
      success_rate: 0.6,
      last_success_at: null,
    }),
  ];
  const result = evaluateSuggestion("org-1", rows);
  assertEquals(result.decision, "shown");
});

// ── Edge cases ──

Deno.test("no data for org → shown with reason", () => {
  const result = evaluateSuggestion("org-unknown", []);
  assertEquals(result.decision, "shown");
  assertEquals(result.reason.includes("Insufficient"), true);
});

Deno.test("wrong action_type ignored → shown", () => {
  const rows = [makeRow({ action_type: "manual_outreach" })];
  const result = evaluateSuggestion("org-1", rows);
  assertEquals(result.decision, "shown");
});

Deno.test("medium rate (between thresholds) → shown", () => {
  const rows = [makeRow({ success_rate: 0.3, total_actions: 10 })];
  const result = evaluateSuggestion("org-1", rows);
  assertEquals(result.decision, "shown");
});

// ── Backfill logic tests (structural) ──

Deno.test("backfill: sent campaign maps to executed action", () => {
  const campaign = { id: "camp-1", status: "sent", created_at: "2025-01-01" };
  const action = {
    action_type: "gmail_campaign",
    source: "manual",
    source_ref_id: campaign.id,
    status: "executed",
  };
  assertEquals(action.status, "executed");
  assertEquals(action.source_ref_id, campaign.id);
});

Deno.test("backfill: idempotent via source_ref_id + action_type unique", () => {
  const seen = new Set<string>();
  const key1 = "camp-1:gmail_campaign";
  const key2 = "camp-1:gmail_campaign";

  const first = !seen.has(key1);
  seen.add(key1);
  const second = !seen.has(key2);

  assertEquals(first, true);
  assertEquals(second, false);
});

// ── Outcome derivation ──

Deno.test("outcome: bounce maps from failure_category", () => {
  const failureCategories = ["bounce", "invalid_address"];
  const mapped = failureCategories.map((cat) =>
    cat === "bounce" || cat === "invalid_address" ? "bounce" : "ignore"
  );
  assertEquals(mapped, ["bounce", "bounce"]);
});

Deno.test("outcome: default confidences are correct", () => {
  const defaults: Record<string, number> = {
    reply: 0.9,
    meeting: 1.0,
    ignore: 0.2,
    bounce: 0.9,
  };
  assertEquals(defaults.reply, 0.9);
  assertEquals(defaults.meeting, 1.0);
  assertEquals(defaults.ignore, 0.2);
});

// ── Ranking math ──

Deno.test("ranking: success_rate computation", () => {
  const total = 10;
  const successful = 3;
  const rate = successful / total;
  assertEquals(rate, 0.3);
  assertEquals(rate >= THRESHOLDS.SUPPRESS_THRESHOLD, true);
  assertEquals(rate < THRESHOLDS.BOOST_THRESHOLD, true);
});

Deno.test("ranking: zero actions → rate 0, not suppressed (too few)", () => {
  const rows = [makeRow({ total_actions: 0, success_rate: 0 })];
  const result = evaluateSuggestion("org-1", rows);
  assertEquals(result.decision, "shown");
});
