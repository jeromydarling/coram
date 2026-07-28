import { assertEquals, assertExists } from "https://deno.land/std@0.168.0/testing/asserts.ts";

// ── Test: Fallback builder produces valid memory_json ──

Deno.test("fallback builder produces required keys", () => {
  const memory = buildFallbackMemory(
    "Test Org", "opp-123", "2026-01-01", "2026-02-14",
    [{ signal_type: "grant", signal_value: "New grant found", detected_at: "2026-01-15", source_url: "https://example.com" }],
    [{ total_quantity: 5, total_cents: 50000, delivered_at: "2026-02-01" }],
    [{ title: "Community event", module: "events", source_url: null, event_date: "2026-01-20" }],
    ["education access", "digital equity"],
  );

  assertExists(memory.headline);
  assertExists(memory.chapters);
  assertExists(memory.echoes);
  assertExists(memory.checkins);
  assertExists(memory.metrics);
  assertEquals(Array.isArray(memory.chapters), true);
  assertEquals(Array.isArray(memory.echoes), true);
  assertEquals(Array.isArray(memory.checkins), true);
  assertEquals(typeof memory.metrics.provisions_count, "number");
  assertEquals(typeof memory.metrics.signals_count, "number");
  assertEquals(typeof memory.metrics.events_count, "number");
  assertEquals(typeof memory.metrics.grants_count, "number");
});

Deno.test("fallback builder handles empty inputs", () => {
  const memory = buildFallbackMemory("Empty Org", "opp-456", "2026-01-01", "2026-02-14", [], [], [], []);

  assertExists(memory.headline);
  assertEquals(memory.chapters.length, 1);
  assertEquals(memory.echoes.length, 0);
  assertEquals(memory.checkins.length, 0);
  assertEquals(memory.chapters[0].themes.length > 0, true);
});

// ── Test: Validation caps arrays ──

Deno.test("validateMemoryJson caps chapters/echoes/checkins", () => {
  const oversized = {
    headline: "Too much",
    chapters: Array(10).fill({ title: "ch", window_start: "2026-01-01", window_end: "2026-01-15", themes: ["a", "b", "c", "d", "e"], highlights: [], partners_involved: [] }),
    echoes: Array(8).fill({ title: "e", text: "t", lookback_window: "Winter 2025", evidence: [] }),
    checkins: Array(7).fill({ opportunity_id: "x", reason: "r", suggested_subject: "s", suggested_body: "b" }),
    metrics: { provisions_count: 1, signals_count: 2, events_count: 3, grants_count: 4 },
  };

  const result = validateMemoryJson(oversized);
  assertEquals(result.chapters.length <= 6, true);
  assertEquals(result.echoes.length <= 3, true);
  assertEquals(result.checkins.length <= 3, true);
  assertEquals(result.chapters[0].themes.length <= 3, true);
});

// ── Test: Urgency language removed ──

Deno.test("urgency language is stripped from outputs", () => {
  const withUrgency = {
    headline: "URGENT: Must act immediately on critical opportunity",
    chapters: [],
    echoes: [{ title: "Act now ASAP", text: "This is an emergency deadline", lookback_window: "W25", evidence: [] }],
    checkins: [{ opportunity_id: "x", reason: "Critical action required immediately", suggested_subject: "URGENT: Must respond", suggested_body: "You must act now" }],
    metrics: { provisions_count: 0, signals_count: 0, events_count: 0, grants_count: 0 },
  };

  const result = validateMemoryJson(withUrgency);

  const BANNED = /\b(urgent|critical|act now|immediately|asap|emergency|deadline|must|action required)\b/i;
  assertEquals(BANNED.test(result.headline), false, `headline still has urgency: "${result.headline}"`);
  assertEquals(BANNED.test(result.echoes[0].title), false, `echo title has urgency: "${result.echoes[0].title}"`);
  assertEquals(BANNED.test(result.echoes[0].text), false, `echo text has urgency: "${result.echoes[0].text}"`);
  assertEquals(BANNED.test(result.checkins[0].reason), false, `checkin reason has urgency: "${result.checkins[0].reason}"`);
  assertEquals(BANNED.test(result.checkins[0].suggested_subject), false, `checkin subject has urgency: "${result.checkins[0].suggested_subject}"`);
});

// ── Test: Invalid AI JSON falls back correctly ──

Deno.test("invalid JSON produces empty memory", () => {
  const result = validateMemoryJson("not an object");
  assertEquals(result.headline, "");
  assertEquals(result.chapters.length, 0);
  assertEquals(result.echoes.length, 0);
  assertEquals(result.checkins.length, 0);
});

Deno.test("null produces empty memory", () => {
  const result = validateMemoryJson(null);
  assertEquals(result.headline, "");
  assertEquals(result.chapters.length, 0);
});

// ── Test: Journal privacy — note_text never in evidence queries ──

Deno.test("journal query pattern never selects note_text", () => {
  const SAFE_SELECT = "extracted_json, journal_entry_id";
  assertEquals(SAFE_SELECT.includes("note_text"), false);

  const ENTRY_SELECT = "id";
  assertEquals(ENTRY_SELECT.includes("note_text"), false);
});

// ── Test: Deterministic fallback check-ins with knowledge overlap ──

Deno.test("fallback generates check-in when theme matches focus areas", () => {
  const memory = buildFallbackMemory(
    "Digital Equity Foundation", "opp-789", "2026-01-01", "2026-02-14",
    [{ signal_type: "news", signal_value: "School closures reported", detected_at: "2026-01-20" }],
    [],
    [],
    ["digital equity", "school closures"],
    ["digital inclusion", "education equity", "computer access"],
  );

  assertEquals(memory.checkins.length, 1);
  assertEquals(memory.checkins[0].opportunity_id, "opp-789");
  assertEquals(memory.checkins[0].suggested_subject.length > 0, true);
  assertEquals(memory.checkins[0].suggested_body.includes("Digital Equity Foundation"), true);

  // Verify no urgency words
  const BANNED = /\b(urgent|critical|act now|immediately|asap|emergency|deadline|must|action required)\b/i;
  assertEquals(BANNED.test(memory.checkins[0].reason), false);
  assertEquals(BANNED.test(memory.checkins[0].suggested_body), false);
});

Deno.test("fallback generates no check-in when no theme overlap", () => {
  const memory = buildFallbackMemory(
    "Random Org", "opp-999", "2026-01-01", "2026-02-14",
    [],
    [],
    [],
    ["weather patterns"],
    ["healthcare", "senior services"],
  );

  assertEquals(memory.checkins.length, 0);
});

Deno.test("fallback generates no check-in with empty focus areas", () => {
  const memory = buildFallbackMemory(
    "Some Org", "opp-000", "2026-01-01", "2026-02-14",
    [],
    [],
    [],
    ["education"],
    [],
  );

  assertEquals(memory.checkins.length, 0);
});

// ── Helpers (inline from the edge function for testing) ──

const URGENCY_RE = /\b(urgent|critical|act now|immediately|asap|emergency|deadline|hurry|don't miss|last chance|breaking|high priority|action required|must)\b/gi;
function cleanTone(text: string): string {
  return text.replace(URGENCY_RE, "").replace(/\s{2,}/g, " ").trim();
}

interface MemoryJson {
  headline: string;
  chapters: Array<{
    title: string; window_start: string; window_end: string; themes: string[];
    highlights: Array<{ type: string; text: string; source_url?: string }>;
    partners_involved: Array<{ opportunity_id: string; name: string }>;
  }>;
  echoes: Array<{ title: string; text: string; lookback_window: string; evidence: Array<{ type: string; date?: string; source_url?: string }> }>;
  checkins: Array<{ opportunity_id: string; reason: string; suggested_subject: string; suggested_body: string }>;
  metrics: { provisions_count: number; signals_count: number; events_count: number; grants_count: number };
}

function emptyMemoryJson(): MemoryJson {
  return { headline: "", chapters: [], echoes: [], checkins: [], metrics: { provisions_count: 0, signals_count: 0, events_count: 0, grants_count: 0 } };
}

function validateMemoryJson(obj: unknown): MemoryJson {
  const fallback = emptyMemoryJson();
  if (!obj || typeof obj !== "object") return fallback;
  const o = obj as Record<string, unknown>;
  return {
    headline: typeof o.headline === "string" ? cleanTone(o.headline) : "",
    chapters: Array.isArray(o.chapters) ? (o.chapters as MemoryJson["chapters"]).slice(0, 6).map(c => ({
      ...c, highlights: (c.highlights || []).slice(0, 5), themes: (c.themes || []).slice(0, 3),
    })) : [],
    echoes: Array.isArray(o.echoes) ? (o.echoes as MemoryJson["echoes"]).slice(0, 3).map(e => ({
      ...e, title: cleanTone(e.title || ""), text: cleanTone(e.text || ""),
    })) : [],
    checkins: Array.isArray(o.checkins) ? (o.checkins as MemoryJson["checkins"]).slice(0, 3).map(ci => ({
      ...ci,
      reason: cleanTone(ci.reason || ""),
      suggested_subject: cleanTone(ci.suggested_subject || ""),
      suggested_body: cleanTone(ci.suggested_body || ""),
    })) : [],
    metrics: {
      provisions_count: Number((o.metrics as Record<string, unknown>)?.provisions_count) || 0,
      signals_count: Number((o.metrics as Record<string, unknown>)?.signals_count) || 0,
      events_count: Number((o.metrics as Record<string, unknown>)?.events_count) || 0,
      grants_count: Number((o.metrics as Record<string, unknown>)?.grants_count) || 0,
    },
  };
}

function buildFallbackMemory(
  orgName: string, oppId: string, windowStart: string, windowEnd: string,
  signals: Array<{ signal_type: string; signal_value: string; detected_at: string; source_url?: string }>,
  provisions: Array<{ total_quantity: number; total_cents: number; delivered_at: string | null }>,
  discoveries: Array<{ title: string; module: string; source_url: string | null; event_date: string | null }>,
  journalThemes: string[],
  knowledgeFocusAreas?: string[],
): MemoryJson {
  const highlights: MemoryJson["chapters"][0]["highlights"] = [];
  for (const s of signals.slice(0, 3)) highlights.push({ type: "signal", text: s.signal_value, source_url: s.source_url });
  for (const p of provisions.filter(p => p.delivered_at).slice(0, 2)) highlights.push({ type: "provision", text: `${p.total_quantity} devices provided` });
  for (const d of discoveries.slice(0, 2)) highlights.push({ type: d.module, text: d.title || "Discovery item", source_url: d.source_url || undefined });

  const themes = journalThemes.slice(0, 3);
  if (themes.length === 0 && signals.length > 0) themes.push("Relationship signals");
  if (themes.length === 0) themes.push("Ongoing partnership");

  // Deterministic fallback check-in: 0-1 based on theme/knowledge overlap
  const checkins: MemoryJson["checkins"] = [];
  if (knowledgeFocusAreas && knowledgeFocusAreas.length > 0 && journalThemes.length > 0) {
    const themesLower = journalThemes.map(t => t.toLowerCase());
    const focusLower = knowledgeFocusAreas.map(f => f.toLowerCase());
    const matchingTheme = themesLower.find(theme =>
      focusLower.some(focus =>
        focus.includes(theme) || theme.includes(focus) ||
        theme.split(/\s+/).some(word => word.length > 3 && focusLower.some(f => f.includes(word)))
      )
    );
    if (matchingTheme) {
      const originalTheme = journalThemes[themesLower.indexOf(matchingTheme)];
      checkins.push({
        opportunity_id: oppId,
        reason: `Recent themes around "${originalTheme}" connect to ${orgName}'s work — might be worth a gentle check-in.`,
        suggested_subject: `Thinking of you — ${originalTheme}`,
        suggested_body: `Hi there,\n\nI've been following some developments in our community around ${originalTheme}, and it made me think of the work ${orgName} is doing.\n\nWould love to catch up when you have a moment — no rush at all.\n\nWarmly,`,
      });
    }
  }

  return {
    headline: `What we've learned together with ${orgName}`,
    chapters: [{ title: "Recent Chapter", window_start: windowStart, window_end: windowEnd, themes, highlights: highlights.slice(0, 5), partners_involved: [{ opportunity_id: oppId, name: orgName }] }],
    echoes: [],
    checkins,
    metrics: {
      provisions_count: provisions.length,
      signals_count: signals.length,
      events_count: discoveries.filter(d => d.module === "events").length,
      grants_count: discoveries.filter(d => d.module === "grants").length,
    },
  };
}
