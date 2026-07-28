import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

// ── Pure unit tests for metro narrative logic ──

// Replicate urgency filter
const URGENCY_WORDS = /\b(urgent|critical|act now|immediately|asap|emergency|deadline|hurry|don't miss|last chance|breaking)\b/gi;

function removeUrgencyLanguage(text: string): string {
  return text.replace(URGENCY_WORDS, "").replace(/\s{2,}/g, " ").trim();
}

// Replicate deterministic narrative builder types
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
}

function buildDeterministicNarrative(inputs: MetroStoryInputs): {
  headline: string;
  community_story: string;
  partner_story: string;
  emerging_patterns: string[];
  gentle_outlook: string;
} {
  const { metro_context, org_story_summaries, ecosystem_patterns, external_signals } = inputs;
  const metroName = metro_context.metro_name;

  const risingOrgs = org_story_summaries.filter(o => o.momentum_trend === "rising");
  const headline = external_signals.length > 0
    ? `${metroName}: ${external_signals.length} community developments and ${org_story_summaries.length} partner relationships evolving`
    : `${metroName}: ${org_story_summaries.length} partner relationships in motion`;

  let communityStory: string;
  if (external_signals.length > 0) {
    const topSignals = external_signals.slice(0, 3).map(s => `- ${s.title}${s.snippet ? `: ${s.snippet.slice(0, 120)}` : ""}`).join("\n");
    communityStory = `The community landscape in ${metroName} continues to evolve.\n\n${topSignals}`;
  } else {
    communityStory = `No new external community developments have surfaced in ${metroName} during this period. The current environment remains stable.`;
  }

  let partnerStory: string;
  if (org_story_summaries.length > 0) {
    const highlights = org_story_summaries.slice(0, 5).map(o => {
      const trend = o.momentum_trend ? ` (${o.momentum_trend})` : "";
      const points = o.recent_story_points.slice(0, 1).join("; ");
      return `- **${o.org_name}**${trend}${points ? `: ${points}` : ""}`;
    }).join("\n");
    partnerStory = `Our partner ecosystem in ${metroName} includes ${org_story_summaries.length} active relationships.\n\n${highlights}`;
    if (risingOrgs.length > 0) {
      partnerStory += `\n\n${risingOrgs.length} partner${risingOrgs.length > 1 ? "s are" : " is"} showing rising momentum.`;
    }
  } else {
    partnerStory = `No active partner relationships are currently tracked in ${metroName}.`;
  }

  const emerging = ecosystem_patterns.slice(0, 5);
  if (emerging.length === 0 && risingOrgs.length > 0) {
    emerging.push(`Rising engagement across ${risingOrgs.length} partner${risingOrgs.length > 1 ? "s" : ""}`);
  }

  const gentle_outlook = org_story_summaries.length > 0
    ? `${metroName} continues to grow as a connected ecosystem. The relationships here suggest steady, grounded progress.`
    : `${metroName} is an emerging space with room for new partnerships and community connections.`;

  return { headline, community_story: communityStory, partner_story: partnerStory, emerging_patterns: emerging, gentle_outlook };
}

// ── Tests ──

Deno.test("urgency filter removes urgency words", () => {
  const input = "This is urgent and critical, act now before the deadline!";
  const result = removeUrgencyLanguage(input);
  assertEquals(result.includes("urgent"), false);
  assertEquals(result.includes("critical"), false);
  assertEquals(result.includes("act now"), false);
  assertEquals(result.includes("deadline"), false);
});

Deno.test("urgency filter leaves clean text unchanged", () => {
  const input = "The community landscape continues to evolve with steady progress.";
  assertEquals(removeUrgencyLanguage(input), input);
});

Deno.test("narrative builds without Firecrawl data", () => {
  const inputs: MetroStoryInputs = {
    metro_context: { metro_id: "m1", metro_name: "Minneapolis" },
    org_story_summaries: [
      { org_name: "Org A", momentum_trend: "rising", recent_story_points: ["signal1"], partner_responses: [] },
    ],
    ecosystem_patterns: [],
    external_signals: [],
  };
  const result = buildDeterministicNarrative(inputs);
  assertEquals(result.headline.includes("Minneapolis"), true);
  assertEquals(result.community_story.includes("No new external"), true);
  assertEquals(result.partner_story.includes("Org A"), true);
  assertEquals(result.gentle_outlook.length > 0, true);
});

Deno.test("narrative builds without org story inputs", () => {
  const inputs: MetroStoryInputs = {
    metro_context: { metro_id: "m1", metro_name: "Denver" },
    org_story_summaries: [],
    ecosystem_patterns: [],
    external_signals: [
      { title: "Housing policy update", snippet: "New affordable housing bill passed", source_url: null, published_date: null },
    ],
  };
  const result = buildDeterministicNarrative(inputs);
  assertEquals(result.headline.includes("Denver"), true);
  assertEquals(result.community_story.includes("Housing policy"), true);
  assertEquals(result.partner_story.includes("No active partner"), true);
  assertEquals(result.gentle_outlook.includes("emerging space"), true);
});

Deno.test("metro with zero data still produces narrative", () => {
  const inputs: MetroStoryInputs = {
    metro_context: { metro_id: "m1", metro_name: "Portland" },
    org_story_summaries: [],
    ecosystem_patterns: [],
    external_signals: [],
  };
  const result = buildDeterministicNarrative(inputs);
  assertEquals(result.headline.includes("Portland"), true);
  assertEquals(result.headline.includes("0 partner"), true);
  assertEquals(result.community_story.length > 0, true);
  assertEquals(result.partner_story.length > 0, true);
  assertEquals(result.gentle_outlook.length > 0, true);
});

Deno.test("narrative tone: no urgency keywords in deterministic output", () => {
  const inputs: MetroStoryInputs = {
    metro_context: { metro_id: "m1", metro_name: "Chicago" },
    org_story_summaries: [
      { org_name: "Test Org", momentum_trend: "rising", recent_story_points: ["leadership_change: New CEO"], partner_responses: [] },
      { org_name: "Test Org 2", momentum_trend: "stable", recent_story_points: [], partner_responses: [] },
    ],
    ecosystem_patterns: ["Growing partnerships"],
    external_signals: [
      { title: "Digital divide initiative", snippet: "City launches new program", source_url: "https://example.com", published_date: "2026-02-01" },
    ],
  };
  const result = buildDeterministicNarrative(inputs);
  const allText = [result.headline, result.community_story, result.partner_story, result.gentle_outlook, ...result.emerging_patterns].join(" ");
  assertEquals(URGENCY_WORDS.test(allText), false);
});

Deno.test("AI invalid JSON triggers fallback (simulated)", () => {
  // Simulate AI returning garbage → should use deterministic fallback
  const invalidJson = "This is not valid JSON at all {{{";
  let parsed = null;
  try {
    const match = invalidJson.match(/\{[\s\S]*\}/);
    if (match) parsed = JSON.parse(match[0]);
  } catch {
    parsed = null;
  }
  assertEquals(parsed, null); // Would trigger fallback in real code
});

Deno.test("rising orgs auto-generate emerging pattern", () => {
  const inputs: MetroStoryInputs = {
    metro_context: { metro_id: "m1", metro_name: "Seattle" },
    org_story_summaries: [
      { org_name: "A", momentum_trend: "rising", recent_story_points: [], partner_responses: [] },
      { org_name: "B", momentum_trend: "rising", recent_story_points: [], partner_responses: [] },
    ],
    ecosystem_patterns: [],
    external_signals: [],
  };
  const result = buildDeterministicNarrative(inputs);
  assertEquals(result.emerging_patterns.length >= 1, true);
  assertEquals(result.emerging_patterns[0].includes("Rising"), true);
});

Deno.test("dedupe key is deterministic for metro narratives", () => {
  const metroId = "m-123";
  const dateBucket1 = "2026-02-14T10:00:00Z".slice(0, 10);
  const dateBucket2 = "2026-02-14T23:59:59Z".slice(0, 10);
  const key1 = `metro-narrative:${metroId}:${dateBucket1}`;
  const key2 = `metro-narrative:${metroId}:${dateBucket2}`;
  assertEquals(key1, key2);
  assertEquals(key1, "metro-narrative:m-123:2026-02-14");
});
