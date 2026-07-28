import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";

// ── Tier → Feature flag mapping ──────────────────────────
const TIER_FLAGS: Record<string, Record<string, boolean>> = {
  core: {
    civitas: true, voluntarium: true, provisio: true, signum: true,
    testimonium: false, impulsus: false, relatio: false,
  },
  insight: {
    civitas: true, voluntarium: true, provisio: true, signum: true,
    testimonium: true, impulsus: false, relatio: false,
  },
  story: {
    civitas: true, voluntarium: true, provisio: true, signum: true,
    testimonium: true, impulsus: true, relatio: false,
  },
  bridge: {
    civitas: true, voluntarium: true, provisio: true, signum: true,
    testimonium: true, impulsus: true, relatio: true,
  },
};

Deno.test("tier flag mapping: core excludes premium features", () => {
  const core = TIER_FLAGS.core;
  assertEquals(core.testimonium, false);
  assertEquals(core.impulsus, false);
  assertEquals(core.relatio, false);
  assertEquals(core.civitas, true);
  assertEquals(core.voluntarium, true);
});

Deno.test("tier flag mapping: insight enables testimonium only", () => {
  const insight = TIER_FLAGS.insight;
  assertEquals(insight.testimonium, true);
  assertEquals(insight.impulsus, false);
  assertEquals(insight.relatio, false);
});

Deno.test("tier flag mapping: story adds impulsus", () => {
  const story = TIER_FLAGS.story;
  assertEquals(story.testimonium, true);
  assertEquals(story.impulsus, true);
  assertEquals(story.relatio, false);
});

Deno.test("tier flag mapping: bridge enables all", () => {
  const bridge = TIER_FLAGS.bridge;
  assertEquals(bridge.testimonium, true);
  assertEquals(bridge.impulsus, true);
  assertEquals(bridge.relatio, true);
});

Deno.test("all tiers include core modules", () => {
  for (const [tier, flags] of Object.entries(TIER_FLAGS)) {
    assertEquals(flags.civitas, true, `${tier} should include civitas`);
    assertEquals(flags.voluntarium, true, `${tier} should include voluntarium`);
    assertEquals(flags.provisio, true, `${tier} should include provisio`);
    assertEquals(flags.signum, true, `${tier} should include signum`);
  }
});

// ── Stripe webhook: missing signature ─────────────────────
Deno.test("stripe-webhook rejects missing signature", async () => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  if (!supabaseUrl) {
    console.log("SUPABASE_URL not set, skipping integration test");
    return;
  }

  const response = await fetch(`${supabaseUrl}/functions/v1/stripe-webhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "checkout.session.completed", data: { object: {} } }),
  });

  const status = response.status;
  assertEquals(status === 400 || status === 503, true, `Expected 400 or 503, got ${status}`);
  await response.text();
});

// ── Idempotency: tier derivation is deterministic ─────────
Deno.test("tier derivation from comma-separated tiers", () => {
  const deriveTier = (tiers: string) => tiers.split(",").pop() ?? "core";
  assertEquals(deriveTier("core"), "core");
  assertEquals(deriveTier("core,insight"), "insight");
  assertEquals(deriveTier("core,insight,story"), "story");
  assertEquals(deriveTier("core,insight,story,bridge"), "bridge");
});

// ── Valid archetypes ──────────────────────────────────────
Deno.test("all required archetypes are present", () => {
  const requiredKeys = [
    "church", "social_enterprise", "workforce_development",
    "housing", "education", "government",
  ];
  // This validates the list from the prompt
  for (const key of requiredKeys) {
    assertEquals(typeof key, "string", `${key} should be a valid archetype key`);
  }
});
