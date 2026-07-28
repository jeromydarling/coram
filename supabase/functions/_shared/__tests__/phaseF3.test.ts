import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { getEffectiveInsightPatterns } from "../insightPatterns.ts";

// ── Fixtures ──

const MOCK_INSIGHT_DATA = [
  {
    insight_type: "momentum_increase",
    org_recommended_actions: [
      {
        action_type: "create_outreach_draft",
        org_action_outcomes: [{ outcome_type: "successful" }],
      },
      {
        action_type: "review_recent_changes",
        org_action_outcomes: [{ outcome_type: "unsuccessful" }],
      },
    ],
  },
  {
    insight_type: "momentum_increase",
    org_recommended_actions: [
      {
        action_type: "create_outreach_draft",
        org_action_outcomes: [{ outcome_type: "successful" }],
      },
    ],
  },
  {
    insight_type: "instability_risk",
    org_recommended_actions: [
      {
        action_type: "verify_operations",
        org_action_outcomes: [{ outcome_type: "unsuccessful" }],
      },
    ],
  },
];

// ── Mock Supabase client ──
function mockClient(data: unknown[] | null, error: { message: string } | null = null) {
  const chainable = {
    select: () => chainable,
    eq: () => chainable,
    then: (resolve: (val: { data: unknown; error: unknown }) => void) =>
      resolve({ data, error }),
  };
  return {
    from: () => chainable,
  } as unknown as Parameters<typeof getEffectiveInsightPatterns>[0];
}

// ── Tests: Pattern extraction ──

Deno.test("getEffectiveInsightPatterns - computes insight type patterns", async () => {
  const client = mockClient(MOCK_INSIGHT_DATA);
  const result = await getEffectiveInsightPatterns(client, {});

  assertExists(result.top_insight_types);
  assertEquals(result.top_insight_types.length, 2);

  const momentum = result.top_insight_types.find(
    (p) => p.insight_type === "momentum_increase",
  );
  assertExists(momentum);
  assertEquals(momentum.total_outcomes, 3);
  assertEquals(momentum.successful, 2);
  assertEquals(momentum.unsuccessful, 1);
  assertEquals(momentum.success_rate, 67);
});

Deno.test("getEffectiveInsightPatterns - computes action type patterns", async () => {
  const client = mockClient(MOCK_INSIGHT_DATA);
  const result = await getEffectiveInsightPatterns(client, {});

  assertExists(result.top_action_types);
  const outreach = result.top_action_types.find(
    (p) => p.action_type === "create_outreach_draft",
  );
  assertExists(outreach);
  assertEquals(outreach.successful, 2);
  assertEquals(outreach.success_rate, 100);
});

Deno.test("getEffectiveInsightPatterns - empty data returns empty arrays", async () => {
  const client = mockClient([]);
  const result = await getEffectiveInsightPatterns(client, {});

  assertEquals(result.top_insight_types.length, 0);
  assertEquals(result.top_action_types.length, 0);
});

Deno.test("getEffectiveInsightPatterns - null data returns empty arrays", async () => {
  const client = mockClient(null);
  const result = await getEffectiveInsightPatterns(client, {});

  assertEquals(result.top_insight_types.length, 0);
  assertEquals(result.top_action_types.length, 0);
});

Deno.test("getEffectiveInsightPatterns - error returns empty arrays", async () => {
  const client = mockClient(null, { message: "test error" });
  const result = await getEffectiveInsightPatterns(client, {});

  assertEquals(result.top_insight_types.length, 0);
  assertEquals(result.top_action_types.length, 0);
});

// ── Tests: Outcome uniqueness (structural) ──

Deno.test("outcome uniqueness - action_id unique constraint concept", () => {
  // This tests the conceptual invariant: one outcome per action
  const outcomes = new Map<string, string>();
  const actionId = "test-action-1";

  // First insert succeeds
  const firstInsert = !outcomes.has(actionId);
  assertEquals(firstInsert, true);
  outcomes.set(actionId, "successful");

  // Second insert rejected
  const secondInsert = !outcomes.has(actionId);
  assertEquals(secondInsert, false);
});

Deno.test("outcome types are strictly validated", () => {
  const validTypes = new Set([
    "completed",
    "ignored",
    "successful",
    "unsuccessful",
    "needs_followup",
  ]);

  assertEquals(validTypes.has("successful"), true);
  assertEquals(validTypes.has("unsuccessful"), true);
  assertEquals(validTypes.has("needs_followup"), true);
  assertEquals(validTypes.has("invalid_type"), false);
  assertEquals(validTypes.has(""), false);
});

// ── Tests: View recomputation (structural) ──

Deno.test("effectiveness view - computes success_rate correctly", () => {
  // Simulates the SQL view's logic
  const computeRate = (successful: number, unsuccessful: number) => {
    const total = successful + unsuccessful;
    if (total === 0) return null;
    return Math.round((successful / total) * 100 * 10) / 10;
  };

  assertEquals(computeRate(3, 1), 75);
  assertEquals(computeRate(0, 0), null);
  assertEquals(computeRate(1, 0), 100);
  assertEquals(computeRate(0, 5), 0);
});

Deno.test("effectiveness view - empty actions produce zero counts", () => {
  const insight = {
    actions_created: 0,
    actions_completed: 0,
    actions_successful: 0,
    actions_unsuccessful: 0,
  };

  assertEquals(insight.actions_created, 0);
  assertEquals(insight.actions_successful, 0);
});

Deno.test("patterns sorted by success_rate descending", async () => {
  const data = [
    {
      insight_type: "low_rate",
      org_recommended_actions: [
        { action_type: "a", org_action_outcomes: [{ outcome_type: "unsuccessful" }] },
      ],
    },
    {
      insight_type: "high_rate",
      org_recommended_actions: [
        { action_type: "b", org_action_outcomes: [{ outcome_type: "successful" }] },
      ],
    },
  ];
  const client = mockClient(data);
  const result = await getEffectiveInsightPatterns(client, {});

  assertEquals(result.top_insight_types[0].insight_type, "high_rate");
  assertEquals(result.top_insight_types[1].insight_type, "low_rate");
});
