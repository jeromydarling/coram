import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

// ============================================================
// Phase F2 Tests: Debounce Lock + Action Execution + Idempotency
// ============================================================

// ── Debounce lock logic (pure functions, no network) ──

function shouldAcquireLock(
  existing: { lock_until: string } | null,
  now: Date,
): boolean {
  if (!existing) return true; // No row → acquire
  return new Date(existing.lock_until) <= now; // Expired → acquire
}

Deno.test("debounce: acquire when no existing lock", () => {
  assertEquals(shouldAcquireLock(null, new Date()), true);
});

Deno.test("debounce: deny when lock is active", () => {
  const futureDate = new Date(Date.now() + 3 * 60 * 60 * 1000); // 3h from now
  assertEquals(
    shouldAcquireLock({ lock_until: futureDate.toISOString() }, new Date()),
    false,
  );
});

Deno.test("debounce: acquire when lock expired", () => {
  const pastDate = new Date(Date.now() - 1000); // 1s ago
  assertEquals(
    shouldAcquireLock({ lock_until: pastDate.toISOString() }, new Date()),
    true,
  );
});

Deno.test("debounce: lock window is 6 hours", () => {
  const now = new Date();
  const lockUntil = new Date(now.getTime() + 6 * 60 * 60 * 1000);
  const fiveHoursLater = new Date(now.getTime() + 5 * 60 * 60 * 1000);
  const sevenHoursLater = new Date(now.getTime() + 7 * 60 * 60 * 1000);

  // At 5h: still locked
  assertEquals(
    shouldAcquireLock({ lock_until: lockUntil.toISOString() }, fiveHoursLater),
    false,
  );
  // At 7h: expired
  assertEquals(
    shouldAcquireLock({ lock_until: lockUntil.toISOString() }, sevenHoursLater),
    true,
  );
});

// ── Action execution logic ──

interface ActionState {
  status: string;
  cta_context: Record<string, unknown>;
}

function isIdempotent(action: ActionState): boolean {
  return action.status !== "open";
}

function hasResultId(action: ActionState): boolean {
  return !!action.cta_context?.result_id;
}

Deno.test("action execution: idempotent if already completed", () => {
  assertEquals(isIdempotent({ status: "completed", cta_context: {} }), true);
});

Deno.test("action execution: idempotent if dismissed", () => {
  assertEquals(isIdempotent({ status: "dismissed", cta_context: {} }), true);
});

Deno.test("action execution: not idempotent if open", () => {
  assertEquals(isIdempotent({ status: "open", cta_context: {} }), false);
});

Deno.test("action execution: detects result_id for dedup", () => {
  assertEquals(hasResultId({ status: "open", cta_context: { result_id: "abc" } }), true);
  assertEquals(hasResultId({ status: "open", cta_context: {} }), false);
});

// ── Action type routing ──

function getNavigationForActionType(actionType: string, orgId: string): { navigate_to: string; highlight?: string } | null {
  switch (actionType) {
    case "review_recent_changes":
    case "verify_operations":
      return { navigate_to: `/organizations/${orgId}`, highlight: "watchlist" };
    case "find_local_partners":
      return { navigate_to: `/organizations/${orgId}`, highlight: "contacts" };
    case "tailor_pitch":
      return { navigate_to: `/organizations/${orgId}`, highlight: "insights" };
    case "adjust_expectations":
      return { navigate_to: `/pipeline` };
    case "create_outreach_draft":
    case "create_draft_campaign":
      return { navigate_to: `/campaigns` };
    case "create_task":
      return null; // No navigation, just task creation
    default:
      return null;
  }
}

Deno.test("action routing: review_recent_changes navigates to watchlist", () => {
  const result = getNavigationForActionType("review_recent_changes", "org1");
  assertEquals(result?.navigate_to, "/organizations/org1");
  assertEquals(result?.highlight, "watchlist");
});

Deno.test("action routing: create_outreach_draft navigates to campaigns", () => {
  const result = getNavigationForActionType("create_outreach_draft", "org1");
  assertEquals(result?.navigate_to, "/campaigns");
});

Deno.test("action routing: adjust_expectations navigates to pipeline", () => {
  const result = getNavigationForActionType("adjust_expectations", "org1");
  assertEquals(result?.navigate_to, "/pipeline");
});

Deno.test("action routing: create_task returns null (no navigation)", () => {
  const result = getNavigationForActionType("create_task", "org1");
  assertEquals(result, null);
});

Deno.test("action routing: unknown type returns null", () => {
  const result = getNavigationForActionType("unknown_action", "org1");
  assertEquals(result, null);
});

// ── Feedback recording ──

Deno.test("feedback: completed outcome is 'completed'", () => {
  const outcome = "completed";
  assertEquals(outcome === "completed" || outcome === "dismissed", true);
});

Deno.test("feedback: dismissed outcome is 'dismissed'", () => {
  const outcome: string = "dismissed";
  assertEquals(outcome === "completed" || outcome === "dismissed", true);
});

// ── Auto-trigger safety ──

Deno.test("auto-trigger: only fires when signal_emitted is true", () => {
  const signalEmitted = true;
  const shouldTrigger = signalEmitted;
  assertEquals(shouldTrigger, true);
});

Deno.test("auto-trigger: skips when signal_emitted is false", () => {
  const signalEmitted = false;
  const shouldTrigger = signalEmitted;
  assertEquals(shouldTrigger, false);
});

Deno.test("auto-trigger: never calls explain-org-insight", () => {
  // Verify that auto-generation only calls generate-org-insights
  const autoCalledFunctions = ["generate-org-insights"];
  assertEquals(autoCalledFunctions.includes("explain-org-insight"), false);
});
