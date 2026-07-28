import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";

// ── Set env BEFORE importing ──
Deno.env.set("ENRICHMENT_WORKER_SECRET", "test_enrich_secret");
Deno.env.set("N8N_SHARED_SECRET", "test_shared_secret");
Deno.env.set("SUPABASE_URL", "http://localhost:54321");
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key");

import {
  authenticateServiceRequest,
  validateInput,
  normalizeName,
  canonicalKey,
  dedupeRoster,
  computeDiff,
  isLeadershipTitle,
} from "../people-roster-diff/index.ts";

// ── Canonicalization Tests ──

Deno.test("normalizeName: trims and collapses whitespace", () => {
  assertEquals(normalizeName("  Jane   Doe  "), "Jane Doe");
});

Deno.test("normalizeName: null/undefined returns empty", () => {
  assertEquals(normalizeName(null), "");
  assertEquals(normalizeName(undefined), "");
});

Deno.test("canonicalKey: builds lowercase pipe-delimited key", () => {
  const key = canonicalKey({
    name: "Jane Doe", title: "CEO", organization_name: "Acme Inc",
    email: null, phone: null, source_url: null, evidence: null, confidence: null,
  });
  assertEquals(key, "jane doe|ceo|acme inc");
});

Deno.test("dedupeRoster: keeps highest confidence per canonical key", () => {
  const roster = dedupeRoster([
    { name: "Jane Doe", title: "CEO", organization_name: "Acme", email: null, phone: null, source_url: null, evidence: null, confidence: 0.5 },
    { name: "jane doe", title: "ceo", organization_name: "acme", email: "jane@acme.com", phone: null, source_url: null, evidence: null, confidence: 0.9 },
  ]);
  assertEquals(roster.length, 1);
  assertEquals(roster[0].email, "jane@acme.com");
  assertEquals(roster[0].confidence, 0.9);
});

Deno.test("dedupeRoster: skips entries with empty name/title/org", () => {
  const roster = dedupeRoster([
    { name: "", title: "", organization_name: "", email: null, phone: null, source_url: null, evidence: null, confidence: 0.5 },
  ]);
  assertEquals(roster.length, 0);
});

// ── Leadership Title Tests ──

Deno.test("isLeadershipTitle: detects CEO", () => {
  assertEquals(isLeadershipTitle("Chief Executive Officer"), true);
  assertEquals(isLeadershipTitle("CEO"), true);
});

Deno.test("isLeadershipTitle: detects VP/Director", () => {
  assertEquals(isLeadershipTitle("Vice President of Sales"), true);
  assertEquals(isLeadershipTitle("VP Engineering"), true);
  assertEquals(isLeadershipTitle("Director of Operations"), true);
});

Deno.test("isLeadershipTitle: rejects non-leadership", () => {
  assertEquals(isLeadershipTitle("Software Engineer"), false);
  assertEquals(isLeadershipTitle("Sales Associate"), false);
  assertEquals(isLeadershipTitle(null), false);
});

// ── Diff Computation Tests ──

const mkPerson = (name: string, title: string, org = "TestOrg") => ({
  name, title, organization_name: org,
  email: null, phone: null, source_url: null, evidence: null, confidence: 0.8,
});

Deno.test("computeDiff: detects added people", () => {
  const diff = computeDiff([], [mkPerson("Jane Doe", "CEO")]);
  assertEquals(diff.added.length, 1);
  assertEquals(diff.removed.length, 0);
  assertEquals(diff.changed.length, 0);
});

Deno.test("computeDiff: detects removed people", () => {
  const diff = computeDiff([mkPerson("Jane Doe", "CEO")], []);
  assertEquals(diff.removed.length, 1);
  assertEquals(diff.added.length, 0);
});

Deno.test("computeDiff: detects title change", () => {
  const diff = computeDiff(
    [mkPerson("Jane Doe", "Director")],
    [mkPerson("Jane Doe", "VP")],
  );
  assertEquals(diff.changed.length, 1);
  assertEquals(diff.changed[0].change_type, "title_changed");
  assertEquals(diff.changed[0].before.title, "Director");
  assertEquals(diff.changed[0].after.title, "VP");
});

Deno.test("computeDiff: detects org change", () => {
  const diff = computeDiff(
    [mkPerson("Jane Doe", "CEO", "OldCo")],
    [mkPerson("Jane Doe", "CEO", "NewCo")],
  );
  assertEquals(diff.changed.length, 1);
  assertEquals(diff.changed[0].change_type, "org_changed");
});

Deno.test("computeDiff: no changes when identical", () => {
  const diff = computeDiff(
    [mkPerson("Jane Doe", "CEO")],
    [mkPerson("Jane Doe", "CEO")],
  );
  assertEquals(diff.added.length, 0);
  assertEquals(diff.removed.length, 0);
  assertEquals(diff.changed.length, 0);
  assertEquals(diff.summary, "No changes");
});

Deno.test("computeDiff: case-insensitive name matching", () => {
  const diff = computeDiff(
    [mkPerson("jane doe", "CEO")],
    [mkPerson("Jane Doe", "CFO")],
  );
  assertEquals(diff.changed.length, 1);
  assertEquals(diff.added.length, 0);
});

// ── Validation Tests ──

const VALID_UUID = "12345678-1234-1234-1234-123456789abc";

Deno.test("validateInput: valid payload", () => {
  const result = validateInput({
    run_id: VALID_UUID,
    opportunity_id: VALID_UUID,
    people: [{ name: "Jane", title: "CEO" }],
  });
  assertEquals(result.valid, true);
});

Deno.test("validateInput: missing run_id", () => {
  const result = validateInput({
    opportunity_id: VALID_UUID,
    people: [],
  });
  assertEquals(result.valid, false);
});

Deno.test("validateInput: missing people array", () => {
  const result = validateInput({
    run_id: VALID_UUID,
    opportunity_id: VALID_UUID,
  });
  assertEquals(result.valid, false);
});

Deno.test("validateInput: null body", () => {
  const result = validateInput(null);
  assertEquals(result.valid, false);
});

// ── Auth Tests ──

Deno.test("auth: rejects missing token", () => {
  const req = new Request("http://localhost/test", { method: "POST" });
  assertEquals(authenticateServiceRequest(req), false);
});

Deno.test("auth: accepts enrichment secret via x-api-key", () => {
  const req = new Request("http://localhost/test", {
    method: "POST",
    headers: { "x-api-key": "test_enrich_secret" },
  });
  assertEquals(authenticateServiceRequest(req), true);
});

Deno.test("auth: accepts service role key via Bearer", () => {
  const req = new Request("http://localhost/test", {
    method: "POST",
    headers: { "authorization": "Bearer test-service-role-key" },
  });
  assertEquals(authenticateServiceRequest(req), true);
});

Deno.test("auth: accepts n8n shared secret via Bearer", () => {
  const req = new Request("http://localhost/test", {
    method: "POST",
    headers: { "authorization": "Bearer test_shared_secret" },
  });
  assertEquals(authenticateServiceRequest(req), true);
});

Deno.test("auth: rejects invalid token", () => {
  const req = new Request("http://localhost/test", {
    method: "POST",
    headers: { "authorization": "Bearer wrong-token" },
  });
  assertEquals(authenticateServiceRequest(req), false);
});
