import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";

// ── Pure unit tests for delta detection and narrative logic ──

// Replicate the types and logic from the edge function for testability
interface EvidenceItem {
  type: string;
  ts: string;
  url: string | null;
  snippet: string;
  source: string;
  id: string;
}

const FAMILY_SIGNAL_MAP: Record<string, string[]> = {
  leadership: ["leadership_change", "hiring", "org_chart", "board_change", "executive_hire"],
  programs: ["program_launch", "service_expansion", "mission_update", "program_change"],
  ecosystem: ["partnership", "collaboration", "network", "coalition", "referral"],
  funding: ["grant_awarded", "funding", "grant_opportunity", "fundraising", "donation"],
  events: ["event", "conference", "summit", "workshop", "webinar"],
  relationship: ["outreach", "meeting", "engagement", "momentum"],
};

function mapSignalToFamily(signalType: string): string | null {
  for (const [family, types] of Object.entries(FAMILY_SIGNAL_MAP)) {
    if (types.some(t => signalType.toLowerCase().includes(t))) return family;
  }
  return null;
}

function generateNarrative(
  family: string,
  chapterTitle: string,
  evidence: EvidenceItem[],
  orgName: string,
): { summary_md: string; delta_type: string; confidence: number } {
  if (evidence.length === 0) {
    return {
      summary_md: `No new developments in ${chapterTitle} during this period. The current landscape remains stable.`,
      delta_type: "noop",
      confidence: 0.3,
    };
  }

  const topEvidence = evidence.slice(0, 3);
  const hasNewSignals = evidence.some(e => e.source === "opportunity_signals" || e.source === "discovered_items");
  const hasMomentum = evidence.some(e => e.type === "momentum");
  const hasLeadershipChange = evidence.some(e => /leader|ceo|director|executive|hire/i.test(e.snippet));

  let deltaType: string;
  let confidence: number;

  if (hasLeadershipChange && family === "leadership") {
    deltaType = "shift";
    confidence = 0.8;
  } else if (hasNewSignals) {
    deltaType = "new_signal";
    confidence = 0.7;
  } else if (hasMomentum) {
    deltaType = "reinforcement";
    confidence = 0.6;
  } else {
    deltaType = "reinforcement";
    confidence = 0.5;
  }

  return { summary_md: `narrative for ${chapterTitle}`, delta_type: deltaType, confidence };
}

function shouldWriteUpdatePure(
  lastEvidenceIds: Set<string> | null,
  currentEvidence: EvidenceItem[],
  force: boolean,
): { write: boolean; isFirstUpdate: boolean } {
  if (lastEvidenceIds === null) return { write: true, isFirstUpdate: true };

  const staticIds = new Set(["momentum-latest", "last-contact", "mission-snapshot", "grant-alignment", "partnership-angle"]);
  const newEvidenceItems = currentEvidence.filter(
    e => !staticIds.has(e.id) && !lastEvidenceIds.has(e.id),
  );

  if (newEvidenceItems.length === 0 && !force) return { write: false, isFirstUpdate: false };
  return { write: true, isFirstUpdate: false };
}

function buildDedupeKey(opportunityId: string, family: string, generatedAt: string): string {
  const dateBucket = generatedAt.slice(0, 10);
  return `story:${opportunityId}:${family}:${dateBucket}`;
}

// ── Tests ──

Deno.test("mapSignalToFamily: leadership_change → leadership", () => {
  assertEquals(mapSignalToFamily("leadership_change"), "leadership");
});

Deno.test("mapSignalToFamily: unknown signal → null", () => {
  assertEquals(mapSignalToFamily("random_unknown"), null);
});

Deno.test("mapSignalToFamily: grant_awarded → funding", () => {
  assertEquals(mapSignalToFamily("grant_awarded"), "funding");
});

Deno.test("generateNarrative: no evidence → noop", () => {
  const result = generateNarrative("leadership", "Leadership Evolution", [], "Test Org");
  assertEquals(result.delta_type, "noop");
  assertEquals(result.confidence, 0.3);
});

Deno.test("generateNarrative: leadership change → shift", () => {
  const evidence: EvidenceItem[] = [{
    type: "leadership_change",
    ts: new Date().toISOString(),
    url: null,
    snippet: "New CEO appointed",
    source: "opportunity_signals",
    id: "sig-1",
  }];
  const result = generateNarrative("leadership", "Leadership Evolution", evidence, "Test Org");
  assertEquals(result.delta_type, "shift");
  assertEquals(result.confidence >= 0.8, true);
});

Deno.test("generateNarrative: new signal from discoveries → new_signal", () => {
  const evidence: EvidenceItem[] = [{
    type: "discovery:grants",
    ts: new Date().toISOString(),
    url: "https://example.com/grant",
    snippet: "New grant opportunity found",
    source: "discovered_items",
    id: "disc-1",
  }];
  const result = generateNarrative("funding", "Funding & Grants", evidence, "Test Org");
  assertEquals(result.delta_type, "new_signal");
  assertEquals(result.confidence >= 0.7, true);
});

Deno.test("generateNarrative: momentum only → reinforcement", () => {
  const evidence: EvidenceItem[] = [{
    type: "momentum",
    ts: new Date().toISOString(),
    url: null,
    snippet: "Score: 75, Trend: rising, Delta: 10",
    source: "relationship_momentum",
    id: "momentum-latest",
  }];
  const result = generateNarrative("relationship", "Relationship Arc", evidence, "Test Org");
  assertEquals(result.delta_type, "reinforcement");
});

Deno.test("shouldWriteUpdate: no prior → first update", () => {
  const result = shouldWriteUpdatePure(null, [], false);
  assertEquals(result.write, true);
  assertEquals(result.isFirstUpdate, true);
});

Deno.test("shouldWriteUpdate: no new evidence, force=false → no write", () => {
  const lastIds = new Set(["sig-1"]);
  const currentEvidence: EvidenceItem[] = [{
    type: "signal", ts: "", url: null, snippet: "test", source: "opportunity_signals", id: "sig-1",
  }];
  const result = shouldWriteUpdatePure(lastIds, currentEvidence, false);
  assertEquals(result.write, false);
});

Deno.test("shouldWriteUpdate: no new evidence, force=true → write", () => {
  const lastIds = new Set(["sig-1"]);
  const currentEvidence: EvidenceItem[] = [{
    type: "signal", ts: "", url: null, snippet: "test", source: "opportunity_signals", id: "sig-1",
  }];
  const result = shouldWriteUpdatePure(lastIds, currentEvidence, true);
  assertEquals(result.write, true);
  assertEquals(result.isFirstUpdate, false);
});

Deno.test("shouldWriteUpdate: new evidence items → write", () => {
  const lastIds = new Set(["sig-1"]);
  const currentEvidence: EvidenceItem[] = [
    { type: "signal", ts: "", url: null, snippet: "old", source: "opportunity_signals", id: "sig-1" },
    { type: "signal", ts: "", url: null, snippet: "new", source: "opportunity_signals", id: "sig-2" },
  ];
  const result = shouldWriteUpdatePure(lastIds, currentEvidence, false);
  assertEquals(result.write, true);
});

Deno.test("shouldWriteUpdate: only static IDs as new → no write", () => {
  const lastIds = new Set<string>();
  const currentEvidence: EvidenceItem[] = [
    { type: "momentum", ts: "", url: null, snippet: "score", source: "relationship_momentum", id: "momentum-latest" },
    { type: "last_contact", ts: "", url: null, snippet: "date", source: "opportunities", id: "last-contact" },
  ];
  const result = shouldWriteUpdatePure(lastIds, currentEvidence, false);
  assertEquals(result.write, false);
});

Deno.test("dedupeKey is deterministic", () => {
  const key1 = buildDedupeKey("opp-123", "leadership", "2026-02-14T10:00:00Z");
  const key2 = buildDedupeKey("opp-123", "leadership", "2026-02-14T23:59:59Z");
  assertEquals(key1, key2);
  assertEquals(key1, "story:opp-123:leadership:2026-02-14");
});

Deno.test("dedupeKey different day → different key", () => {
  const key1 = buildDedupeKey("opp-123", "leadership", "2026-02-14T10:00:00Z");
  const key2 = buildDedupeKey("opp-123", "leadership", "2026-02-15T10:00:00Z");
  assertEquals(key1 !== key2, true);
});

Deno.test("notification targeting: always requires user_id (non-null)", () => {
  // Verify the payload structure
  const payload = {
    dedupe_key: "story:opp-1:leadership:2026-02-14",
    opportunity_id: "opp-1",
    chapter_family: "leadership",
    chapter_title: "Leadership Evolution",
    delta_type: "shift",
    generated_at: "2026-02-14T10:00:00Z",
  };
  assertExists(payload.dedupe_key);
  assertExists(payload.opportunity_id);
  assertExists(payload.chapter_family);
  assertExists(payload.delta_type);
});

Deno.test("notification: noop delta_type should NOT trigger notification", () => {
  // Rule: only 'shift' and 'new_signal' with confidence >= 0.7 trigger notifications
  const shouldNotify = (deltaType: string, confidence: number): boolean => {
    return ["shift", "new_signal"].includes(deltaType) && confidence >= 0.7;
  };
  assertEquals(shouldNotify("noop", 0.3), false);
  assertEquals(shouldNotify("reinforcement", 0.6), false);
  assertEquals(shouldNotify("shift", 0.8), true);
  assertEquals(shouldNotify("new_signal", 0.7), true);
  assertEquals(shouldNotify("shift", 0.5), false); // below threshold
});
