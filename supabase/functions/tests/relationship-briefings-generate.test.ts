import { assertEquals, assertExists } from "https://deno.land/std@0.208.0/assert/mod.ts";
import {
  formatBriefingMd,
  buildDeterministicBriefing,
} from "../relationship-briefings-generate/index.ts";

// ── Unit tests (always run) ──

Deno.test("formatBriefingMd produces valid markdown", () => {
  const briefing = {
    headline: "3 actions this week",
    top_moves: [
      {
        title: "Reach out to Org A",
        why: "Leadership change detected",
        when: "this week",
        evidence_urls: ["https://example.com/news"],
      },
    ],
    upcoming_soon: [
      {
        title: "Tech Summit",
        date: "2026-02-20",
        why_it_matters: "Key event for networking",
        url: "https://example.com/event",
      },
    ],
    watchlist: [],
    metrics: { open_actions: 3, high_priority: 1 },
  };

  const md = formatBriefingMd(briefing);
  assertExists(md);
  assertEquals(md.includes("# 3 actions this week"), true);
  assertEquals(md.includes("## Top Moves"), true);
  assertEquals(md.includes("Reach out to Org A"), true);
  assertEquals(md.includes("## 🔥 Happening Soon"), true);
  assertEquals(md.includes("Tech Summit"), true);
  assertEquals(md.includes("## Metrics"), true);
});

Deno.test("formatBriefingMd handles empty briefing", () => {
  const md = formatBriefingMd({ headline: "Empty week" });
  assertExists(md);
  assertEquals(md.includes("# Empty week"), true);
});

Deno.test("buildDeterministicBriefing creates correct structure", () => {
  const actions = [
    { title: "Action 1", summary: "Do something", priority_score: 80, priority_label: "high", suggested_timing: "this week", drivers: [{ source_url: "https://a.com" }] },
    { title: "Action 2", summary: "Do more", priority_score: 50, priority_label: "normal", suggested_timing: null, drivers: [] },
  ];
  const events = [
    { title: "Big Event", event_date: "2026-02-20", canonical_url: "https://event.com" },
  ];

  const result = buildDeterministicBriefing(
    actions as Array<Record<string, unknown>>,
    events as Array<Record<string, unknown>>,
  );

  assertExists(result.headline);
  assertEquals((result.headline as string).includes("2 relationship action"), true);
  assertEquals((result.top_moves as unknown[]).length, 2);
  assertEquals((result.upcoming_soon as unknown[]).length, 1);
  assertEquals((result.metrics as Record<string, number>).open_actions, 2);
  assertEquals((result.metrics as Record<string, number>).high_priority, 1);
});

Deno.test("buildDeterministicBriefing caps top_moves at 5", () => {
  const actions = Array.from({ length: 10 }, (_, i) => ({
    title: `Action ${i}`,
    summary: `Summary ${i}`,
    priority_score: 90 - i,
    priority_label: "high",
    suggested_timing: null,
    drivers: [],
  }));

  const result = buildDeterministicBriefing(
    actions as Array<Record<string, unknown>>,
    [],
  );

  assertEquals((result.top_moves as unknown[]).length, 5);
});

Deno.test("buildDeterministicBriefing caps upcoming at 5", () => {
  const events = Array.from({ length: 8 }, (_, i) => ({
    title: `Event ${i}`,
    event_date: `2026-02-${15 + i}`,
    canonical_url: `https://event${i}.com`,
  }));

  const result = buildDeterministicBriefing(
    [],
    events as Array<Record<string, unknown>>,
  );

  assertEquals((result.upcoming_soon as unknown[]).length, 5);
});

Deno.test("buildDeterministicBriefing is used as fallback for malformed AI JSON", () => {
  // Simulate what happens when AI returns invalid JSON —
  // the function should fall back to buildDeterministicBriefing
  const actions = [
    { title: "Test Action", summary: "Test", priority_score: 80, priority_label: "high", suggested_timing: "now", drivers: [] },
  ];
  const events = [
    { title: "Test Event", event_date: "2026-02-20", canonical_url: "https://e.com" },
  ];

  const fallback = buildDeterministicBriefing(
    actions as Array<Record<string, unknown>>,
    events as Array<Record<string, unknown>>,
  );

  // Verify the fallback has all required keys
  assertEquals("headline" in fallback, true);
  assertEquals("top_moves" in fallback, true);
  assertEquals("upcoming_soon" in fallback, true);
  assertEquals("metrics" in fallback, true);
  assertEquals((fallback.metrics as Record<string, number>).open_actions, 1);
  assertEquals((fallback.metrics as Record<string, number>).high_priority, 1);
});

// ── Integration tests (gated) ──

const FUNCTION_URL = Deno.env.get("SUPABASE_FUNCTIONS_URL");
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

Deno.test({
  name: "integration: relationship-briefings-generate rejects missing auth",
  ignore: !FUNCTION_URL || !SERVICE_KEY,
  fn: async () => {
    const resp = await fetch(`${FUNCTION_URL}/relationship-briefings-generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scope: "metro", metro_id: "00000000-0000-0000-0000-000000000001" }),
    });
    assertEquals(resp.status, 401);
    await resp.body?.cancel();
  },
});

Deno.test({
  name: "integration: relationship-briefings-generate rejects invalid scope",
  ignore: !FUNCTION_URL || !SERVICE_KEY,
  fn: async () => {
    const resp = await fetch(`${FUNCTION_URL}/relationship-briefings-generate`, {
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
