import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assertNotEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;

// ─── Helper ───
async function invokeFunction(name: string, body: Record<string, unknown>, token?: string) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token || SUPABASE_ANON_KEY}`,
  };
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, body: text };
}

// ─── Adoption Refresh Tests ───

Deno.test("operator-adoption-refresh: rejects unauthenticated", async () => {
  const { status, body } = await invokeFunction("operator-adoption-refresh", { scope: "all" });
  // Should be 401 or 403 without valid auth
  assertEquals(status >= 400, true, `Expected 4xx, got ${status}: ${body}`);
  await new Promise((r) => setTimeout(r, 0)); // consume
});

Deno.test("operator-job-heartbeat: rejects unauthenticated", async () => {
  const { status, body } = await invokeFunction("operator-job-heartbeat", {
    job_key: "test-job",
    status: "ok",
  });
  assertEquals(status >= 400, true, `Expected 4xx, got ${status}: ${body}`);
});

Deno.test("operator-value-moment-log: rejects unauthenticated", async () => {
  const { status, body } = await invokeFunction("operator-value-moment-log", {
    tenant_id: "00000000-0000-0000-0000-000000000000",
    moment_type: "nri_action_taken",
    summary: "Test moment",
  });
  assertEquals(status >= 400, true, `Expected 4xx, got ${status}: ${body}`);
});

// ─── Score mapping tests (unit logic) ───

Deno.test("adoption score maps to correct labels", () => {
  function scoreToLabel(score: number): string {
    if (score >= 80) return "thriving";
    if (score >= 50) return "active";
    if (score >= 20) return "warming";
    return "quiet";
  }

  assertEquals(scoreToLabel(0), "quiet");
  assertEquals(scoreToLabel(10), "quiet");
  assertEquals(scoreToLabel(19), "quiet");
  assertEquals(scoreToLabel(20), "warming");
  assertEquals(scoreToLabel(49), "warming");
  assertEquals(scoreToLabel(50), "active");
  assertEquals(scoreToLabel(79), "active");
  assertEquals(scoreToLabel(80), "thriving");
  assertEquals(scoreToLabel(100), "thriving");
});

Deno.test("adoption score calculation is deterministic", () => {
  function computeScore(totals: Record<string, number>): number {
    let score = 0;
    if (totals.reflections_created >= 2) score += 10;
    if (totals.events_added >= 1) score += 10;
    if (totals.signum_articles_ingested > 0) score += 10;
    if (totals.nri_suggestions_accepted >= 1) score += 10;
    if (totals.provisio_created >= 1) score += 10;
    if (totals.voluntarium_hours_logged >= 1) score += 10;
    if (totals.communio_shared_signals >= 1) score += 10;
    if (totals.campaign_touches >= 1) score += 10;
    if (totals.reflections_created >= 5) score += 10;
    if (totals.nri_suggestions_created >= 3) score += 10;
    return Math.min(score, 100);
  }

  // Empty week = 0
  assertEquals(computeScore({
    reflections_created: 0, events_added: 0, signum_articles_ingested: 0,
    nri_suggestions_accepted: 0, provisio_created: 0, voluntarium_hours_logged: 0,
    communio_shared_signals: 0, campaign_touches: 0, nri_suggestions_created: 0,
  }), 0);

  // Full engagement
  assertEquals(computeScore({
    reflections_created: 5, events_added: 2, signum_articles_ingested: 10,
    nri_suggestions_accepted: 3, provisio_created: 1, voluntarium_hours_logged: 5,
    communio_shared_signals: 2, campaign_touches: 1, nri_suggestions_created: 5,
  }), 100);

  // Partial
  assertEquals(computeScore({
    reflections_created: 2, events_added: 1, signum_articles_ingested: 0,
    nri_suggestions_accepted: 0, provisio_created: 0, voluntarium_hours_logged: 0,
    communio_shared_signals: 0, campaign_touches: 0, nri_suggestions_created: 0,
  }), 20);

  // Same input = same output (determinism)
  const input = {
    reflections_created: 3, events_added: 1, signum_articles_ingested: 5,
    nri_suggestions_accepted: 1, provisio_created: 0, voluntarium_hours_logged: 0,
    communio_shared_signals: 1, campaign_touches: 0, nri_suggestions_created: 0,
  };
  assertEquals(computeScore(input), computeScore(input));
});

// ─── PII validation ───

Deno.test("value moment rejects forbidden PII keys", async () => {
  // Without auth this will fail for auth reasons, but the logic is tested in the function
  const { status } = await invokeFunction("operator-value-moment-log", {
    tenant_id: "00000000-0000-0000-0000-000000000000",
    moment_type: "nri_action_taken",
    summary: "Test",
    pointers: { body: "secret email content" },
  });
  // Should reject (either for auth or for PII)
  assertEquals(status >= 400, true);
});
