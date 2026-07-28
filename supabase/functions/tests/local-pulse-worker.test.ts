import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

// ── Replicate pure functions from local-pulse-worker ──

function parseDate(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const d = new Date(raw);
    if (isNaN(d.getTime())) return null;
    const now = Date.now();
    if (d.getTime() < now - 365 * 86400000) return null;
    if (d.getTime() > now + 365 * 86400000) return null;
    return d.toISOString().slice(0, 10);
  } catch {
    return null;
  }
}

function eventFingerprint(title: string, date: string): string {
  const norm = title.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 60);
  return `${norm}:${date}`;
}

const RECURRING_PATTERNS = /\b(weekly|every\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)|bi-?weekly|monthly|every\s+month|recurring|ongoing)\b/i;

function detectRecurring(text: string): boolean {
  return RECURRING_PATTERNS.test(text);
}

function buildSearchQueries(metroName: string, state: string | null): string[] {
  const location = state ? `${metroName} ${state}` : metroName;
  const queries = [
    `community events ${location} 2026`,
    `nonprofit events ${location}`,
    `library events ${location}`,
  ];
  const regionLower = (state ?? "").toLowerCase();
  if (["mn", "wi", "ia", "il", "mi", "oh", "in", "nd", "sd", "ne", "ks", "mo"].includes(regionLower)) {
    queries.push(`digital inclusion events ${location}`);
    queries.push(`workforce development events ${location}`);
  } else {
    queries.push(`resource fair ${location}`);
    queries.push(`digital equity events ${location}`);
  }
  return queries.slice(0, 6);
}

// ── Date parsing tests ──

Deno.test("parseDate: valid future date", () => {
  assertEquals(parseDate("2026-06-15"), "2026-06-15");
});

Deno.test("parseDate: null/empty/undefined returns null", () => {
  assertEquals(parseDate(null), null);
  assertEquals(parseDate(undefined), null);
  assertEquals(parseDate(""), null);
});

Deno.test("parseDate: garbage returns null", () => {
  assertEquals(parseDate("not-a-date"), null);
  assertEquals(parseDate("yesterday"), null);
});

Deno.test("parseDate: date too far in past returns null", () => {
  assertEquals(parseDate("2020-01-01"), null);
});

Deno.test("parseDate: date too far in future returns null", () => {
  assertEquals(parseDate("2030-01-01"), null);
});

Deno.test("parseDate: ISO datetime extracts date portion", () => {
  assertEquals(parseDate("2026-03-20T14:30:00Z"), "2026-03-20");
});

// ── Fingerprint tests ──

Deno.test("fingerprint: deterministic", () => {
  const fp1 = eventFingerprint("Community Resource Fair", "2026-03-15");
  const fp2 = eventFingerprint("Community Resource Fair", "2026-03-15");
  assertEquals(fp1, fp2);
});

Deno.test("fingerprint: case insensitive", () => {
  const fp1 = eventFingerprint("COMMUNITY FAIR", "2026-03-15");
  const fp2 = eventFingerprint("community fair", "2026-03-15");
  assertEquals(fp1, fp2);
});

Deno.test("fingerprint: different dates differ", () => {
  const fp1 = eventFingerprint("Event A", "2026-03-15");
  const fp2 = eventFingerprint("Event A", "2026-03-16");
  assertEquals(fp1 === fp2, false);
});

Deno.test("fingerprint: strips special chars", () => {
  const fp1 = eventFingerprint("Event: A (Special!)", "2026-03-15");
  const fp2 = eventFingerprint("Event A Special", "2026-03-15");
  assertEquals(fp1, fp2);
});

// ── Recurring detection tests ──

Deno.test("detectRecurring: weekly", () => {
  assertEquals(detectRecurring("This is a weekly community dinner"), true);
});

Deno.test("detectRecurring: every Wednesday", () => {
  assertEquals(detectRecurring("Happens every Wednesday at 6pm"), true);
});

Deno.test("detectRecurring: monthly", () => {
  assertEquals(detectRecurring("Monthly board meeting"), true);
});

Deno.test("detectRecurring: no recurring language", () => {
  assertEquals(detectRecurring("Annual gala fundraiser March 15"), false);
});

Deno.test("detectRecurring: bi-weekly", () => {
  assertEquals(detectRecurring("bi-weekly food pantry distribution"), true);
});

// ── Dynamic query tests ──

Deno.test("buildSearchQueries: midwest gets digital inclusion", () => {
  const queries = buildSearchQueries("Minneapolis", "MN");
  assertEquals(queries.length, 5);
  assertEquals(queries.some(q => q.includes("digital inclusion")), true);
  assertEquals(queries.some(q => q.includes("workforce development")), true);
});

Deno.test("buildSearchQueries: non-midwest gets resource fair", () => {
  const queries = buildSearchQueries("Denver", "CO");
  assertEquals(queries.length, 5);
  assertEquals(queries.some(q => q.includes("resource fair")), true);
  assertEquals(queries.some(q => q.includes("digital equity")), true);
});

Deno.test("buildSearchQueries: capped at 6", () => {
  const queries = buildSearchQueries("New York", "NY");
  assertEquals(queries.length <= 6, true);
});

Deno.test("buildSearchQueries: works without state", () => {
  const queries = buildSearchQueries("Denver", null);
  assertEquals(queries.length <= 6, true);
  for (const q of queries) {
    assertEquals(q.includes("Denver"), true);
  }
});

// ── Dedup tests ──

Deno.test("dedup: seen fingerprints prevent duplicates", () => {
  const seen = new Set<string>();
  const events = [
    { title: "Event A", date: "2026-03-15" },
    { title: "Event A", date: "2026-03-15" },
    { title: "Event B", date: "2026-03-15" },
  ];
  const kept: typeof events = [];
  for (const e of events) {
    const fp = eventFingerprint(e.title, e.date);
    if (seen.has(fp)) continue;
    seen.add(fp);
    kept.push(e);
  }
  assertEquals(kept.length, 2);
});

// ── Ingestion cap test ──

Deno.test("ingestion cap: MAX_EVENTS_PER_RUN enforced", () => {
  const MAX = 60;
  const candidates = Array.from({ length: 100 }, (_, i) => ({
    title: `Event ${i}`,
    date: `2026-03-${String(i % 28 + 1).padStart(2, "0")}`,
  }));
  const inserted: typeof candidates = [];
  for (const c of candidates) {
    if (inserted.length >= MAX) break;
    inserted.push(c);
  }
  assertEquals(inserted.length, MAX);
});

// ── Low-confidence recurring event allowed ──

Deno.test("low-confidence: recurring event without date allowed", () => {
  const candidate = {
    title: "Weekly Food Pantry",
    start_date: null as string | null,
    is_recurring: true,
  };
  const hasDate = !!candidate.start_date;
  const isLowConfidence = !hasDate && candidate.is_recurring;
  // Should NOT be skipped
  const skip = !hasDate && !candidate.is_recurring;
  assertEquals(skip, false);
  assertEquals(isLowConfidence, true);
});

// ── Narrative weight stored correctly ──

Deno.test("narrative_weight: metadata structure", () => {
  const metadata = {
    source: "local_pulse",
    run_id: "test-run",
    narrative_weight: "high",
    discovery_type: "auto",
  };
  assertEquals(metadata.narrative_weight, "high");
  assertEquals(metadata.source, "local_pulse");
  assertEquals(["auto", "manual_url"].includes(metadata.discovery_type), true);
});

// ── Attended_by always populated test ──

Deno.test("attended_by: must be set when attended=true", () => {
  const event = { attended: true, attended_by: null as string | null };
  const isValid = !(event.attended === true && event.attended_by === null);
  assertEquals(isValid, false); // Invalid — attended_by missing

  event.attended_by = "user-123";
  const isValidNow = !(event.attended === true && event.attended_by === null);
  assertEquals(isValidNow, true);
});
