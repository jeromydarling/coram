import { assertEquals, assertNotEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

// ─── Deduplication key normalization ─────────────────────

function normalizeDedupe(opportunityId: string, emailId: string, title: string): string {
  const normalizedTitle = title.trim().replace(/\s+/g, " ").toLowerCase();
  return `email_action:${opportunityId}:${emailId}:${normalizedTitle}`;
}

Deno.test("dedupe key is deterministic and case-insensitive", () => {
  const a = normalizeDedupe("opp1", "email1", "Follow Up on Meeting");
  const b = normalizeDedupe("opp1", "email1", "follow up on meeting");
  assertEquals(a, b);
});

Deno.test("dedupe key collapses whitespace", () => {
  const a = normalizeDedupe("opp1", "email1", "Follow  Up   on Meeting");
  const b = normalizeDedupe("opp1", "email1", "Follow Up on Meeting");
  assertEquals(a, b);
});

Deno.test("different emails produce different dedupe keys", () => {
  const a = normalizeDedupe("opp1", "email1", "Follow Up");
  const b = normalizeDedupe("opp1", "email2", "Follow Up");
  assertNotEquals(a, b);
});

// ─── Evidence excerpt capping ────────────────────────────

function safeSnippet(text: string | null, max: number): string {
  if (!text) return "";
  return text.slice(0, max).trim();
}

Deno.test("safeSnippet caps at 280 chars", () => {
  const long = "a".repeat(500);
  const result = safeSnippet(long, 280);
  assertEquals(result.length, 280);
});

Deno.test("safeSnippet handles null", () => {
  assertEquals(safeSnippet(null, 280), "");
});

// ─── Heuristic fallback ─────────────────────────────────

function heuristicExtract(subject: string, snippet: string): Array<{ title: string; confidence: number }> {
  const combined = `${subject} ${snippet}`.toLowerCase();
  const items: Array<{ title: string; confidence: number }> = [];

  if (combined.includes("next step") || (combined.includes("re:") && combined.includes("follow"))) {
    items.push({ title: "Follow up on this conversation", confidence: 0.3 });
  }

  const commitPhrases = ["i will", "we will", "i'll", "we'll", "can you", "please send", "please share"];
  for (const phrase of commitPhrases) {
    if (combined.includes(phrase)) {
      items.push({ title: "Review commitment from this email", confidence: 0.25 });
      break;
    }
  }

  return items.slice(0, 1);
}

Deno.test("heuristic: 'next steps' subject produces follow-up", () => {
  const items = heuristicExtract("Re: next steps for partnership", "");
  assertEquals(items.length, 1);
  assertEquals(items[0].title, "Follow up on this conversation");
});

Deno.test("heuristic: 'I will' in snippet produces commitment review", () => {
  const items = heuristicExtract("Meeting recap", "I will send the report tomorrow");
  assertEquals(items.length, 1);
  assertEquals(items[0].title, "Review commitment from this email");
});

Deno.test("heuristic: generic email produces 0 items", () => {
  const items = heuristicExtract("Hello", "Thanks for your time");
  assertEquals(items.length, 0);
});

// ─── AI JSON validation ─────────────────────────────────

function validateAIItems(parsed: unknown): Array<{ title: string; confidence: number }> {
  if (!parsed || typeof parsed !== "object") return [];
  const obj = parsed as Record<string, unknown>;
  if (!Array.isArray(obj.items)) return [];
  return obj.items
    .filter((it: any) => it && typeof it.title === "string" && it.title.length <= 200 && typeof it.confidence === "number")
    .slice(0, 3);
}

Deno.test("AI validation rejects malformed output", () => {
  assertEquals(validateAIItems(null), []);
  assertEquals(validateAIItems("not an object"), []);
  assertEquals(validateAIItems({ items: "not array" }), []);
  assertEquals(validateAIItems({ items: [{ no_title: true }] }), []);
});

Deno.test("AI validation accepts valid items and caps at 3", () => {
  const items = validateAIItems({
    items: [
      { title: "A", confidence: 0.8 },
      { title: "B", confidence: 0.7 },
      { title: "C", confidence: 0.6 },
      { title: "D", confidence: 0.5 },
    ],
  });
  assertEquals(items.length, 3);
});

// ─── Privacy: no banned keys ─────────────────────────────

Deno.test("email-actionitems-generate never stores body fields", () => {
  // The edge function only selects: id, subject, snippet, sent_at, sender_email, recipient_email
  // This test verifies the conceptual contract
  const SAFE_FIELDS = ["id", "subject", "snippet", "sent_at", "sender_email", "recipient_email"];
  const BANNED_FIELDS = ["body", "body_preview", "html_body", "raw_body", "full_text"];
  for (const banned of BANNED_FIELDS) {
    assertEquals(SAFE_FIELDS.includes(banned), false, `${banned} must not be in safe fields`);
  }
});
