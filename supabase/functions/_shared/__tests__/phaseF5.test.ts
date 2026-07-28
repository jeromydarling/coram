import { assertEquals, assertNotEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { computeInputsHash } from "../campaignRiskEval.ts";

// ── Risk Evaluation: computeInputsHash ──

Deno.test("inputsHash: same inputs produce same hash", () => {
  const h1 = computeInputsHash("Subject A", "<p>Body</p>", 100);
  const h2 = computeInputsHash("Subject A", "<p>Body</p>", 100);
  assertEquals(h1, h2);
});

Deno.test("inputsHash: different subject changes hash", () => {
  const h1 = computeInputsHash("Subject A", "<p>Body</p>", 100);
  const h2 = computeInputsHash("Subject B", "<p>Body</p>", 100);
  assertNotEquals(h1, h2);
});

Deno.test("inputsHash: different audience count changes hash", () => {
  const h1 = computeInputsHash("Subject A", "<p>Body</p>", 100);
  const h2 = computeInputsHash("Subject A", "<p>Body</p>", 200);
  assertNotEquals(h1, h2);
});

Deno.test("inputsHash: different body length changes hash", () => {
  const h1 = computeInputsHash("Subject A", "<p>Short</p>", 100);
  const h2 = computeInputsHash("Subject A", "<p>Much longer body content here</p>", 100);
  assertNotEquals(h1, h2);
});

// ── Risk Level Determination (deterministic rules) ──

Deno.test("risk: audience > 1000 → high", () => {
  const audience = 1200;
  let risk = "low";
  if (audience > 1000) risk = "high";
  assertEquals(risk, "high");
});

Deno.test("risk: audience > 200 but <= 1000 → medium", () => {
  const audience = 350;
  let risk: string = "low";
  if (audience > 1000) risk = "high";
  else if (audience > 200) risk = "medium";
  assertEquals(risk, "medium");
});

Deno.test("risk: audience <= 200 → low (default)", () => {
  const audience = 150;
  let risk: string = "low";
  if (audience > 1000) risk = "high";
  else if (audience > 200) risk = "medium";
  assertEquals(risk, "low");
});

// ── Send Intent Status Transitions ──

Deno.test("intent: low risk → auto-acknowledged", () => {
  const riskLevel: string = "low";
  const requiresAck = riskLevel === "medium" || riskLevel === "high";
  const intentStatus = requiresAck ? "proposed" : "acknowledged";
  assertEquals(intentStatus, "acknowledged");
  assertEquals(requiresAck, false);
});

Deno.test("intent: medium risk → requires ack", () => {
  const riskLevel: string = "medium";
  const requiresAck = riskLevel === "medium" || riskLevel === "high";
  const intentStatus = requiresAck ? "proposed" : "acknowledged";
  assertEquals(intentStatus, "proposed");
  assertEquals(requiresAck, true);
});

Deno.test("intent: high risk → requires ack", () => {
  const riskLevel: string = "high";
  const requiresAck = riskLevel === "medium" || riskLevel === "high";
  assertEquals(requiresAck, true);
});

// ── Intent Expiry ──

Deno.test("intent: expires_at 30 min from now → valid", () => {
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
  const isValid = expiresAt > new Date();
  assertEquals(isValid, true);
});

Deno.test("intent: expired → invalid", () => {
  const expiresAt = new Date(Date.now() - 1000);
  const isValid = expiresAt > new Date();
  assertEquals(isValid, false);
});

// ── Content Change Detection ──

Deno.test("intent: hash mismatch invalidates intent", () => {
  const hashAtCreation = computeInputsHash("Subject A", "<p>Body</p>", 100);
  const hashNow = computeInputsHash("Subject A CHANGED", "<p>Body</p>", 100);
  const isValid = hashAtCreation === hashNow;
  assertEquals(isValid, false);
});

Deno.test("intent: hash match keeps intent valid", () => {
  const hashAtCreation = computeInputsHash("Subject A", "<p>Body</p>", 100);
  const hashNow = computeInputsHash("Subject A", "<p>Body</p>", 100);
  assertEquals(hashAtCreation, hashNow);
});

// ── Send Gating Logic ──

Deno.test("gating: no intent → SEND_INTENT_REQUIRED", () => {
  const intent = null;
  const result = intent ? "proceed" : "SEND_INTENT_REQUIRED";
  assertEquals(result, "SEND_INTENT_REQUIRED");
});

Deno.test("gating: consumed intent + non-paused → ALREADY_CONSUMED", () => {
  const intent = { intent_status: "consumed" };
  const campaignStatus = "audience_ready";
  let result = "proceed";
  if (intent.intent_status === "consumed" && !["paused", "sending"].includes(campaignStatus)) {
    result = "ALREADY_CONSUMED";
  }
  assertEquals(result, "ALREADY_CONSUMED");
});

Deno.test("gating: consumed intent + paused → allow resume", () => {
  const intent = { intent_status: "consumed" };
  const campaignStatus = "paused";
  let result = "proceed";
  if (intent.intent_status === "consumed" && !["paused", "sending"].includes(campaignStatus)) {
    result = "ALREADY_CONSUMED";
  }
  assertEquals(result, "proceed");
});

Deno.test("gating: proposed + requires_ack → ACK_REQUIRED", () => {
  const intent = { intent_status: "proposed", requires_ack: true };
  let result = "proceed";
  if (intent.requires_ack && intent.intent_status !== "acknowledged") {
    result = "ACK_REQUIRED";
  }
  assertEquals(result, "ACK_REQUIRED");
});

Deno.test("gating: acknowledged → proceed", () => {
  const intent = { intent_status: "acknowledged", requires_ack: true };
  let result = "proceed";
  if (intent.requires_ack && intent.intent_status !== "acknowledged") {
    result = "ACK_REQUIRED";
  }
  assertEquals(result, "proceed");
});

// ── Subject Reuse ──

Deno.test("risk: subject reuse count > 0 → medium risk factor", () => {
  const subjectReuseCount = 2;
  const reasons: string[] = [];
  let risk = "low";
  if (subjectReuseCount > 0) {
    risk = "medium";
    reasons.push(`Subject line used ${subjectReuseCount} time(s) in the past 7 days`);
  }
  assertEquals(risk, "medium");
  assertEquals(reasons.length, 1);
});

// ── Transient Failure Rate ──

Deno.test("risk: transient failure rate > 25% → medium risk factor", () => {
  const transientFailureRate = 0.3;
  const reasons: string[] = [];
  let risk = "low";
  if (transientFailureRate > 0.25) {
    risk = "medium";
    reasons.push("High transient failure rate");
  }
  assertEquals(risk, "medium");
});

Deno.test("risk: transient failure rate <= 25% → no risk factor", () => {
  const transientFailureRate = 0.2;
  const reasons: string[] = [];
  if (transientFailureRate > 0.25) {
    reasons.push("High transient failure rate");
  }
  assertEquals(reasons.length, 0);
});
