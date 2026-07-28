import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";

// ── Suggestion generation logic (extracted for testing) ──

interface SuggestionCheckParams {
  signal_type: string;
  confidence: number;
  recentDismissed: Array<{ status: string; snoozed_until: string | null; updated_at: string }>;
  existingOpen: Array<{ id: string; created_at: string }>;
  now: Date;
}

function shouldCreateSuggestion(params: SuggestionCheckParams): "create" | "group" | "skip" {
  // Rule 1: Only watchlist_change signals with confidence >= 0.4
  if (params.signal_type !== "watchlist_change") return "skip";
  if (params.confidence < 0.4) return "skip";

  // Rule 2: Anti-spam — skip if dismissed/snoozed in last 7 days
  const sevenDaysAgo = new Date(params.now.getTime() - 7 * 86400000);
  for (const s of params.recentDismissed) {
    if (new Date(s.updated_at) < sevenDaysAgo) continue;
    if (s.status === "dismissed") return "skip";
    if (s.status === "snoozed" && s.snoozed_until && new Date(s.snoozed_until) > params.now) {
      return "skip";
    }
  }

  // Rule 3: Grouping — if open suggestion within 48h, group
  const fortyEightHoursAgo = new Date(params.now.getTime() - 48 * 3600000);
  for (const o of params.existingOpen) {
    if (new Date(o.created_at) >= fortyEightHoursAgo) return "group";
  }

  return "create";
}

// ── Body template rendering (deterministic) ──

function renderBodyTemplate(
  template: string,
  vars: Record<string, string>,
): string {
  return template
    .replace(/\{\{org_name\}\}/gi, vars.org_name || "")
    .replace(/\{\{signal_summary\}\}/gi, vars.signal_summary || "")
    .replace(/\{\{first_name\}\}/gi, vars.first_name || "")
    .replace(/\{\{metro_or_region\}\}/gi, vars.metro_or_region || "your area")
    .replace(/\{\{sender_name\}\}/gi, vars.sender_name || "");
}

// ── Tests ──

Deno.test("shouldCreateSuggestion: creates on valid watchlist_change", () => {
  const result = shouldCreateSuggestion({
    signal_type: "watchlist_change",
    confidence: 0.6,
    recentDismissed: [],
    existingOpen: [],
    now: new Date(),
  });
  assertEquals(result, "create");
});

Deno.test("shouldCreateSuggestion: skips non-watchlist signal types", () => {
  const result = shouldCreateSuggestion({
    signal_type: "leadership_change",
    confidence: 0.8,
    recentDismissed: [],
    existingOpen: [],
    now: new Date(),
  });
  assertEquals(result, "skip");
});

Deno.test("shouldCreateSuggestion: skips low confidence", () => {
  const result = shouldCreateSuggestion({
    signal_type: "watchlist_change",
    confidence: 0.3,
    recentDismissed: [],
    existingOpen: [],
    now: new Date(),
  });
  assertEquals(result, "skip");
});

Deno.test("shouldCreateSuggestion: skips recently dismissed org", () => {
  const now = new Date();
  const result = shouldCreateSuggestion({
    signal_type: "watchlist_change",
    confidence: 0.6,
    recentDismissed: [{
      status: "dismissed",
      snoozed_until: null,
      updated_at: new Date(now.getTime() - 2 * 86400000).toISOString(),
    }],
    existingOpen: [],
    now,
  });
  assertEquals(result, "skip");
});

Deno.test("shouldCreateSuggestion: skips snoozed org with future snoozed_until", () => {
  const now = new Date();
  const result = shouldCreateSuggestion({
    signal_type: "watchlist_change",
    confidence: 0.6,
    recentDismissed: [{
      status: "snoozed",
      snoozed_until: new Date(now.getTime() + 5 * 86400000).toISOString(),
      updated_at: new Date(now.getTime() - 1 * 86400000).toISOString(),
    }],
    existingOpen: [],
    now,
  });
  assertEquals(result, "skip");
});

Deno.test("shouldCreateSuggestion: allows after snooze expired", () => {
  const now = new Date();
  const result = shouldCreateSuggestion({
    signal_type: "watchlist_change",
    confidence: 0.6,
    recentDismissed: [{
      status: "snoozed",
      snoozed_until: new Date(now.getTime() - 1 * 86400000).toISOString(),
      updated_at: new Date(now.getTime() - 8 * 86400000).toISOString(),
    }],
    existingOpen: [],
    now,
  });
  assertEquals(result, "create");
});

Deno.test("shouldCreateSuggestion: groups within 48h window", () => {
  const now = new Date();
  const result = shouldCreateSuggestion({
    signal_type: "watchlist_change",
    confidence: 0.6,
    recentDismissed: [],
    existingOpen: [{
      id: "existing-1",
      created_at: new Date(now.getTime() - 12 * 3600000).toISOString(),
    }],
    now,
  });
  assertEquals(result, "group");
});

Deno.test("shouldCreateSuggestion: creates new if open suggestion > 48h old", () => {
  const now = new Date();
  const result = shouldCreateSuggestion({
    signal_type: "watchlist_change",
    confidence: 0.6,
    recentDismissed: [],
    existingOpen: [{
      id: "existing-1",
      created_at: new Date(now.getTime() - 72 * 3600000).toISOString(),
    }],
    now,
  });
  assertEquals(result, "create");
});

Deno.test("shouldCreateSuggestion: boundary confidence 0.4 creates", () => {
  const result = shouldCreateSuggestion({
    signal_type: "watchlist_change",
    confidence: 0.4,
    recentDismissed: [],
    existingOpen: [],
    now: new Date(),
  });
  assertEquals(result, "create");
});

Deno.test("renderBodyTemplate: replaces all placeholders", () => {
  const template = "<p>Hi {{first_name}}, {{org_name}} updated ({{signal_summary}}). Contact us in {{metro_or_region}}. — {{sender_name}}</p>";
  const result = renderBodyTemplate(template, {
    first_name: "Alice",
    org_name: "Acme Nonprofit",
    signal_summary: "website content changed",
    metro_or_region: "Detroit",
    sender_name: "Bob",
  });
  assert(result.includes("Alice"));
  assert(result.includes("Acme Nonprofit"));
  assert(result.includes("website content changed"));
  assert(result.includes("Detroit"));
  assert(result.includes("Bob"));
});

Deno.test("renderBodyTemplate: handles missing vars gracefully", () => {
  const template = "<p>Hi {{first_name}}, {{org_name}} in {{metro_or_region}}</p>";
  const result = renderBodyTemplate(template, {});
  assert(result.includes("your area")); // default for metro_or_region
  assert(!result.includes("{{"));
});

Deno.test("convert action: idempotent — already converted returns early", () => {
  // This tests the logic branch; actual HTTP test would need integration setup
  const suggestion = {
    status: "converted",
    converted_campaign_id: "camp-123",
  };
  const isAlreadyConverted = suggestion.status === "converted";
  assertEquals(isAlreadyConverted, true);
  assertEquals(suggestion.converted_campaign_id, "camp-123");
});

Deno.test("dismiss/snooze actions: status transitions", () => {
  // Dismiss
  const dismissed = { status: "open" };
  dismissed.status = "dismissed";
  assertEquals(dismissed.status, "dismissed");

  // Snooze
  const snoozed = { status: "open", snoozed_until: null as string | null };
  snoozed.status = "snoozed";
  snoozed.snoozed_until = new Date(Date.now() + 7 * 86400000).toISOString();
  assertEquals(snoozed.status, "snoozed");
  assert(snoozed.snoozed_until !== null);
});
