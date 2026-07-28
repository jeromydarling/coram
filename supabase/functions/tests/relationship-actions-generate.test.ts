import { assertEquals, assertExists } from "https://deno.land/std@0.208.0/assert/mod.ts";
import {
  buildActionsFromEvidence,
  computePriorityLabel,
} from "../relationship-actions-generate/index.ts";

// ── Unit tests (always run) ──

Deno.test("computePriorityLabel returns correct labels", () => {
  assertEquals(computePriorityLabel(80), "high");
  assertEquals(computePriorityLabel(70), "high");
  assertEquals(computePriorityLabel(69), "normal");
  assertEquals(computePriorityLabel(50), "normal");
  assertEquals(computePriorityLabel(40), "normal");
  assertEquals(computePriorityLabel(39), "low");
  assertEquals(computePriorityLabel(0), "low");
  assertEquals(computePriorityLabel(100), "high");
});

Deno.test("buildActionsFromEvidence — leadership change creates reach_out action", () => {
  const actions = buildActionsFromEvidence({
    signals: [
      {
        signal_type: "leadership_change",
        signal_value: "New CEO: Jane Doe",
        confidence: 0.85,
        source_url: "https://example.com/news",
        detected_at: new Date().toISOString(),
      },
    ],
    momentum: null,
    discoveredItems: [],
  });

  assertEquals(actions.length, 1);
  assertEquals(actions[0].action_type, "reach_out");
  assertEquals(actions[0].title, "Reach out after leadership change");
  assertEquals(actions[0].priority_score, 75);
  assertEquals(actions[0].suggested_timing, "this week");
  assertExists(actions[0].drivers);
  assertEquals(actions[0].drivers.length, 1);
});

Deno.test("buildActionsFromEvidence — leadership change + rising momentum adds +10", () => {
  const actions = buildActionsFromEvidence({
    signals: [
      {
        signal_type: "leadership_change",
        signal_value: "New CFO: John Smith",
        confidence: 0.9,
        source_url: null,
        detected_at: new Date().toISOString(),
      },
    ],
    momentum: { score: 72, trend: "rising", score_delta: 10, drivers: [] },
    discoveredItems: [],
  });

  assertEquals(actions.length >= 1, true);
  // Leadership action should be 75 + 10 = 85
  const reachOut = actions.find((a) => a.action_type === "reach_out");
  assertExists(reachOut);
  assertEquals(reachOut!.priority_score, 85);
});

Deno.test("buildActionsFromEvidence — upcoming event within 7 days", () => {
  const in5Days = new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10);
  const actions = buildActionsFromEvidence({
    signals: [],
    momentum: null,
    discoveredItems: [
      {
        id: "item-1",
        module: "events",
        title: "Tech Conference 2026",
        snippet: "Annual tech event",
        canonical_url: "https://example.com/event",
        event_date: in5Days,
      },
    ],
  });

  assertEquals(actions.length, 1);
  assertEquals(actions[0].action_type, "attend_event");
  assertEquals(actions[0].priority_score, 70); // within 7 days
});

Deno.test("buildActionsFromEvidence — upcoming event between 7-14 days scores 60", () => {
  const in10Days = new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10);
  const actions = buildActionsFromEvidence({
    signals: [],
    momentum: null,
    discoveredItems: [
      {
        id: "item-2",
        module: "events",
        title: "Networking Event",
        snippet: null,
        canonical_url: "https://example.com/event2",
        event_date: in10Days,
      },
    ],
  });

  assertEquals(actions.length, 1);
  assertEquals(actions[0].priority_score, 60);
});

Deno.test("buildActionsFromEvidence — event beyond 14 days is excluded", () => {
  const in20Days = new Date(Date.now() + 20 * 86400000).toISOString().slice(0, 10);
  const actions = buildActionsFromEvidence({
    signals: [],
    momentum: null,
    discoveredItems: [
      {
        id: "item-3",
        module: "events",
        title: "Far Future Event",
        snippet: null,
        canonical_url: "https://example.com/event3",
        event_date: in20Days,
      },
    ],
  });

  assertEquals(actions.length, 0);
});

Deno.test("buildActionsFromEvidence — momentum rising creates follow_up action", () => {
  const actions = buildActionsFromEvidence({
    signals: [],
    momentum: {
      score: 65,
      trend: "rising",
      score_delta: 12,
      drivers: [
        { label: "New partnership signal" },
        { label: "Recent meeting" },
        { label: "Third driver ignored" },
      ],
    },
    discoveredItems: [],
  });

  const followUp = actions.find((a) => a.action_type === "follow_up");
  assertExists(followUp);
  assertEquals(followUp!.priority_score, 65);
  assertEquals(followUp!.title, "Follow up — momentum rising");
});

Deno.test("buildActionsFromEvidence — max 10 actions cap", () => {
  const signals = Array.from({ length: 15 }, (_, i) => ({
    signal_type: "leadership_change",
    signal_value: `Change ${i}`,
    confidence: 0.8,
    source_url: null,
    detected_at: new Date().toISOString(),
  }));

  const actions = buildActionsFromEvidence({
    signals,
    momentum: null,
    discoveredItems: [],
  });

  assertEquals(actions.length <= 10, true);
});

Deno.test("buildActionsFromEvidence — old leadership signal (>30d) excluded", () => {
  const actions = buildActionsFromEvidence({
    signals: [
      {
        signal_type: "leadership_change",
        signal_value: "Old change",
        confidence: 0.9,
        source_url: null,
        detected_at: new Date(Date.now() - 35 * 86400000).toISOString(),
      },
    ],
    momentum: null,
    discoveredItems: [],
  });

  assertEquals(actions.length, 0);
});

Deno.test("buildActionsFromEvidence — grant with first_seen_at within 30d creates action", () => {
  const actions = buildActionsFromEvidence({
    signals: [],
    momentum: null,
    discoveredItems: [
      {
        id: "grant-1",
        module: "grants",
        title: "Community Impact Grant",
        snippet: "Up to $50,000 for digital equity",
        canonical_url: "https://grants.example.com/apply",
        event_date: null,
        first_seen_at: new Date(Date.now() - 5 * 86400000).toISOString(),
      },
    ],
  });

  assertEquals(actions.length, 1);
  assertEquals(actions[0].action_type, "apply_grant");
  assertEquals(actions[0].priority_score, 55);
});

Deno.test("buildActionsFromEvidence — grant older than 30 days is excluded", () => {
  const actions = buildActionsFromEvidence({
    signals: [],
    momentum: null,
    discoveredItems: [
      {
        id: "grant-old",
        module: "grants",
        title: "Expired Grant",
        snippet: "Too old",
        canonical_url: "https://grants.example.com/old",
        event_date: null,
        first_seen_at: new Date(Date.now() - 35 * 86400000).toISOString(),
      },
    ],
  });

  assertEquals(actions.length, 0);
});

Deno.test("buildActionsFromEvidence — grant without first_seen_at is excluded", () => {
  const actions = buildActionsFromEvidence({
    signals: [],
    momentum: null,
    discoveredItems: [
      {
        id: "grant-no-date",
        module: "grants",
        title: "Mystery Grant",
        snippet: "No date",
        canonical_url: "https://grants.example.com/x",
        event_date: null,
        first_seen_at: null,
      },
    ],
  });

  assertEquals(actions.length, 0);
});

Deno.test("buildActionsFromEvidence — event with invalid event_date is skipped", () => {
  const actions = buildActionsFromEvidence({
    signals: [],
    momentum: null,
    discoveredItems: [
      {
        id: "event-bad",
        module: "events",
        title: "Bad Date Event",
        snippet: null,
        canonical_url: "https://example.com/event",
        event_date: "not-a-date",
      },
    ],
  });

  assertEquals(actions.length, 0);
});

Deno.test("buildActionsFromEvidence — event with null event_date is skipped", () => {
  const actions = buildActionsFromEvidence({
    signals: [],
    momentum: null,
    discoveredItems: [
      {
        id: "event-null",
        module: "events",
        title: "Null Date Event",
        snippet: null,
        canonical_url: "https://example.com/event2",
        event_date: null,
      },
    ],
  });

  assertEquals(actions.length, 0);
});

Deno.test("buildActionsFromEvidence — title whitespace is normalized in output", () => {
  const actions = buildActionsFromEvidence({
    signals: [
      {
        signal_type: "leadership_change",
        signal_value: "New CEO:  Jane   Doe",
        confidence: 0.85,
        source_url: null,
        detected_at: new Date().toISOString(),
      },
    ],
    momentum: null,
    discoveredItems: [],
  });

  assertEquals(actions.length, 1);
  // Title from the rule is hardcoded "Reach out after leadership change" — no whitespace issue
  // but verify the signal_value with extra spaces doesn't break anything
  assertEquals(actions[0].action_type, "reach_out");
  assertEquals(actions[0].title, "Reach out after leadership change");
});

// ── Integration tests (gated) ──

const FUNCTION_URL = Deno.env.get("SUPABASE_FUNCTIONS_URL");
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

Deno.test({
  name: "integration: relationship-actions-generate rejects missing auth",
  ignore: !FUNCTION_URL || !SERVICE_KEY,
  fn: async () => {
    const resp = await fetch(`${FUNCTION_URL}/relationship-actions-generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scope: "opportunity", opportunity_id: "00000000-0000-0000-0000-000000000001" }),
    });
    assertEquals(resp.status, 401);
    await resp.body?.cancel();
  },
});

Deno.test({
  name: "integration: relationship-actions-generate rejects invalid scope",
  ignore: !FUNCTION_URL || !SERVICE_KEY,
  fn: async () => {
    const resp = await fetch(`${FUNCTION_URL}/relationship-actions-generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SERVICE_KEY}`,
      },
      body: JSON.stringify({ scope: "invalid" }),
    });
    assertEquals(resp.status, 400);
    await resp.body?.cancel();
  },
});
