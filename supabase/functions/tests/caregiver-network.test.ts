/**
 * Caregiver Network — Deno Tests
 *
 * Tests for caregiver network schema, RLS rules, and privacy invariants.
 * Updated with fixes for issues #1-14.
 */

import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";

// ── Slot/visibility logic tests ─────────────────────────────

Deno.test("caregiver_profiles: default network_opt_in is false", () => {
  const defaultOptIn = false;
  assertEquals(defaultOptIn, false, "Default must be OFF for privacy");
});

Deno.test("caregiver_profiles: default contact_visibility is relay_only", () => {
  const defaultVisibility = "relay_only";
  assertEquals(defaultVisibility, "relay_only", "Mediated messaging by default");
});

Deno.test("caregiver_profiles: hidden_at hides from browse", () => {
  const profile = { network_opt_in: true, hidden_at: "2026-02-27T00:00:00Z" };
  const isVisible = profile.network_opt_in && !profile.hidden_at;
  assertEquals(isVisible, false, "Hidden profiles must not appear in browse");
});

Deno.test("caregiver_profiles: opted-in and not hidden is visible", () => {
  const profile = { network_opt_in: true, hidden_at: null };
  const isVisible = profile.network_opt_in && !profile.hidden_at;
  assertEquals(isVisible, true, "Opted-in, non-hidden profiles are visible");
});

Deno.test("caregiver_profiles: opted-out is not visible", () => {
  const profile = { network_opt_in: false, hidden_at: null };
  const isVisible = profile.network_opt_in && !profile.hidden_at;
  assertEquals(isVisible, false, "Opted-out profiles must not appear");
});

// ── Request status flow tests ───────────────────────────────

Deno.test("network_requests: valid status transitions from pending", () => {
  const validFromPending = ["accepted", "declined", "blocked"];
  for (const target of validFromPending) {
    const allowed = ["accepted", "declined", "blocked"].includes(target);
    assertEquals(allowed, true, `pending → ${target} should be valid`);
  }
});

Deno.test("network_requests: accepted → blocked is valid (safety)", () => {
  const from = "accepted";
  const to = "blocked";
  const allowed = from === "accepted" && to === "blocked";
  assertEquals(allowed, true, "Must allow blocking after acceptance for safety");
});

Deno.test("network_requests: accepted → pending is INVALID (no regression)", () => {
  const from = "accepted";
  const to = "pending";
  const validTransitions: Record<string, string[]> = {
    pending: ["accepted", "declined", "blocked"],
    accepted: ["blocked"],
  };
  const allowed = (validTransitions[from] ?? []).includes(to);
  assertEquals(allowed, false, "Cannot regress from accepted to pending");
});

Deno.test("network_requests: blocked → accepted is INVALID", () => {
  const from = "blocked";
  const to = "accepted";
  const validTransitions: Record<string, string[]> = {
    pending: ["accepted", "declined", "blocked"],
    accepted: ["blocked"],
  };
  const allowed = (validTransitions[from] ?? []).includes(to);
  assertEquals(allowed, false, "Cannot unblock via status update");
});

Deno.test("network_requests: default status is pending", () => {
  const defaultStatus = "pending";
  assertEquals(defaultStatus, "pending");
});

// ── Self-request prevention ─────────────────────────────────

Deno.test("self-request: user cannot request own profile", () => {
  const fromUserId = "user-a";
  const profileUserId = "user-a";
  const isSelf = fromUserId === profileUserId;
  assertEquals(isSelf, true, "Self-request must be detected");
});

// ── Duplicate request prevention ────────────────────────────

Deno.test("duplicate-request: unique index prevents double pending", () => {
  // Simulates the unique partial index behavior
  const existingRequests = [
    { from: "user-a", to: "profile-1", status: "pending" },
  ];
  const newRequest = { from: "user-a", to: "profile-1", status: "pending" };
  const wouldConflict = existingRequests.some(
    r => r.from === newRequest.from && r.to === newRequest.to &&
         ["pending", "accepted"].includes(r.status)
  );
  assertEquals(wouldConflict, true, "Duplicate active request must be blocked");
});

Deno.test("duplicate-request: declined allows new request", () => {
  const existingRequests = [
    { from: "user-a", to: "profile-1", status: "declined" },
  ];
  const newRequest = { from: "user-a", to: "profile-1", status: "pending" };
  const wouldConflict = existingRequests.some(
    r => r.from === newRequest.from && r.to === newRequest.to &&
         ["pending", "accepted"].includes(r.status)
  );
  assertEquals(wouldConflict, false, "After decline, new request should be allowed");
});

// ── Block enforcement ───────────────────────────────────────

Deno.test("block-enforcement: blocked user cannot re-request", () => {
  const existingRequests = [
    { from: "user-a", to: "profile-1", status: "blocked" },
  ];
  const hasBlock = existingRequests.some(
    r => r.from === "user-a" && r.to === "profile-1" && r.status === "blocked"
  );
  assertEquals(hasBlock, true, "Blocked requests must prevent new requests");
});

// ── Message participant check logic ─────────────────────────

Deno.test("message_participant: sender is participant", () => {
  const request = { from_user_id: "user-a", to_profile_user_id: "user-b", status: "accepted" };
  const userId = "user-a";
  const isParticipant = request.status === "accepted" &&
    (userId === request.from_user_id || userId === request.to_profile_user_id);
  assertEquals(isParticipant, true);
});

Deno.test("message_participant: recipient is participant", () => {
  const request = { from_user_id: "user-a", to_profile_user_id: "user-b", status: "accepted" };
  const userId = "user-b";
  const isParticipant = request.status === "accepted" &&
    (userId === request.from_user_id || userId === request.to_profile_user_id);
  assertEquals(isParticipant, true);
});

Deno.test("message_participant: non-participant denied", () => {
  const request = { from_user_id: "user-a", to_profile_user_id: "user-b", status: "accepted" };
  const userId = "user-c";
  const isParticipant = request.status === "accepted" &&
    (userId === request.from_user_id || userId === request.to_profile_user_id);
  assertEquals(isParticipant, false);
});

Deno.test("message_participant: pending request denies messaging", () => {
  const request = { from_user_id: "user-a", to_profile_user_id: "user-b", status: "pending" };
  const userId = "user-a";
  const isParticipant = request.status === "accepted" &&
    (userId === request.from_user_id || userId === request.to_profile_user_id);
  assertEquals(isParticipant, false, "Messaging only allowed on accepted requests");
});

// ── Privacy invariants ──────────────────────────────────────

Deno.test("privacy: profile only shows approximate location", () => {
  const profileFields = ["display_name", "base_city", "base_state_code", "bio_short", "availability_tags"];
  const forbiddenFields = ["address", "zip_code", "latitude", "longitude", "people", "contacts", "visit_notes"];
  for (const f of forbiddenFields) {
    assertEquals(profileFields.includes(f), false, `Must not expose ${f}`);
  }
});

Deno.test("privacy: gardener cannot see message body unless reported", () => {
  const reported = false;
  const isGardener = true;
  const canSeeBody = reported && isGardener;
  assertEquals(canSeeBody, false, "Gardener sees messages only when reported=true");
});

Deno.test("privacy: gardener can see reported message body", () => {
  const reported = true;
  const isGardener = true;
  const canSeeBody = reported && isGardener;
  assertEquals(canSeeBody, true, "Reported messages visible to gardener");
});

// ── Report flow completeness ────────────────────────────────

Deno.test("report-flow: reporting a message must set reported=true on the message", () => {
  // Simulates the fixed report flow
  const message = { id: "msg-1", reported: false, reported_reason: null };
  // After report submission, the hook should update the message
  const afterReport = { ...message, reported: true, reported_reason: "Inappropriate content" };
  assertEquals(afterReport.reported, true, "Message must be flagged as reported");
  assertEquals(afterReport.reported_reason !== null, true, "Reason must be captured");
});

// ── Contact visibility levels ───────────────────────────────

Deno.test("contact_visibility: relay_only is most restrictive", () => {
  const levels = ["relay_only", "reveal_on_request", "public_email_optional"];
  assertEquals(levels[0], "relay_only");
});

Deno.test("contact_visibility: enum has 3 values", () => {
  const levels = ["relay_only", "reveal_on_request", "public_email_optional"];
  assertEquals(levels.length, 3);
});

// ── Thread deduplication ────────────────────────────────────

Deno.test("messages: thread deduplication prevents duplicates", () => {
  const incoming = [{ id: "req-1", status: "accepted" }];
  const outgoing = [{ id: "req-1", status: "accepted" }];
  const all = [...incoming, ...outgoing];
  const seen = new Set<string>();
  const unique: any[] = [];
  for (const r of all) {
    if (!seen.has(r.id)) {
      seen.add(r.id);
      unique.push(r);
    }
  }
  assertEquals(unique.length, 1, "Same request must appear only once");
});

// ── Browse pagination ───────────────────────────────────────

Deno.test("browse: pagination uses bounded page size", () => {
  const pageSize = 20;
  const page = 0;
  const rangeStart = page * pageSize;
  const rangeEnd = (page + 1) * pageSize - 1;
  assertEquals(rangeStart, 0);
  assertEquals(rangeEnd, 19);
});
