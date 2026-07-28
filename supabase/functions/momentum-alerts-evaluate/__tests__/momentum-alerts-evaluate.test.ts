import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { validateInput, shouldAlert } from "../index.ts";

// ── validateInput ──
Deno.test("validateInput: accepts valid input with opportunity_ids", () => {
  const result = validateInput({ opportunity_ids: ["abc-123"], force: false });
  assertEquals(result.valid, true);
});

Deno.test("validateInput: accepts organization_ids (backward compat)", () => {
  const result = validateInput({ organization_ids: ["abc-123"] });
  assertEquals(result.valid, true);
  if (result.valid) {
    assertEquals(result.data.opportunity_ids, ["abc-123"]);
  }
});

Deno.test("validateInput: accepts empty object", () => {
  const result = validateInput({});
  assertEquals(result.valid, true);
});

Deno.test("validateInput: rejects non-array opportunity_ids", () => {
  const result = validateInput({ opportunity_ids: "abc" });
  assertEquals(result.valid, false);
});

Deno.test("validateInput: rejects non-object body", () => {
  assertEquals(validateInput(null).valid, false);
});

// ── shouldAlert ──
Deno.test("shouldAlert: threshold crossing fires even within cooldown", () => {
  const result = shouldAlert(
    {
      score: 80,
      trend: "rising",
      score_delta: 15,
      last_alerted_at: new Date().toISOString(),
      last_alert_score: 70,
      drivers: [],
    },
    false,
    false,
  );
  assertEquals(result.shouldAlert, true);
  assertEquals(result.alertType, "threshold_crossing");
});

Deno.test("shouldAlert: no alert if already above threshold last time", () => {
  const result = shouldAlert(
    {
      score: 80,
      trend: "stable",
      score_delta: 2,
      last_alerted_at: new Date().toISOString(),
      last_alert_score: 78,
      drivers: [],
    },
    false,
    false,
  );
  assertEquals(result.shouldAlert, false);
});

Deno.test("shouldAlert: spike fires outside cooldown", () => {
  const oldDate = new Date(Date.now() - 10 * 86400000).toISOString();
  const result = shouldAlert(
    {
      score: 65,
      trend: "rising",
      score_delta: 15,
      last_alerted_at: oldDate,
      last_alert_score: 50,
      drivers: [],
    },
    false,
    false,
  );
  assertEquals(result.shouldAlert, true);
  assertEquals(result.alertType, "momentum_spike");
});

Deno.test("shouldAlert: spike blocked within cooldown", () => {
  const result = shouldAlert(
    {
      score: 65,
      trend: "rising",
      score_delta: 15,
      last_alerted_at: new Date().toISOString(),
      last_alert_score: 50,
      drivers: [],
    },
    false,
    false,
  );
  assertEquals(result.shouldAlert, false);
});

Deno.test("shouldAlert: force bypasses cooldown", () => {
  const result = shouldAlert(
    {
      score: 65,
      trend: "rising",
      score_delta: 15,
      last_alerted_at: new Date().toISOString(),
      last_alert_score: 50,
      drivers: [],
    },
    false,
    true,
  );
  assertEquals(result.shouldAlert, true);
});

Deno.test("shouldAlert: upcoming event fires outside cooldown", () => {
  const oldDate = new Date(Date.now() - 10 * 86400000).toISOString();
  const result = shouldAlert(
    {
      score: 65,
      trend: "stable",
      score_delta: 3,
      last_alerted_at: oldDate,
      last_alert_score: 62,
      drivers: [],
    },
    true,
    false,
  );
  assertEquals(result.shouldAlert, true);
  assertEquals(result.alertType, "upcoming_event");
});

Deno.test("shouldAlert: leadership change fires outside cooldown", () => {
  const oldDate = new Date(Date.now() - 10 * 86400000).toISOString();
  const recentTs = new Date(Date.now() - 5 * 86400000).toISOString();
  const result = shouldAlert(
    {
      score: 65,
      trend: "stable",
      score_delta: 3,
      last_alerted_at: oldDate,
      last_alert_score: 62,
      drivers: [{ type: "leadership_change", ts: recentTs }],
    },
    false,
    false,
  );
  assertEquals(result.shouldAlert, true);
  assertEquals(result.alertType, "leadership_change");
});

Deno.test("shouldAlert: no alert for low score", () => {
  const result = shouldAlert(
    {
      score: 30,
      trend: "stable",
      score_delta: 2,
      last_alerted_at: null,
      last_alert_score: null,
      drivers: [],
    },
    false,
    false,
  );
  assertEquals(result.shouldAlert, false);
});

Deno.test("shouldAlert: first ever threshold crossing (null last_alert_score)", () => {
  const result = shouldAlert(
    {
      score: 80,
      trend: "rising",
      score_delta: 20,
      last_alerted_at: null,
      last_alert_score: null,
      drivers: [],
    },
    false,
    false,
  );
  assertEquals(result.shouldAlert, true);
  assertEquals(result.alertType, "threshold_crossing");
});

Deno.test("shouldAlert: 7-day cooldown dedup (rerun within 7 days does not duplicate)", () => {
  // First alert just happened, score still high but not a new threshold crossing
  const justNow = new Date().toISOString();
  const result = shouldAlert(
    {
      score: 80,
      trend: "rising",
      score_delta: 13,
      last_alerted_at: justNow,
      last_alert_score: 80, // already alerted at this level
      drivers: [],
    },
    false,
    false,
  );
  // Not a threshold crossing (last_alert_score already >= 75)
  // Within cooldown, so spike rule is blocked
  assertEquals(result.shouldAlert, false);
});
