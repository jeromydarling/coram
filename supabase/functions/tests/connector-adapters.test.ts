/**
 * Deno tests for connector adapters (Salesforce + Airtable).
 *
 * WHAT: Validates normalization logic, edge cases, and warning generation.
 * WHERE: supabase/functions/tests/
 * WHY: Proves CRM mapping is deterministic and handles dirty data gracefully.
 */
import { assertEquals, assertExists, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";

// Import adapters — these are pure functions, no network needed
// Path is relative from supabase/functions/tests/ → project root src/
import { salesforceAdapter } from "../../../src/integrations/connectors/salesforceAdapter.ts";
import { airtableAdapter } from "../../../src/integrations/connectors/airtableAdapter.ts";
import { normalizeDate, safeSnippet, normalizeState } from "../../../src/integrations/connectors/types.ts";

// ─── normalizeDate ───

Deno.test("normalizeDate: ISO date passes through", () => {
  const { date, warning } = normalizeDate("2024-06-15T10:00:00.000Z");
  assertExists(date);
  assertEquals(warning, null);
});

Deno.test("normalizeDate: MM/DD/YYYY normalizes with warning", () => {
  const { date, warning } = normalizeDate("06/15/2024");
  assertExists(date);
  assertExists(warning);
  assert(warning!.includes("Normalized"));
});

Deno.test("normalizeDate: empty returns null without warning", () => {
  const { date, warning } = normalizeDate("");
  assertEquals(date, null);
  assertEquals(warning, null);
});

Deno.test("normalizeDate: garbage returns null with warning", () => {
  const { date, warning } = normalizeDate("not-a-date");
  assertEquals(date, null);
  assertExists(warning);
  assert(warning!.includes("Invalid"));
});

Deno.test("normalizeDate: YYYY/MM/DD normalizes", () => {
  const { date, warning } = normalizeDate("2024/06/15");
  assertExists(date);
  assertExists(warning);
});

// ─── safeSnippet ───

Deno.test("safeSnippet: truncates long text", () => {
  const long = "a".repeat(300);
  const result = safeSnippet(long);
  assertExists(result);
  assert(result!.length <= 200);
  assert(result!.endsWith("..."));
});

Deno.test("safeSnippet: returns null for empty", () => {
  assertEquals(safeSnippet(null), null);
  assertEquals(safeSnippet(""), null);
});

Deno.test("safeSnippet: preserves short text", () => {
  assertEquals(safeSnippet("hello"), "hello");
});

// ─── normalizeState ───

Deno.test("normalizeState: Texas → TX", () => {
  assertEquals(normalizeState("Texas"), "TX");
  assertEquals(normalizeState("texas"), "TX");
  assertEquals(normalizeState("TX"), "TX");
  assertEquals(normalizeState("Tx"), "TX");
});

Deno.test("normalizeState: null returns null", () => {
  assertEquals(normalizeState(null), null);
  assertEquals(normalizeState(""), null);
});

// ─── Salesforce Adapter ───

Deno.test("SF: normalizeAccount — valid record", () => {
  const { result, warnings } = salesforceAdapter.normalizeAccount({
    Id: "001A", Name: "Grace Fellowship", Website: "https://grace.org",
    Phone: "(512) 555-1000", BillingCity: "Austin", BillingState: "TX",
  });
  assertExists(result);
  assertEquals(result!.organization, "Grace Fellowship");
  assertEquals(result!.state, "TX");
  assertEquals(warnings.length, 0);
});

Deno.test("SF: normalizeAccount — missing name returns null", () => {
  const { result, warnings } = salesforceAdapter.normalizeAccount({ Id: "001" });
  assertEquals(result, null);
  assertEquals(warnings.length, 1);
  assertEquals(warnings[0].type, "missing_required");
});

Deno.test("SF: normalizeAccount — state normalization warning", () => {
  const { result, warnings } = salesforceAdapter.normalizeAccount({
    Id: "001", Name: "Test Org", BillingState: "Texas",
  });
  assertExists(result);
  assertEquals(result!.state, "TX");
  assert(warnings.some(w => w.type === "normalization"));
});

Deno.test("SF: normalizeContact — valid record", () => {
  const { result, warnings } = salesforceAdapter.normalizeContact({
    Id: "003", AccountId: "001", FirstName: "María", LastName: "González",
    Email: "Maria@Test.COM", Phone: "(512) 555-0001",
  });
  assertExists(result);
  assertEquals(result!.name, "María González");
  assertEquals(result!.email, "maria@test.com"); // lowercased
});

Deno.test("SF: normalizeContact — orphan without AccountId", () => {
  const { result, warnings } = salesforceAdapter.normalizeContact({
    Id: "003", FirstName: "David", LastName: "Lee", Email: "d@test.com",
  });
  assertExists(result);
  assert(warnings.some(w => w.type === "orphan_contact"));
});

Deno.test("SF: normalizeContact — missing name returns null", () => {
  const { result, warnings } = salesforceAdapter.normalizeContact({ Id: "003" });
  assertEquals(result, null);
  assert(warnings.some(w => w.type === "missing_required"));
});

Deno.test("SF: normalizeContact — placeholder title removed", () => {
  const { result, warnings } = salesforceAdapter.normalizeContact({
    Id: "003", AccountId: "001", FirstName: "Test", LastName: "User", Title: "(no title)",
  });
  assertExists(result);
  assertEquals(result!.title, null);
  assert(warnings.some(w => w.type === "normalization"));
});

Deno.test("SF: normalizeTask — valid record", () => {
  const { result } = salesforceAdapter.normalizeTask({
    Id: "00T", Subject: "Follow up call", WhoId: "003", WhatId: "001",
    ActivityDate: "2024-06-15", Status: "Open", Priority: "High",
  });
  assertExists(result);
  assertEquals(result!.title, "Follow up call");
});

Deno.test("SF: normalizeTask — missing subject returns null", () => {
  const { result, warnings } = salesforceAdapter.normalizeTask({ Id: "00T" });
  assertEquals(result, null);
  assert(warnings.some(w => w.type === "missing_required"));
});

Deno.test("SF: normalizeTask — non-ISO date produces warning", () => {
  const { result, warnings } = salesforceAdapter.normalizeTask({
    Id: "00T", Subject: "Test", ActivityDate: "06/15/2024",
  });
  assertExists(result);
  assert(warnings.some(w => w.type === "invalid_date"));
});

Deno.test("SF: normalizeEvent — valid record", () => {
  const { result } = salesforceAdapter.normalizeEvent({
    Id: "00U", Subject: "Team Meeting", StartDateTime: "2024-06-15T10:00:00Z",
    EndDateTime: "2024-06-15T11:00:00Z", Location: "Room 101",
  });
  assertExists(result);
  assertEquals(result!.event_name, "Team Meeting");
  assertEquals(result!.location, "Room 101");
});

Deno.test("SF: normalizeActivity — valid note", () => {
  const { result } = salesforceAdapter.normalizeActivity({
    Id: "002", Title: "Meeting Notes", Body: "Discussed partnership terms.",
    ParentId: "001", CreatedDate: "2024-06-15T10:00:00Z",
  });
  assertExists(result);
  assertEquals(result!.title, "Meeting Notes");
  assertEquals(result!.body_snippet, "Discussed partnership terms.");
});

// ─── Airtable Adapter ───

Deno.test("AT: normalizeAccount — valid record", () => {
  const { result } = airtableAdapter.normalizeAccount({
    id: "rec123", Name: "Community Hub", Website: "https://hub.org", City: "Dallas", State: "TX",
  });
  assertExists(result);
  assertEquals(result!.organization, "Community Hub");
});

Deno.test("AT: normalizeContact — orphan warning", () => {
  const { result, warnings } = airtableAdapter.normalizeContact({
    id: "rec456", Name: "Jane Doe", Email: "jane@test.com",
  });
  assertExists(result);
  assert(warnings.some(w => w.type === "orphan_contact"));
});

Deno.test("AT: normalizeTask — valid record", () => {
  const { result } = airtableAdapter.normalizeTask({
    id: "rec789", Name: "Review proposal", Status: "In Progress", "Due Date": "2024-12-01",
  });
  assertExists(result);
  assertEquals(result!.title, "Review proposal");
});

Deno.test("AT: normalizeEvent — valid record", () => {
  const { result } = airtableAdapter.normalizeEvent({
    id: "recABC", "Event Name": "Gala Night", "Start Date": "2024-11-15", Location: "Convention Center",
  });
  assertExists(result);
  assertEquals(result!.event_name, "Gala Night");
});

Deno.test("AT: normalizeActivity — missing title returns null", () => {
  const { result, warnings } = airtableAdapter.normalizeActivity({ id: "recXYZ" });
  assertEquals(result, null);
  assert(warnings.some(w => w.type === "missing_required"));
});

// ─── Privacy: no PII in snippets ───

Deno.test("safeSnippet: does not expand PII (just truncates)", () => {
  const input = "Contact john@example.com at 512-555-1234 for details about the program.";
  const result = safeSnippet(input);
  // safeSnippet is a truncation tool, not a PII scrubber — but it should not crash
  assertExists(result);
  assertEquals(typeof result, "string");
});
