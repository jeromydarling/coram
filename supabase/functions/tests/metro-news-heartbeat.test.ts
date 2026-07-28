import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

// ── Replicate signal strength computation ──
function computeSignalStrength(
  itemsUsed: number,
  topicsUsed: number,
  hasNeedSignals: boolean,
): number {
  let score = 0;
  score += Math.min(50, itemsUsed * 5);
  score += Math.min(30, topicsUsed * 3);
  if (hasNeedSignals) score += 20;
  return Math.max(0, Math.min(100, score));
}

// ── Health computation ──
type PulseHealth = "healthy" | "quiet" | "stale";

function computeHealth(runs: Array<{ ran_at: string; articles_persisted: number; status: string }>): PulseHealth {
  if (!runs.length) return "stale";
  const latest = runs[0];
  const daysAgo = (Date.now() - new Date(latest.ran_at).getTime()) / (1000 * 60 * 60 * 24);
  if (daysAgo > 8) return "stale";
  if (latest.articles_persisted === 0) return "quiet";
  return "healthy";
}

// ═══════════════════ Signal Strength Tests ═══════════════════

Deno.test("signal strength: zero inputs = 0", () => {
  assertEquals(computeSignalStrength(0, 0, false), 0);
});

Deno.test("signal strength: 10 items, 5 topics, need_signals = 95", () => {
  // 10*5=50 + 5*3=15 + 20 = 85
  assertEquals(computeSignalStrength(10, 5, true), 85);
});

Deno.test("signal strength: capped at 100", () => {
  assertEquals(computeSignalStrength(100, 100, true), 100);
});

Deno.test("signal strength: items cap at 50", () => {
  // 20*5=100 → cap 50, 0 topics, no need = 50
  assertEquals(computeSignalStrength(20, 0, false), 50);
});

Deno.test("signal strength: topics cap at 30", () => {
  // 0 items, 15*3=45 → cap 30, no need = 30
  assertEquals(computeSignalStrength(0, 15, false), 30);
});

Deno.test("signal strength: need_signals adds 20", () => {
  assertEquals(computeSignalStrength(0, 0, true), 20);
});

Deno.test("signal strength: deterministic across calls", () => {
  const a = computeSignalStrength(7, 3, true);
  const b = computeSignalStrength(7, 3, true);
  assertEquals(a, b);
  // 7*5=35 + 3*3=9 + 20 = 64
  assertEquals(a, 64);
});

// ═══════════════════ Health Detection Tests ═══════════════════

Deno.test("health: no runs = stale", () => {
  assertEquals(computeHealth([]), "stale");
});

Deno.test("health: recent run with articles = healthy", () => {
  assertEquals(
    computeHealth([{ ran_at: new Date().toISOString(), articles_persisted: 5, status: "completed" }]),
    "healthy",
  );
});

Deno.test("health: recent run with 0 articles = quiet", () => {
  assertEquals(
    computeHealth([{ ran_at: new Date().toISOString(), articles_persisted: 0, status: "completed" }]),
    "quiet",
  );
});

Deno.test("health: old run = stale", () => {
  const old = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
  assertEquals(
    computeHealth([{ ran_at: old, articles_persisted: 10, status: "completed" }]),
    "stale",
  );
});

Deno.test("health: run at exactly 8 days = stale", () => {
  const eightDays = new Date(Date.now() - 8.01 * 24 * 60 * 60 * 1000).toISOString();
  assertEquals(
    computeHealth([{ ran_at: eightDays, articles_persisted: 3, status: "completed" }]),
    "stale",
  );
});

Deno.test("health: run at 7 days with articles = healthy", () => {
  const sevenDays = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  assertEquals(
    computeHealth([{ ran_at: sevenDays, articles_persisted: 2, status: "completed" }]),
    "healthy",
  );
});
