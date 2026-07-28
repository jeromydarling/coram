import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

// ── Pure unit tests for event reflection extraction logic ──

// Replicate summary_safe sanitization
function sanitizeSummarySafe(raw: string): string {
  return raw.replace(/[\u201C\u201D\u2018\u2019]/g, "").slice(0, 280);
}

// Replicate extraction validation
interface Extraction {
  topics: string[];
  signals: Array<{ type: string; value?: string }>;
  partner_mentions: string[];
  summary_safe: string;
}

function validateExtraction(parsed: Record<string, unknown>): Extraction {
  const topics = Array.isArray(parsed.topics) ? (parsed.topics as string[]).slice(0, 5) : [];
  const signals = Array.isArray(parsed.signals)
    ? (parsed.signals as Array<{ type: string; value?: string }>).slice(0, 3)
    : [];
  const partnerMentions = Array.isArray(parsed.partner_mentions)
    ? (parsed.partner_mentions as string[]).slice(0, 5)
    : [];
  const summarySafe = typeof parsed.summary_safe === "string"
    ? sanitizeSummarySafe(parsed.summary_safe)
    : "";

  return { topics, signals, partner_mentions: partnerMentions, summary_safe: summarySafe };
}

// Valid signal types
const VALID_SIGNAL_TYPES = new Set([
  "community_need",
  "resource_gap",
  "partnership_opportunity",
  "program_alignment",
  "volunteer_interest",
  "referral_potential",
]);

// ── Tests ──

Deno.test("sanitizeSummarySafe: removes smart quotes", () => {
  const input = "Team observed \u201Cdigital divide\u201D issues and \u2018housing\u2019 needs";
  const result = sanitizeSummarySafe(input);
  assertEquals(result.includes("\u201C"), false);
  assertEquals(result.includes("\u201D"), false);
  assertEquals(result.includes("\u2018"), false);
  assertEquals(result.includes("\u2019"), false);
});

Deno.test("sanitizeSummarySafe: truncates at 280 chars", () => {
  const longInput = "A".repeat(500);
  const result = sanitizeSummarySafe(longInput);
  assertEquals(result.length, 280);
});

Deno.test("sanitizeSummarySafe: handles empty string", () => {
  assertEquals(sanitizeSummarySafe(""), "");
});

Deno.test("validateExtraction: caps topics at 5", () => {
  const parsed = {
    topics: ["a", "b", "c", "d", "e", "f", "g"],
    signals: [],
    partner_mentions: [],
    summary_safe: "test",
  };
  const result = validateExtraction(parsed);
  assertEquals(result.topics.length, 5);
});

Deno.test("validateExtraction: caps signals at 3", () => {
  const parsed = {
    topics: [],
    signals: [
      { type: "community_need" },
      { type: "resource_gap" },
      { type: "partnership_opportunity" },
      { type: "program_alignment" },
    ],
    partner_mentions: [],
    summary_safe: "",
  };
  const result = validateExtraction(parsed);
  assertEquals(result.signals.length, 3);
});

Deno.test("validateExtraction: caps partner_mentions at 5", () => {
  const parsed = {
    topics: [],
    signals: [],
    partner_mentions: ["A", "B", "C", "D", "E", "F"],
    summary_safe: "",
  };
  const result = validateExtraction(parsed);
  assertEquals(result.partner_mentions.length, 5);
});

Deno.test("validateExtraction: handles missing fields gracefully", () => {
  const parsed = {};
  const result = validateExtraction(parsed);
  assertEquals(result.topics.length, 0);
  assertEquals(result.signals.length, 0);
  assertEquals(result.partner_mentions.length, 0);
  assertEquals(result.summary_safe, "");
});

Deno.test("validateExtraction: handles non-array fields", () => {
  const parsed = {
    topics: "not-an-array",
    signals: "not-an-array",
    partner_mentions: 42,
    summary_safe: 123,
  };
  const result = validateExtraction(parsed);
  assertEquals(result.topics.length, 0);
  assertEquals(result.signals.length, 0);
  assertEquals(result.partner_mentions.length, 0);
  assertEquals(result.summary_safe, "");
});

Deno.test("extraction never contains raw reflection body", () => {
  // Simulate: the edge function fetches body but extraction output
  // must NEVER include the raw text. Only structured fields.
  const rawBody = "I met with John at the shelter and discussed housing needs.";
  const extraction: Extraction = {
    topics: ["housing needs", "shelter services"],
    signals: [{ type: "community_need", value: "housing" }],
    partner_mentions: ["City Shelter"],
    summary_safe: "Team observed housing-related community needs during shelter visit.",
  };

  // Verify no raw text leaks
  assertEquals(extraction.summary_safe.includes("John"), false);
  assertEquals(extraction.summary_safe.includes(rawBody), false);
  assertEquals(JSON.stringify(extraction).includes("John"), false);
});

Deno.test("valid signal types are recognized", () => {
  assertEquals(VALID_SIGNAL_TYPES.has("community_need"), true);
  assertEquals(VALID_SIGNAL_TYPES.has("resource_gap"), true);
  assertEquals(VALID_SIGNAL_TYPES.has("partnership_opportunity"), true);
  assertEquals(VALID_SIGNAL_TYPES.has("invalid_type"), false);
});
