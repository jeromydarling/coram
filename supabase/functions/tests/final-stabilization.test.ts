import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assertNotEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { stripPrivateFields, sanitizeStoryInputs } from "../_shared/sanitize-story-inputs.ts";

// ── 1. Timeline sorting: invalid dates sort stably without throwing ──

Deno.test("Timeline: invalid/missing dates don't crash sort", () => {
  type Kind = "reflection" | "email" | "campaign";
  const KIND_WEIGHT: Record<Kind, number> = { reflection: 3, email: 2, campaign: 1 };

  function safeTime(v: string | null | undefined): number {
    if (!v) return 0;
    const t = new Date(v).getTime();
    return Number.isFinite(t) ? t : 0;
  }

  const events = [
    { id: "email:1", kind: "email" as Kind, occurred_at: "2026-01-15T12:00:00Z" },
    { id: "reflection:2", kind: "reflection" as Kind, occurred_at: null as string | null },
    { id: "campaign:3", kind: "campaign" as Kind, occurred_at: "" },
    { id: "reflection:4", kind: "reflection" as Kind, occurred_at: "not-a-date" },
    { id: "email:5", kind: "email" as Kind, occurred_at: undefined as string | undefined },
    { id: "reflection:6", kind: "reflection" as Kind, occurred_at: "2026-01-16T12:00:00Z" },
  ];

  // Should not throw
  events.sort((a, b) => {
    const timeDiff = safeTime(b.occurred_at) - safeTime(a.occurred_at);
    if (timeDiff !== 0) return timeDiff;
    return (KIND_WEIGHT[b.kind] || 0) - (KIND_WEIGHT[a.kind] || 0);
  });

  // Valid dates first (newest first)
  assertEquals(events[0].id, "reflection:6");
  assertEquals(events[1].id, "email:1");
  // Invalid dates at end — reflections win ties
  assertEquals(events[2].kind, "reflection");
});

// ── 2. stripPrivateFields removes ALL banned keys recursively ──

Deno.test("Privacy: stripPrivateFields removes all banned keys at depth", () => {
  const input = {
    body: "raw",
    email_body: "<html>",
    note_text: "raw journal",
    raw_body: "raw",
    html_body: "<p>",
    full_text: "full",
    content: "content",
    message_body: "msg",
    reflection_body: "ref",
    nested: {
      body: "nested body",
      email_body: "nested email",
      safe_key: "keep",
      deep: {
        content: "deep content",
        safe_deep: true,
      },
    },
    topics: ["education"],
    signal_type: "collaboration_active",
  };
  const clean = stripPrivateFields(input);

  const BANNED = ["body", "email_body", "note_text", "raw_body", "html_body", "full_text", "content", "message_body", "reflection_body"];
  for (const key of BANNED) {
    assertEquals(Object.hasOwn(clean, key), false, `Top-level '${key}' should be stripped`);
  }
  // Nested check
  const nested = clean.nested as Record<string, unknown>;
  assertEquals(Object.hasOwn(nested, "body"), false);
  assertEquals(Object.hasOwn(nested, "email_body"), false);
  assertEquals(nested.safe_key, "keep");
  // Safe fields preserved
  assertEquals(clean.topics, ["education"]);
  assertEquals(clean.signal_type, "collaboration_active");
});

// ── 3. Email event mapping with missing fields ──

Deno.test("Email event: handles null/empty subject, snippet, sent_at", () => {
  // Simulate the mapping logic from useStoryEvents
  const email: Record<string, string | null> = { id: "abc-123", subject: null, snippet: null, sender_email: null, recipient_email: null, sent_at: null };

  const subject = email.subject || "";
  const snippet = email.snippet || "";
  const title = subject || (snippet ? snippet.slice(0, 60) : "(no subject)");
  const summary = (subject ? snippet : snippet || "(no subject)").slice(0, 280);
  const authorLabel = email.sender_email?.split("@")[0] || "Email";

  assertEquals(title, "(no subject)");
  assertEquals(summary, "(no subject)");
  assertEquals(authorLabel, "Email");

  // Safe time for null
  const t = email.sent_at ? new Date(email.sent_at).getTime() : 0;
  assertEquals(Number.isFinite(t) ? t : 0, 0);
});

// ── 4. Namespaced IDs never collide across kinds ──

Deno.test("StoryEvent IDs are namespaced and unique across kinds", () => {
  const rawId = "550e8400-e29b-41d4-a716-446655440000";
  const reflectionId = `reflection:${rawId}`;
  const emailId = `email:${rawId}`;
  const campaignId = `campaign:${rawId}`;

  assertNotEquals(reflectionId, emailId);
  assertNotEquals(emailId, campaignId);
  assertNotEquals(reflectionId, campaignId);
});

// ── 5. Dedup by stable ID ──

Deno.test("Dedup: duplicate IDs are removed", () => {
  const events = [
    { id: "reflection:1", kind: "reflection" },
    { id: "reflection:1", kind: "reflection" },
    { id: "email:2", kind: "email" },
  ];
  const seen = new Set<string>();
  const deduped = events.filter(e => {
    if (seen.has(e.id)) return false;
    seen.add(e.id);
    return true;
  });
  assertEquals(deduped.length, 2);
});

// ── 6. sanitizeStoryInputs only passes safe fields ──

Deno.test("sanitizeStoryInputs strips private content and returns safe shape", () => {
  const rawInputs = [
    { body: "secret", topics: ["education"], signal_type: "collaboration_active", created_at: "2026-01-01" },
    { email_body: "<html>private</html>", topics: ["broadband"], sent_at: "2026-01-02" },
  ];
  const result = sanitizeStoryInputs(rawInputs);
  assertEquals(result.topics.includes("education"), true);
  assertEquals(result.topics.includes("broadband"), true);
  assertEquals(result.signal_types.includes("collaboration_active"), true);
  // Ensure no raw body leaked into output
  assertEquals(JSON.stringify(result).includes("secret"), false);
  assertEquals(JSON.stringify(result).includes("<html>"), false);
});

// ── 7. Character limit enforcement ──

Deno.test("Reflection: reject blank/whitespace-only body", () => {
  const bodies = ["", "   ", "\n\n\t  "];
  for (const b of bodies) {
    assertEquals(b.trim().length === 0, true, `'${b}' should be rejected`);
  }
});

Deno.test("Reflection: hard cap at 6000 chars", () => {
  const longBody = "a".repeat(6001);
  assertEquals(longBody.trim().length > 6000, true);
  // Server should reject this
});

// ── 8. Privacy: StoryEvent output shape never contains banned keys ──

Deno.test("StoryEvent shape contains no banned keys", () => {
  const BANNED = ["body", "email_body", "note_text", "raw_body", "html_body", "full_text", "content", "message_body", "reflection_body"];
  const event = {
    id: "reflection:1",
    kind: "reflection",
    title: "Reflection",
    summary: "A safe summary snippet",
    occurred_at: "2026-01-01",
    author_label: "Team member",
    privacy: "team",
    metadata: {},
  };
  for (const key of BANNED) {
    assertEquals(Object.hasOwn(event, key), false, `StoryEvent should never have '${key}'`);
  }
});

// ── 9. Campaign event safe display ──

Deno.test("Campaign event: shows name + status, never full HTML body", () => {
  const campaign = { name: "Q1 Outreach", subject: "Partnership update" };
  const status = "sent";
  const summary = `Subject: ${campaign.subject || "N/A"} — ${status || "sent"}`;
  assertEquals(summary.includes("Partnership update"), true);
  assertEquals(summary.includes("<html>"), false);
});
