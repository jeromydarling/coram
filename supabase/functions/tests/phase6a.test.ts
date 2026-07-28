import { assertEquals, assertExists, assertNotEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";

// ═══════════════════════════════════════════════
// Phase 6A — Deterministic Unit Tests
// No network calls — tests logic + contracts only
// ═══════════════════════════════════════════════

// ─── TEST 1: Workflow defaults contract ─────────

const WORKFLOW_DEFAULTS: Record<string, { cooldown: number; priority: number }> = {
  gmail_task_parse:      { cooldown: 3600,   priority: 5 },
  local_pulse_crawl:     { cooldown: 604800, priority: 3 },
  metro_narrative_build: { cooldown: 604800, priority: 4 },
  drift_detection:       { cooldown: 604800, priority: 3 },
  discovery_scrape:      { cooldown: 3600,   priority: 5 },
};

Deno.test("Workflow defaults — all scheduled workflows have cooldowns", () => {
  for (const [key, config] of Object.entries(WORKFLOW_DEFAULTS)) {
    assertEquals(config.cooldown > 0, true, `${key} must have positive cooldown`);
    assertEquals(config.priority >= 1 && config.priority <= 10, true, `${key} priority out of range`);
  }
});

Deno.test("Workflow defaults — gmail is hourly (3600s)", () => {
  assertEquals(WORKFLOW_DEFAULTS.gmail_task_parse.cooldown, 3600);
});

Deno.test("Workflow defaults — weekly workflows are 604800s", () => {
  assertEquals(WORKFLOW_DEFAULTS.local_pulse_crawl.cooldown, 604800);
  assertEquals(WORKFLOW_DEFAULTS.metro_narrative_build.cooldown, 604800);
  assertEquals(WORKFLOW_DEFAULTS.drift_detection.cooldown, 604800);
});

// ─── TEST 2: AI processing state enum ───────────

const VALID_AI_STATES = ["pending", "processed", "skipped_duplicate", "rate_limited"];

Deno.test("AI processing states — all are non-empty strings", () => {
  for (const state of VALID_AI_STATES) {
    assertEquals(typeof state, "string");
    assertEquals(state.length > 0, true);
  }
});

Deno.test("AI processing states — no duplicates", () => {
  const unique = new Set(VALID_AI_STATES);
  assertEquals(unique.size, VALID_AI_STATES.length);
});

// ─── TEST 3: Narrative cache hash logic ─────────

function mockNarrativeCacheHash(
  reflectionCount: number,
  pulseEventCount: number,
  signalCount: number,
  driftScore: number,
): string {
  // Mirrors the DB function logic
  const input = `${reflectionCount}:${pulseEventCount}:${signalCount}:${driftScore}`;
  // Simple hash simulation (in DB it's md5)
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(8, "0");
}

Deno.test("Narrative cache hash — deterministic", () => {
  const h1 = mockNarrativeCacheHash(5, 3, 2, 42);
  const h2 = mockNarrativeCacheHash(5, 3, 2, 42);
  assertEquals(h1, h2);
});

Deno.test("Narrative cache hash — changes with different inputs", () => {
  const h1 = mockNarrativeCacheHash(5, 3, 2, 42);
  const h2 = mockNarrativeCacheHash(6, 3, 2, 42);
  assertNotEquals(h1, h2);
});

Deno.test("Narrative cache hash — skip when unchanged", () => {
  const existingHash = mockNarrativeCacheHash(5, 3, 2, 42);
  const newHash = mockNarrativeCacheHash(5, 3, 2, 42);
  const shouldSkip = existingHash === newHash;
  assertEquals(shouldSkip, true);
});

// ─── TEST 4: Local Pulse auto-disable logic ─────

interface PulseSource {
  failure_count: number;
  auto_disabled: boolean;
  crawl_health_score: number;
}

function simulateFailure(source: PulseSource): PulseSource {
  const newCount = source.failure_count + 1;
  const newHealth = Math.max(0, source.crawl_health_score - 33);
  const autoDisabled = newCount >= 3;
  return {
    failure_count: newCount,
    auto_disabled: autoDisabled,
    crawl_health_score: newHealth,
  };
}

Deno.test("Pulse source — first failure does not disable", () => {
  const result = simulateFailure({ failure_count: 0, auto_disabled: false, crawl_health_score: 100 });
  assertEquals(result.auto_disabled, false);
  assertEquals(result.failure_count, 1);
  assertEquals(result.crawl_health_score, 67);
});

Deno.test("Pulse source — third failure auto-disables", () => {
  let source: PulseSource = { failure_count: 0, auto_disabled: false, crawl_health_score: 100 };
  source = simulateFailure(source);
  source = simulateFailure(source);
  source = simulateFailure(source);
  assertEquals(source.auto_disabled, true);
  assertEquals(source.failure_count, 3);
  assertEquals(source.crawl_health_score, 1); // 100 - 33 - 33 - 33
});

Deno.test("Pulse source — health score never goes below 0", () => {
  let source: PulseSource = { failure_count: 0, auto_disabled: false, crawl_health_score: 20 };
  source = simulateFailure(source);
  assertEquals(source.crawl_health_score >= 0, true);
});

// ─── TEST 5: Notification throttle logic ────────

function shouldAllowNotification(recentCount: number, maxPerHour: number): boolean {
  return recentCount < maxPerHour;
}

Deno.test("Notification throttle — allows under limit", () => {
  assertEquals(shouldAllowNotification(3, 5), true);
});

Deno.test("Notification throttle — blocks at limit", () => {
  assertEquals(shouldAllowNotification(5, 5), false);
});

Deno.test("Notification throttle — blocks over limit", () => {
  assertEquals(shouldAllowNotification(7, 5), false);
});

// ─── TEST 6: Drift score bounds ─────────────────

function clampDriftScore(score: number): number {
  if (score < 0) return 0;
  if (score > 100) return 100;
  return score;
}

Deno.test("Drift score — clamped to 0-100", () => {
  assertEquals(clampDriftScore(-10), 0);
  assertEquals(clampDriftScore(0), 0);
  assertEquals(clampDriftScore(50), 50);
  assertEquals(clampDriftScore(100), 100);
  assertEquals(clampDriftScore(150), 100);
});

// ─── TEST 7: Dedupe key generation ──────────────

function generateDedupeKey(workflowKey: string, metroId?: string): string {
  return `${workflowKey}:${metroId || "global"}`;
}

Deno.test("Dedupe key — includes metro when provided", () => {
  const key = generateDedupeKey("gmail_task_parse", "metro-123");
  assertEquals(key, "gmail_task_parse:metro-123");
});

Deno.test("Dedupe key — falls back to global", () => {
  const key = generateDedupeKey("drift_detection");
  assertEquals(key, "drift_detection:global");
});

// ─── TEST 8: Story events view contract ─────────

type StoryEventKind = "reflection" | "email" | "campaign" | "task";

Deno.test("Story event kinds — all valid kinds covered", () => {
  const validKinds: StoryEventKind[] = ["reflection", "email", "campaign", "task"];
  assertEquals(validKinds.length, 4);
  for (const kind of validKinds) {
    assertEquals(typeof kind, "string");
  }
});

// ─── TEST 9: Privacy firewall ───────────────────
import { stripPrivateFields } from "../_shared/sanitize-story-inputs.ts";

Deno.test("Privacy firewall — strips email body from narrative inputs", () => {
  const input = {
    subject: "Meeting follow-up",
    body: "Dear John, here is the private email body...",
    email_body: "Another private body",
    topics: ["education", "technology"],
    signal_type: "follow_up",
  };
  const cleaned = stripPrivateFields(input);
  assertEquals(cleaned.subject, "Meeting follow-up");
  assertEquals(cleaned.body, undefined);
  assertEquals(cleaned.email_body, undefined);
  assertExists(cleaned.topics);
  assertExists(cleaned.signal_type);
});

Deno.test("Privacy firewall — strips reflection body text", () => {
  const input = {
    title: "Weekly check-in",
    reflection_body: "Private reflection content here",
    content: "Also private",
    created_at: "2026-01-15",
  };
  const cleaned = stripPrivateFields(input);
  assertEquals(cleaned.title, "Weekly check-in");
  assertEquals(cleaned.reflection_body, undefined);
  assertEquals(cleaned.content, undefined);
  assertExists(cleaned.created_at);
});
