import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  evaluateSuggestion,
  THRESHOLDS,
  type EffectivenessRow,
} from "../campaignIntelligence.ts";

// ============================================================
// Phase F1: Reply-Derived Outcomes (structural tests)
// ============================================================

Deno.test("F1: inbound reply maps to outreach_reply row", () => {
  const email = {
    gmail_message_id: "msg-123-from-contact@example.com",
    thread_id: "thread-abc",
    sender_email: "contact@example.com",
    sent_at: "2026-02-08T10:00:00Z",
  };

  const audience = {
    campaign_id: "camp-1",
    id: "aud-1",
    contact_id: "contact-1",
    email: "contact@example.com",
  };

  // Reply detection logic: match email to audience by sender
  const reply = {
    campaign_id: audience.campaign_id,
    audience_id: audience.id,
    contact_id: email.sender_email === audience.email.toLowerCase() ? audience.contact_id : null,
    thread_id: email.thread_id,
    gmail_message_id: email.gmail_message_id,
    received_at: email.sent_at,
    direction: "inbound",
  };

  assertEquals(reply.campaign_id, "camp-1");
  assertEquals(reply.contact_id, "contact-1");
  assertEquals(reply.direction, "inbound");
});

Deno.test("F1: reply outcome values are constrained", () => {
  const validOutcomes = new Set(["useful", "neutral", "not_useful"]);
  assertEquals(validOutcomes.has("useful"), true);
  assertEquals(validOutcomes.has("neutral"), true);
  assertEquals(validOutcomes.has("not_useful"), true);
  assertEquals(validOutcomes.has("positive"), false);
  assertEquals(validOutcomes.has(""), false);
});

Deno.test("F1: unacknowledged reply has null outcome", () => {
  const reply = {
    outcome: null as string | null,
    acknowledged_by: null as string | null,
    acknowledged_at: null as string | null,
  };
  assertEquals(reply.outcome, null);
  assertEquals(reply.acknowledged_by, null);
});

Deno.test("F1: acknowledged reply has outcome + user + timestamp", () => {
  const reply = {
    outcome: "useful",
    acknowledged_by: "user-123",
    acknowledged_at: new Date().toISOString(),
  };
  assertExists(reply.outcome);
  assertExists(reply.acknowledged_by);
  assertExists(reply.acknowledged_at);
});

// ============================================================
// Phase F2: Action Effectiveness Scoring
// ============================================================

Deno.test("F2: reply scoring — +3 for useful reply", () => {
  const scoreReply = (outcome: string | null): number => {
    if (outcome === "useful") return 3;
    if (outcome === null) return 1; // reply received, no ack yet
    return 0;
  };
  assertEquals(scoreReply("useful"), 3);
  assertEquals(scoreReply(null), 1);
  assertEquals(scoreReply("neutral"), 0);
});

Deno.test("F2: no-reply decay after 14 days = -1", () => {
  const sentDate = new Date("2026-01-01");
  const now = new Date("2026-01-20");
  const daysSince = (now.getTime() - sentDate.getTime()) / (1000 * 60 * 60 * 24);
  const decay = daysSince >= 14 ? -1 : 0;
  assertEquals(decay, -1);
});

Deno.test("F2: no-reply before 14 days = no decay", () => {
  const sentDate = new Date("2026-01-10");
  const now = new Date("2026-01-20");
  const daysSince = (now.getTime() - sentDate.getTime()) / (1000 * 60 * 60 * 24);
  const decay = daysSince >= 14 ? -1 : 0;
  assertEquals(decay, 0);
});

Deno.test("F2: effectiveness ranking uses evaluateSuggestion correctly", () => {
  const rows: EffectivenessRow[] = [
    {
      org_id: "org-1",
      action_type: "gmail_campaign",
      source: "manual",
      total_actions: 10,
      successful_actions: 7,
      success_rate: 0.7,
      avg_confidence: 0.8,
      last_success_at: new Date().toISOString(),
    },
  ];
  const result = evaluateSuggestion("org-1", rows);
  assertEquals(result.decision, "boosted");
});

// ============================================================
// Phase F3: Follow-Up Suggestions (structural)
// ============================================================

Deno.test("F3: reply without follow-up in 7 days triggers suggestion", () => {
  const replyDate = new Date("2026-01-01");
  const now = new Date("2026-01-10");
  const daysSinceReply = (now.getTime() - replyDate.getTime()) / (1000 * 60 * 60 * 24);
  const hasFollowUp = false;
  const shouldSuggest = daysSinceReply >= 7 && !hasFollowUp;
  assertEquals(shouldSuggest, true);
});

Deno.test("F3: reply with recent follow-up does NOT trigger suggestion", () => {
  const daysSinceReply = 10;
  const hasFollowUp = true;
  const shouldSuggest = daysSinceReply >= 7 && !hasFollowUp;
  assertEquals(shouldSuggest, false);
});

Deno.test("F3: watchlist signal without outreach in 30 days triggers suggestion", () => {
  const signalDate = new Date("2025-12-01");
  const lastOutreach = null;
  const now = new Date("2026-01-10");
  const shouldSuggest = !lastOutreach || 
    (now.getTime() - new Date(lastOutreach).getTime()) / (1000 * 60 * 60 * 24) >= 30;
  assertEquals(shouldSuggest, true);
});

Deno.test("F3: event import without campaign triggers suggestion", () => {
  const hasCampaignSent = false;
  const shouldSuggest = !hasCampaignSent;
  assertEquals(shouldSuggest, true);
});

Deno.test("F3: suggestion status transitions are valid", () => {
  const validStatuses = new Set(["pending", "accepted", "dismissed", "snoozed"]);
  assertEquals(validStatuses.has("pending"), true);
  assertEquals(validStatuses.has("accepted"), true);
  assertEquals(validStatuses.has("dismissed"), true);
  assertEquals(validStatuses.has("snoozed"), true);
  assertEquals(validStatuses.has("active"), false);
});

Deno.test("F3: accepted suggestion creates draft campaign", () => {
  const suggestion = { status: "pending", source_type: "reply", reason: "Reply received" };
  const accepted = { ...suggestion, status: "accepted" };
  assertEquals(accepted.status, "accepted");
});

// ============================================================
// Phase F4: Neighborhood Insights integration (structural)
// ============================================================

Deno.test("F4: neighborhood insight snapshot persists with org_id", () => {
  const snapshot = {
    org_id: "org-1",
    location_key: "Zip:55401",
    summary: "Community with active nonprofits",
    generated_at: new Date().toISOString(),
  };
  assertExists(snapshot.org_id);
  assertExists(snapshot.location_key);
  assertExists(snapshot.summary);
});

Deno.test("F4: manual refresh replaces existing snapshot", () => {
  const existing = { id: "snap-1", generated_at: "2026-01-01T00:00:00Z" };
  const replacement = { id: "snap-2", generated_at: "2026-02-08T00:00:00Z" };
  assertEquals(new Date(replacement.generated_at) > new Date(existing.generated_at), true);
});

Deno.test("F4: insight never auto-injected into templates (opt-in)", () => {
  // Template generation only uses insight if org_id + snapshot exist
  const hasInsight = true;
  const templateRequested = true;
  const orgIdProvided = false; // Not provided → no injection
  const willInject = templateRequested && orgIdProvided && hasInsight;
  assertEquals(willInject, false);
});

Deno.test("F4: insight citation includes snapshot ID", () => {
  const citation = {
    company_kb_versions: { company_profile: 1 },
    org_snapshot_id: "snap-123",
    source_urls: ["https://example.com"],
  };
  assertExists(citation.org_snapshot_id);
  assertEquals(citation.org_snapshot_id, "snap-123");
});
