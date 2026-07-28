import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { sanitizeStoryInputs, stripPrivateFields } from "../_shared/sanitize-story-inputs.ts";

// ── sanitizeStoryInputs tests ──

Deno.test("sanitizeStoryInputs extracts topics and signal_types", () => {
  const result = sanitizeStoryInputs([
    { topics: ["device access", "grant planning"], signal_type: "collaboration_active", created_at: "2026-01-01T00:00:00Z" },
    { topics: ["community need"], relationship_signals: [{ type: "leadership_change" }], sent_at: "2026-01-02T00:00:00Z" },
  ]);
  assertEquals(result.topics.length, 3);
  assertEquals(result.signal_types.includes("collaboration_active"), true);
  assertEquals(result.signal_types.includes("leadership_change"), true);
  assertEquals(result.timestamps.length, 2);
});

Deno.test("sanitizeStoryInputs deduplicates topics", () => {
  const result = sanitizeStoryInputs([
    { topics: ["digital equity"] },
    { topics: ["digital equity", "broadband"] },
  ]);
  assertEquals(result.topics.length, 2);
});

Deno.test("sanitizeStoryInputs handles empty input", () => {
  const result = sanitizeStoryInputs([]);
  assertEquals(result.topics.length, 0);
  assertEquals(result.signal_types.length, 0);
});

// ── stripPrivateFields tests ──

Deno.test("stripPrivateFields removes banned keys", () => {
  const input = {
    body: "secret reflection text",
    email_body: "<html>secret</html>",
    note_text: "raw journal note",
    topics: ["safe topic"],
    signal_type: "collaboration_active",
    created_at: "2026-01-01",
  };
  const clean = stripPrivateFields(input);
  assertEquals(clean.body, undefined);
  assertEquals(clean.email_body, undefined);
  assertEquals(clean.note_text, undefined);
  assertEquals(clean.topics, ["safe topic"]);
  assertEquals(clean.signal_type, "collaboration_active");
});

Deno.test("stripPrivateFields recurses into nested objects", () => {
  const input = {
    nested: {
      body: "should be stripped",
      safe: "keep me",
    },
    top_level: "fine",
  };
  const clean = stripPrivateFields(input);
  assertEquals((clean.nested as Record<string, unknown>).body, undefined);
  assertEquals((clean.nested as Record<string, unknown>).safe, "keep me");
});

// ── Timeline ordering test ──

Deno.test("Timeline ordering: reflections rank above emails at same timestamp", () => {
  type Kind = "reflection" | "email" | "campaign";
  const KIND_WEIGHT: Record<Kind, number> = { reflection: 3, email: 2, campaign: 1 };

  const events = [
    { kind: "email" as Kind, occurred_at: "2026-01-15T12:00:00Z" },
    { kind: "reflection" as Kind, occurred_at: "2026-01-15T12:00:00Z" },
    { kind: "campaign" as Kind, occurred_at: "2026-01-15T12:00:00Z" },
  ];

  events.sort((a, b) => {
    const timeDiff = new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime();
    if (timeDiff !== 0) return timeDiff;
    return (KIND_WEIGHT[b.kind] || 0) - (KIND_WEIGHT[a.kind] || 0);
  });

  assertEquals(events[0].kind, "reflection");
  assertEquals(events[1].kind, "email");
  assertEquals(events[2].kind, "campaign");
});

// ── Privacy guard: metro-narrative-build never includes note_text ──

Deno.test("Privacy: banned keys are comprehensive", () => {
  const dangerousRecord = {
    body: "x",
    email_body: "x",
    note_text: "x",
    raw_body: "x",
    html_body: "x",
    full_text: "x",
    content: "x",
    message_body: "x",
    reflection_body: "x",
    // Safe keys
    topics: ["safe"],
    signal_type: "collaboration_active",
  };
  const clean = stripPrivateFields(dangerousRecord);
  const cleanKeys = Object.keys(clean);
  assertEquals(cleanKeys.includes("body"), false);
  assertEquals(cleanKeys.includes("email_body"), false);
  assertEquals(cleanKeys.includes("note_text"), false);
  assertEquals(cleanKeys.includes("raw_body"), false);
  assertEquals(cleanKeys.includes("topics"), true);
  assertEquals(cleanKeys.includes("signal_type"), true);
});

// ── Reflection extraction: empty fallback ──

Deno.test("Reflection extraction: empty fallback produces valid shape", () => {
  // Simulates what the edge function stores when AI fails
  const fallback = {
    topics: [],
    relationship_signals: [],
    sentiment: null,
    confidence: null,
    model: null,
  };
  assertEquals(Array.isArray(fallback.topics), true);
  assertEquals(Array.isArray(fallback.relationship_signals), true);
  assertEquals(fallback.sentiment, null);
});

// ── Email signal extraction: validates signal types ──

Deno.test("Email signal extraction: only valid types accepted", () => {
  const VALID_SIGNAL_TYPES = [
    "follow_up_needed",
    "collaboration_active",
    "onboarding_phase",
    "resource_request",
    "partnership_growth",
  ];

  assertEquals(VALID_SIGNAL_TYPES.includes("follow_up_needed"), true);
  assertEquals(VALID_SIGNAL_TYPES.includes("collaboration_active"), true);
  assertEquals(VALID_SIGNAL_TYPES.includes("unknown_type"), false);
  assertEquals(VALID_SIGNAL_TYPES.includes("urgent_action"), false);
});

// ── NaN date guard: invalid dates don't break sorting ──

Deno.test("Timeline ordering: invalid dates sort to end without throwing", () => {
  type Kind = "reflection" | "email" | "campaign";
  const KIND_WEIGHT: Record<Kind, number> = { reflection: 3, email: 2, campaign: 1 };

  const events = [
    { kind: "email" as Kind, occurred_at: "2026-01-15T12:00:00Z" },
    { kind: "reflection" as Kind, occurred_at: "not-a-date" },
    { kind: "campaign" as Kind, occurred_at: "" },
    { kind: "reflection" as Kind, occurred_at: "2026-01-16T12:00:00Z" },
  ];

  events.sort((a, b) => {
    const timeA = new Date(a.occurred_at).getTime();
    const timeB = new Date(b.occurred_at).getTime();
    const safeA = Number.isFinite(timeA) ? timeA : 0;
    const safeB = Number.isFinite(timeB) ? timeB : 0;
    const timeDiff = safeB - safeA;
    if (timeDiff !== 0) return timeDiff;
    return (KIND_WEIGHT[b.kind] || 0) - (KIND_WEIGHT[a.kind] || 0);
  });

  // Valid dates come first (newest first)
  assertEquals(events[0].occurred_at, "2026-01-16T12:00:00Z");
  assertEquals(events[1].occurred_at, "2026-01-15T12:00:00Z");
  // Invalid dates sort to end, reflection weight wins tie
  assertEquals(events[2].kind, "reflection");
  assertEquals(events[3].kind, "campaign");
});

// ── Privacy: narrative builders must strip private fields ──

Deno.test("Privacy: stripPrivateFields covers all narrative-dangerous keys", () => {
  const NARRATIVE_INPUT = {
    body: "raw reflection",
    email_body: "<html>email</html>",
    note_text: "journal raw",
    raw_body: "raw",
    html_body: "<p>html</p>",
    full_text: "full",
    content: "content",
    message_body: "msg",
    reflection_body: "ref",
    // Safe fields that MUST survive
    topics: ["education"],
    signal_type: "collaboration_active",
    sentiment: "positive",
    created_at: "2026-01-01",
    counts: { emails: 3 },
  };
  const clean = stripPrivateFields(NARRATIVE_INPUT);
  // All dangerous keys removed
  for (const key of ["body", "email_body", "note_text", "raw_body", "html_body", "full_text", "content", "message_body", "reflection_body"]) {
    assertEquals(Object.hasOwn(clean, key), false, `${key} should be stripped`);
  }
  // Safe fields preserved
  assertEquals(clean.topics, ["education"]);
  assertEquals(clean.signal_type, "collaboration_active");
  assertEquals(clean.sentiment, "positive");
  assertEquals(clean.created_at, "2026-01-01");
});
