import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";

// ── Theme extraction tests (unit-level, no network) ──

const URGENCY_WORDS = /\b(urgent|critical|act now|immediately|asap|emergency|deadline|hurry|don't miss|last chance|breaking|high priority|action required)\b/gi;

function removeUrgencyLanguage(text: string): string {
  return text.replace(URGENCY_WORDS, "").replace(/ {2,}/g, " ").trim();
}

interface NarrativeThemes {
  education: boolean;
  housing: boolean;
  funding: boolean;
  policy: boolean;
  health: boolean;
  technology: boolean;
  employment: boolean;
  rawThemes: string[];
}

function extractThemes(narrativeJson: Record<string, unknown>): NarrativeThemes {
  const parts: string[] = [];
  if (narrativeJson.community_story) parts.push(String(narrativeJson.community_story));
  if (narrativeJson.partner_story) parts.push(String(narrativeJson.partner_story));
  if (narrativeJson.gentle_outlook) parts.push(String(narrativeJson.gentle_outlook));
  if (narrativeJson.headline) parts.push(String(narrativeJson.headline));
  const patterns = (narrativeJson.emerging_patterns ?? narrativeJson.detected_patterns ?? []) as string[];
  parts.push(...patterns);
  const blob = parts.join(" ").toLowerCase();
  const rawThemes: string[] = [];

  if (/\b(school|student|learning|education|enrollment|classroom|teacher|remote learning)\b/.test(blob)) rawThemes.push("education");
  if (/\b(housing|shelter|displacement|eviction|homeless|rent|affordable housing)\b/.test(blob)) rawThemes.push("housing");
  if (/\b(fund|grant|appropriat|budget|allocation|investment|capital|philanthrop)\b/.test(blob)) rawThemes.push("funding");
  if (/\b(policy|regulation|legislation|ordinance|zoning|compliance|mandate)\b/.test(blob)) rawThemes.push("policy");
  if (/\b(health|mental health|clinic|hospital|wellness|nutrition|food|hunger)\b/.test(blob)) rawThemes.push("health");
  if (/\b(technology|digital|broadband|internet|device|computer|connectivity)\b/.test(blob)) rawThemes.push("technology");
  if (/\b(employment|workforce|job|hiring|layoff|unemployment|career|labor)\b/.test(blob)) rawThemes.push("employment");

  return {
    education: rawThemes.includes("education"),
    housing: rawThemes.includes("housing"),
    funding: rawThemes.includes("funding"),
    policy: rawThemes.includes("policy"),
    health: rawThemes.includes("health"),
    technology: rawThemes.includes("technology"),
    employment: rawThemes.includes("employment"),
    rawThemes,
  };
}

// ── Deterministic matching (mirrored from edge function) ──

interface OrgProfile {
  opportunity_id: string;
  organization: string;
  ecosystem_scope: Record<string, unknown> | null;
  grant_alignment_vectors: Record<string, unknown> | null;
  geo_reach_profile: Record<string, unknown> | null;
}

interface MatchResult {
  opportunity_id: string;
  organization: string;
  suggestion_type: string;
  reasoning: string;
  confidence: number;
}

function deterministicMatch(themes: NarrativeThemes, profiles: OrgProfile[]): MatchResult[] {
  const matches: MatchResult[] = [];
  for (const prof of profiles) {
    const eco = prof.ecosystem_scope ?? {};
    const sectors = ((eco.sectors ?? eco.focus_areas ?? []) as string[]).map(s => s.toLowerCase());
    const grant = prof.grant_alignment_vectors ?? {};
    const grantFocus = ((grant.focus_areas ?? []) as string[]).map(s => s.toLowerCase());

    if (themes.education && sectors.some(s => /education|school|student|learning|youth/.test(s))) {
      matches.push({ opportunity_id: prof.opportunity_id, organization: prof.organization, suggestion_type: "check_in", reasoning: `Education shifts may affect ${prof.organization}.`, confidence: 72 });
    }
    if (themes.housing && sectors.some(s => /housing|shelter|homeless/.test(s))) {
      matches.push({ opportunity_id: prof.opportunity_id, organization: prof.organization, suggestion_type: "offer_support", reasoning: `Housing changes may impact ${prof.organization}.`, confidence: 68 });
    }
    if (themes.funding && grantFocus.length > 0) {
      const overlap = grantFocus.filter(f => themes.rawThemes.some(t => f.includes(t)));
      if (overlap.length > 0) {
        matches.push({ opportunity_id: prof.opportunity_id, organization: prof.organization, suggestion_type: "share_resource", reasoning: `Funding aligns with ${prof.organization}.`, confidence: 65 });
      }
    }
    if (themes.technology && sectors.some(s => /technology|digital|broadband|device/.test(s))) {
      matches.push({ opportunity_id: prof.opportunity_id, organization: prof.organization, suggestion_type: "check_in", reasoning: `Tech access developments connect to ${prof.organization}.`, confidence: 70 });
    }
  }
  // Dedupe
  const deduped = new Map<string, MatchResult>();
  for (const m of matches) {
    const key = `${m.opportunity_id}::${m.suggestion_type}`;
    if (!deduped.has(key) || m.confidence > deduped.get(key)!.confidence) deduped.set(key, m);
  }
  return Array.from(deduped.values()).sort((a, b) => b.confidence - a.confidence).slice(0, 5);
}

// ── Tests ──

Deno.test("extractThemes: school closure → education theme", () => {
  const themes = extractThemes({
    community_story: "Several schools announced early closures due to weather.",
    partner_story: "Partners are adjusting student programs.",
    emerging_patterns: ["Remote learning increasing"],
  });
  assert(themes.education, "Should detect education theme");
  assert(themes.rawThemes.includes("education"));
});

Deno.test("extractThemes: housing instability → housing theme", () => {
  const themes = extractThemes({
    community_story: "Rising eviction rates and housing instability across the metro.",
  });
  assert(themes.housing);
});

Deno.test("extractThemes: no themes from empty narrative", () => {
  const themes = extractThemes({
    community_story: "Things are quiet and steady.",
    partner_story: "Partnerships continue their work.",
  });
  assertEquals(themes.rawThemes.length, 0);
});

Deno.test("deterministicMatch: education theme matches education org", () => {
  const themes = extractThemes({ community_story: "School enrollment dropping significantly." });
  const profiles: OrgProfile[] = [
    { opportunity_id: "opp-1", organization: "EduOrg", ecosystem_scope: { sectors: ["Education", "Youth"] }, grant_alignment_vectors: null, geo_reach_profile: null },
    { opportunity_id: "opp-2", organization: "HealthOrg", ecosystem_scope: { sectors: ["Health"] }, grant_alignment_vectors: null, geo_reach_profile: null },
  ];
  const matches = deterministicMatch(themes, profiles);
  assertEquals(matches.length, 1);
  assertEquals(matches[0].organization, "EduOrg");
  assertEquals(matches[0].suggestion_type, "check_in");
});

Deno.test("deterministicMatch: non-matching orgs produce zero suggestions", () => {
  const themes = extractThemes({ community_story: "New zoning policy announced." });
  const profiles: OrgProfile[] = [
    { opportunity_id: "opp-1", organization: "FoodBank", ecosystem_scope: { sectors: ["Food", "Nutrition"] }, grant_alignment_vectors: null, geo_reach_profile: null },
  ];
  const matches = deterministicMatch(themes, profiles);
  assertEquals(matches.length, 0);
});

Deno.test("deterministicMatch: caps at 5 suggestions", () => {
  const themes: NarrativeThemes = { education: true, housing: true, funding: false, policy: false, health: false, technology: true, employment: false, rawThemes: ["education", "housing", "technology"] };
  const profiles: OrgProfile[] = [];
  for (let i = 0; i < 20; i++) {
    profiles.push({
      opportunity_id: `opp-${i}`,
      organization: `Org${i}`,
      ecosystem_scope: { sectors: ["Education", "Housing", "Technology"] },
      grant_alignment_vectors: null,
      geo_reach_profile: null,
    });
  }
  const matches = deterministicMatch(themes, profiles);
  assert(matches.length <= 5, `Should cap at 5, got ${matches.length}`);
});

Deno.test("deterministicMatch: deduplicates same org + same type", () => {
  const themes: NarrativeThemes = { education: true, housing: false, funding: false, policy: false, health: false, technology: true, employment: false, rawThemes: ["education", "technology"] };
  const profiles: OrgProfile[] = [
    { opportunity_id: "opp-1", organization: "TechEduOrg", ecosystem_scope: { sectors: ["Education", "Technology"] }, grant_alignment_vectors: null, geo_reach_profile: null },
  ];
  const matches = deterministicMatch(themes, profiles);
  // Both education and technology match as check_in for the same org — should dedupe to 1
  const checkIns = matches.filter(m => m.suggestion_type === "check_in" && m.opportunity_id === "opp-1");
  assertEquals(checkIns.length, 1, "Should dedupe same org + same type");
});

Deno.test("removeUrgencyLanguage: strips forbidden words", () => {
  const cleaned = removeUrgencyLanguage("This is urgent and critical — act now before the deadline!");
  assert(!cleaned.includes("urgent"));
  assert(!cleaned.includes("critical"));
  assert(!cleaned.includes("act now"));
  assert(!cleaned.includes("deadline"));
});

Deno.test("suggested message never contains urgency words", () => {
  const message = "Subject: Thinking of you\n\nHi, we noticed some changes in your area. Just wanted to check in warmly.";
  const cleaned = removeUrgencyLanguage(message);
  assertEquals(cleaned, message, "Clean message should pass through unchanged");
});

Deno.test("funding match: grant alignment triggers share_resource", () => {
  const themes = extractThemes({ community_story: "A new federal grant program for education was announced." });
  const profiles: OrgProfile[] = [
    { opportunity_id: "opp-1", organization: "GrantOrg", ecosystem_scope: { sectors: ["Education"] }, grant_alignment_vectors: { focus_areas: ["education", "youth"] }, geo_reach_profile: null },
  ];
  const matches = deterministicMatch(themes, profiles);
  const shareMatch = matches.find(m => m.suggestion_type === "share_resource");
  assert(shareMatch, "Should produce share_resource for grant alignment");
});
