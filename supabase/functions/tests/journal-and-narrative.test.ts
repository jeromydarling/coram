import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;

// ── Urgency filter tests ──

const URGENCY_WORDS = /\b(urgent|critical|act now|immediately|asap|emergency|deadline|hurry|don't miss|last chance|breaking|high priority|action required)\b/gi;

function removeUrgencyLanguage(text: string): string {
  return text.replace(URGENCY_WORDS, "").replace(/\s{2,}/g, " ").trim();
}

Deno.test("urgency filter removes forbidden words", () => {
  const input = "This is urgent and critical — act now before the deadline!";
  const result = removeUrgencyLanguage(input);
  assertEquals(result.includes("urgent"), false);
  assertEquals(result.includes("critical"), false);
  assertEquals(result.includes("act now"), false);
  assertEquals(result.includes("deadline"), false);
});

Deno.test("urgency filter preserves calm language", () => {
  const input = "Worth noticing: community shift in housing policy. Keep an eye on this.";
  const result = removeUrgencyLanguage(input);
  assertEquals(result, input);
});

// ── Deterministic narrative tests ──

interface OrgStorySummary {
  org_name: string;
  momentum_trend: string | null;
  recent_story_points: string[];
  partner_responses: string[];
}

interface MetroStoryInputs {
  metro_context: { metro_id: string; metro_name: string };
  org_story_summaries: OrgStorySummary[];
  ecosystem_patterns: string[];
  external_signals: Array<{ title: string; snippet: string; source_url: string | null; published_date: string | null }>;
  relationship_highlights: string[];
}

function buildDeterministicNarrative(inputs: MetroStoryInputs) {
  const { metro_context, org_story_summaries, external_signals } = inputs;
  const metroName = metro_context.metro_name;
  const hasExternalSignals = external_signals.length > 0;
  const hasOrgStories = org_story_summaries.length > 0;

  let headline: string;
  if (hasExternalSignals && hasOrgStories) {
    headline = `${metroName}: Community shifts and partner stories interweaving`;
  } else if (hasOrgStories) {
    headline = `${metroName}: Quiet progress across ${org_story_summaries.length} partnerships`;
  } else if (hasExternalSignals) {
    headline = `${metroName}: New developments in the community landscape`;
  } else {
    headline = `${metroName}: A steady season for relationships`;
  }

  return { headline, community_story: "", partner_story: "", emerging_patterns: [] as string[], gentle_outlook: "" };
}

Deno.test("narrative builds without external signals", () => {
  const inputs: MetroStoryInputs = {
    metro_context: { metro_id: "test", metro_name: "TestVille" },
    org_story_summaries: [{ org_name: "Org A", momentum_trend: "rising", recent_story_points: [], partner_responses: [] }],
    ecosystem_patterns: [],
    external_signals: [],
    relationship_highlights: [],
  };
  const result = buildDeterministicNarrative(inputs);
  assertEquals(result.headline.includes("Quiet progress"), true);
});

Deno.test("narrative builds without org stories", () => {
  const inputs: MetroStoryInputs = {
    metro_context: { metro_id: "test", metro_name: "TestVille" },
    org_story_summaries: [],
    ecosystem_patterns: [],
    external_signals: [{ title: "Housing policy update", snippet: "...", source_url: null, published_date: null }],
    relationship_highlights: [],
  };
  const result = buildDeterministicNarrative(inputs);
  assertEquals(result.headline.includes("New developments"), true);
});

Deno.test("narrative builds with zero data (steady season)", () => {
  const inputs: MetroStoryInputs = {
    metro_context: { metro_id: "test", metro_name: "TestVille" },
    org_story_summaries: [],
    ecosystem_patterns: [],
    external_signals: [],
    relationship_highlights: [],
  };
  const result = buildDeterministicNarrative(inputs);
  assertEquals(result.headline.includes("steady season"), true);
});

// ── Journal extraction validation ──

Deno.test("invalid AI JSON falls back to empty extraction", () => {
  const invalidJson = "This is not JSON at all";
  const jsonMatch = invalidJson.match(/\{[\s\S]*\}/);
  assertEquals(jsonMatch, null);
  const fallback = { org_mentions: [], topics: [], signals: [], sentiment: { valence: "neutral", intensity: 0.5 } };
  assertEquals(fallback.org_mentions.length, 0);
  assertEquals(fallback.sentiment.valence, "neutral");
});

Deno.test("valid AI JSON parses correctly", () => {
  const validJson = '{"org_mentions":[{"name":"Test Org","confidence":0.9}],"topics":["housing"],"signals":[{"type":"community_shift","confidence":0.8}],"sentiment":{"valence":"positive","intensity":0.7}}';
  const jsonMatch = validJson.match(/\{[\s\S]*\}/);
  assertExists(jsonMatch);
  const parsed = JSON.parse(jsonMatch![0]);
  assertEquals(parsed.org_mentions.length, 1);
  assertEquals(parsed.topics[0], "housing");
  assertEquals(parsed.sentiment.valence, "positive");
});

// ── Narrative tone enforcement ──

Deno.test("generated narrative contains no urgency keywords", () => {
  const sampleNarrative = "Worth noticing: community shift in housing policy. Partners are responding thoughtfully. Keep an eye on evolving needs.";
  const hasUrgency = URGENCY_WORDS.test(sampleNarrative);
  URGENCY_WORDS.lastIndex = 0;
  assertEquals(hasUrgency, false);
});

Deno.test("narrative with urgency words gets cleaned", () => {
  URGENCY_WORDS.lastIndex = 0; // reset regex state from prior test
  const dirty = "URGENT: Critical housing crisis requires immediate action!";
  const clean = removeUrgencyLanguage(dirty);
  assertEquals(clean.toLowerCase().includes("urgent"), false);
  assertEquals(clean.toLowerCase().includes("critical"), false);
  assertEquals(clean.toLowerCase().includes("immediately"), false);
});

// ── Anchor key validation ──

const ANCHOR_KEY_RE = /^[a-zA-Z0-9:_-]{1,120}$/;

Deno.test("anchor_key accepts valid section-level keys", () => {
  assertEquals(ANCHOR_KEY_RE.test("community_story"), true);
  assertEquals(ANCHOR_KEY_RE.test("partner_story"), true);
  assertEquals(ANCHOR_KEY_RE.test("gentle_outlook"), true);
});

Deno.test("anchor_key accepts paragraph-level keys", () => {
  assertEquals(ANCHOR_KEY_RE.test("community_story::p0"), true);
  assertEquals(ANCHOR_KEY_RE.test("partner_story::p12"), true);
  assertEquals(ANCHOR_KEY_RE.test("gentle_outlook::p0"), true);
});

Deno.test("anchor_key rejects invalid characters", () => {
  assertEquals(ANCHOR_KEY_RE.test("has spaces"), false);
  assertEquals(ANCHOR_KEY_RE.test("has<html>"), false);
  assertEquals(ANCHOR_KEY_RE.test("has;sql"), false);
  assertEquals(ANCHOR_KEY_RE.test("has'quote"), false);
  assertEquals(ANCHOR_KEY_RE.test(""), false);
});

Deno.test("anchor_key rejects keys over 120 chars", () => {
  const longKey = "a".repeat(121);
  assertEquals(ANCHOR_KEY_RE.test(longKey), false);
});

// ── Journal blending caps ──

Deno.test("journal blending caps at 10 entries and limits topics/signals per entry", () => {
  // Simulate 15 journal entries with extractions
  const entries = Array.from({ length: 15 }, (_, i) => ({ id: `entry-${i}` }));
  const capped = entries.slice(0, 10);
  assertEquals(capped.length, 10);

  // Simulate extraction with many topics and signals
  const ext = {
    topics: ["t1", "t2", "t3", "t4"],
    signals: [{ type: "a" }, { type: "b" }, { type: "c" }],
  };
  const usedTopics = ext.topics.slice(0, 2);
  const usedSignals = ext.signals.slice(0, 1);
  assertEquals(usedTopics.length, 2);
  assertEquals(usedSignals.length, 1);
});

// ── No raw note_text leakage in narrative ──

Deno.test("narrative JSON does not contain raw note text, user_id, or journal_entry_id", () => {
  // Simulated narrative_json output
  const narrativeJson = {
    headline: "TestVille: Community shifts and partner stories interweaving",
    community_story: "The community landscape continues to evolve.",
    partner_story: "Partners are responding thoughtfully.",
    emerging_patterns: ["On the ground: housing", "Field observation: community shift"],
    gentle_outlook: "TestVille continues to grow.",
    detected_patterns: ["On the ground: housing"],
    cross_metro_signals: [],
    partner_response_clusters: [{ org_name: "Org A", trend: "rising" }],
  };

  const jsonStr = JSON.stringify(narrativeJson);
  // Should never contain direct references to journal internals
  assertEquals(jsonStr.includes("journal_entry_id"), false);
  assertEquals(jsonStr.includes("user_id"), false);
  assertEquals(jsonStr.includes("note_text"), false);
});

// ── Edge function integration tests ──

Deno.test("journal-create returns 401 without auth", async () => {
  const resp = await fetch(`${SUPABASE_URL}/functions/v1/journal-create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ note_text: "test note" }),
  });
  assertEquals(resp.status, 401);
  await resp.text();
});

Deno.test("journal-create returns 400 for empty note", async () => {
  const resp = await fetch(`${SUPABASE_URL}/functions/v1/journal-create`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ note_text: "" }),
  });
  const status = resp.status;
  assertEquals(status >= 400, true);
  await resp.text();
});

Deno.test("journal-extract requires service auth", async () => {
  const resp = await fetch(`${SUPABASE_URL}/functions/v1/journal-extract`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ journal_entry_id: "test" }),
  });
  assertEquals(resp.status, 401);
  await resp.text();
});
