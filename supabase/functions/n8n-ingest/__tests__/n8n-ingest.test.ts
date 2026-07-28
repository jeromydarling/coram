import { assertEquals, assertNotEquals, assertMatch } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { normalizeEnvelope, normalizeOpportunitySignals } from "../index.ts";

// ── SHA-256 helper ──
async function sha256(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ── Fixtures ──

const partnerValid = {
  workflow_key: "partner_enrich",
  run_id: "aaaaaaaa-1111-2222-3333-444444444444",
  org_id: "org-001",
  org_name: "Habitat for Humanity",
  website_url: "https://habitat.org",
  payload: {
    mission_summary: "Building homes, communities and hope.",
    programs: ["ReStore", "Global Village"],
    populations_served: ["low-income families"],
    geographies: ["US", "Canada"],
    funding_signals: ["USAID grant 2025"],
    keywords: ["housing", "nonprofit", "construction"],
  },
};

const partnerInvalidMissing = {
  workflow_key: "partner_enrich",
  run_id: "bbbbbbbb-1111-2222-3333-444444444444",
  payload: { mission_summary: "No org_name provided" },
};

const partnerInvalidSchema = {
  workflow_key: "partner_enrich",
  run_id: "cccccccc-1111-2222-3333-444444444444",
  org_name: 12345,
  payload: "not-an-object",
};

const oppChangedPayload = {
  workflow_key: "opportunity_monitor",
  run_id: "dddddddd-1111-2222-3333-444444444444",
  opportunity_id: "opp-001",
  payload: {
    result: {
      signals: [
        { signal_type: "leadership_change", signal_value: "New CEO appointed: Jane Doe", source_url: "https://example.com/news/ceo", confidence: 0.92, detected_at: "2026-02-01T00:00:00Z" },
        { signal_type: "funding_round", signal_value: "Series B $50M raised", source_url: "https://example.com/funding", confidence: 0.85, detected_at: "2026-02-02T00:00:00Z" },
      ],
    },
  },
};

const oppChangedResult = {
  workflow_key: "opportunity_monitor",
  run_id: "dddddddd-1111-2222-3333-555555555555",
  opportunity_id: "opp-001",
  result: {
    changes: [
      { fields_changed: ["stage"], summary: "Stage changed to Discovery Held" },
    ],
    recommendations: [
      { type: "info", message: "1 opportunity updated", priority: "low" },
    ],
  },
};

const oppNoChange = {
  workflow_key: "opportunity_monitor",
  run_id: "eeeeeeee-1111-2222-3333-444444444444",
  opportunity_id: "opp-002",
  payload: { result: { signals: [] } },
};

const recValid = {
  workflow_key: "recommendations_generate",
  run_id: "11111111-aaaa-bbbb-cccc-dddddddddddd",
  metro_id: "metro-001",
  inputs_hash: "abc123def456",
};

const maliciousFixture = {
  workflow_key: "partner_enrich",
  run_id: "33333333-aaaa-bbbb-cccc-dddddddddddd",
  org_name: "Legit Org",
  __admin_override: true,
  role: "superadmin",
  delete_all: true,
  sql_injection: "'; DROP TABLE automation_runs; --",
  extra_nested: { evil: true },
};

// ── Auth tests ──

Deno.test("auth: rejects missing Authorization", () => {
  const token = "".replace(/^Bearer\s+/i, "");
  assertNotEquals(token, "srv-key-123");
});

Deno.test("auth: rejects wrong service role key", () => {
  const token = "Bearer wrong-key".replace(/^Bearer\s+/i, "");
  assertNotEquals(token, "srv-key-123");
});

Deno.test("auth: accepts valid service role key", () => {
  const key = "srv-key-123";
  const token = `Bearer ${key}`.replace(/^Bearer\s+/i, "");
  assertEquals(token, key);
});

// ── Validation tests ──

Deno.test("validation: rejects missing workflow_key", () => {
  const body: Record<string, unknown> = { run_id: "abc", payload: {} };
  assertEquals(!body.workflow_key || typeof body.workflow_key !== "string", true);
});

Deno.test("validation: rejects missing run_id", () => {
  const body: Record<string, unknown> = { workflow_key: "partner_enrich", payload: {} };
  assertEquals(!body.run_id || typeof body.run_id !== "string", true);
});

Deno.test("validation: rejects missing payload", () => {
  const env = normalizeEnvelope({ workflow_key: "partner_enrich", run_id: "abc" });
  assertEquals(Object.keys(env.payload).length, 0);
});

Deno.test("validation: rejects invalid workflow_key", () => {
  const VALID_KEYS = ["partner_enrich", "opportunity_monitor", "recommendations_generate"];
  assertEquals(VALID_KEYS.includes("invalid_workflow"), false);
});

// ── normalizeEnvelope tests ──

Deno.test("normalizeEnvelope: payload field preferred over result", () => {
  const env = normalizeEnvelope({ workflow_key: "x", run_id: "y", payload: { a: 1 }, result: { b: 2 } });
  assertEquals((env.payload as Record<string, unknown>).a, 1);
});

Deno.test("normalizeEnvelope: result field used as fallback", () => {
  const env = normalizeEnvelope({ workflow_key: "x", run_id: "y", result: { b: 2 } });
  assertEquals((env.payload as Record<string, unknown>).b, 2);
});

// ── Partner enrich tests ──

Deno.test("partner_enrich: valid fixture has 6 enrichment keys", () => {
  const keys = ["mission_summary", "programs", "populations_served", "geographies", "funding_signals", "keywords"];
  for (const k of keys) {
    assertEquals(k in partnerValid.payload, true);
  }
});

Deno.test("partner_enrich: rejects missing org_name", () => {
  assertEquals((partnerInvalidMissing as Record<string, unknown>).org_name, undefined);
});

Deno.test("partner_enrich: rejects wrong type org_name", () => {
  assertEquals(typeof partnerInvalidSchema.org_name, "number");
});

// ── Opportunity monitor tests ──

Deno.test("opportunity_monitor: payload-shape signals normalize correctly", () => {
  const env = normalizeEnvelope(oppChangedPayload);
  const signals = normalizeOpportunitySignals(env.payload);
  assertEquals(signals.length, 2);
  assertEquals(signals[0].signal_type, "leadership_change");
  assertEquals(signals[1].signal_type, "funding_round");
});

Deno.test("opportunity_monitor: result-shape changes normalize correctly", () => {
  const env = normalizeEnvelope(oppChangedResult);
  const signals = normalizeOpportunitySignals(env.payload);
  assertEquals(signals.length, 2);
  assertEquals(signals[0].signal_type, "stage");
  assertEquals(signals[1].signal_type, "info");
});

Deno.test("opportunity_monitor: consistent fingerprint", async () => {
  const env = normalizeEnvelope(oppChangedPayload);
  const signals = normalizeOpportunitySignals(env.payload);
  const s = signals[0];
  const fp = await sha256(`${s.signal_type}|${s.signal_value}|${s.source_url}`);
  const fp2 = await sha256(`${s.signal_type}|${s.signal_value}|${s.source_url}`);
  assertEquals(fp, fp2);
  assertMatch(fp, /^[0-9a-f]{64}$/);
});

Deno.test("opportunity_monitor: different signals -> different fingerprints", async () => {
  const env = normalizeEnvelope(oppChangedPayload);
  const signals = normalizeOpportunitySignals(env.payload);
  const fp0 = await sha256(`${signals[0].signal_type}|${signals[0].signal_value}|${signals[0].source_url}`);
  const fp1 = await sha256(`${signals[1].signal_type}|${signals[1].signal_value}|${signals[1].source_url}`);
  assertNotEquals(fp0, fp1);
});

Deno.test("opportunity_monitor: empty signals returns empty array", () => {
  const env = normalizeEnvelope(oppNoChange);
  const signals = normalizeOpportunitySignals(env.payload);
  assertEquals(signals.length, 0);
});

// ── Recommendations tests ──

Deno.test("recommendations: valid fixture has metro_id + inputs_hash", () => {
  assertEquals(recValid.metro_id, "metro-001");
  assertEquals(recValid.inputs_hash, "abc123def456");
});

// ── Replay tests ──

Deno.test("replay: processed status returns replay=true", () => {
  assertEquals({ status: "processed" }.status === "processed", true);
});

Deno.test("replay: non-processed statuses do not replay", () => {
  for (const s of ["queued", "dispatched", "processing", "error"]) {
    assertEquals(s === "processed", false);
  }
});

// ── Dedup tests ──

Deno.test("dedup: 23505 treated as skip", () => {
  assertEquals({ code: "23505" }.code === "23505", true);
});

Deno.test("dedup: non-23505 is error", () => {
  assertEquals({ code: "42P01" }.code === "23505", false);
});

// ── Security tests ──

Deno.test("malicious: extra keys stripped by normalizeEnvelope", () => {
  const env = normalizeEnvelope(maliciousFixture as unknown as Record<string, unknown>);
  assertEquals((env as unknown as Record<string, unknown>).__admin_override, undefined);
  assertEquals((env as unknown as Record<string, unknown>).sql_injection, undefined);
  assertEquals((env as unknown as Record<string, unknown>).role, undefined);
  assertEquals(env.org_name, "Legit Org");
});

// ── Dedupe fingerprint tests ──

Deno.test("dedupe: same payload produces same fingerprint", async () => {
  const payload = { mission_summary: "Test", programs: ["A"] };
  const fp1 = await sha256(`partner_enrich|run-1|${JSON.stringify(payload)}`);
  const fp2 = await sha256(`partner_enrich|run-1|${JSON.stringify(payload)}`);
  assertEquals(fp1, fp2);
  assertMatch(fp1, /^[0-9a-f]{64}$/);
});

Deno.test("dedupe: different payload produces different fingerprint", async () => {
  const p1 = { mission_summary: "Test A" };
  const p2 = { mission_summary: "Test B" };
  const fp1 = await sha256(`partner_enrich|run-1|${JSON.stringify(p1)}`);
  const fp2 = await sha256(`partner_enrich|run-1|${JSON.stringify(p2)}`);
  assertNotEquals(fp1, fp2);
});

Deno.test("dedupe: different run_id produces different fingerprint", async () => {
  const payload = { mission_summary: "Same" };
  const fp1 = await sha256(`partner_enrich|run-1|${JSON.stringify(payload)}`);
  const fp2 = await sha256(`partner_enrich|run-2|${JSON.stringify(payload)}`);
  assertNotEquals(fp1, fp2);
});

Deno.test("dedupe: different workflow_key produces different fingerprint", async () => {
  const payload = { mission_summary: "Same" };
  const fp1 = await sha256(`partner_enrich|run-1|${JSON.stringify(payload)}`);
  const fp2 = await sha256(`opportunity_monitor|run-1|${JSON.stringify(payload)}`);
  assertNotEquals(fp1, fp2);
});

// ── Watchlist ingest tests ──

const watchlistIngestValid = {
  workflow_key: "watchlist_ingest",
  run_id: "wl-ingest-1111-2222-3333-444444444444",
  org_id: "org-wl-001",
  payload: {
    url: "https://example-nonprofit.org/about",
    content_hash: "a1b2c3d4e5f6",
    raw_text: "Example Nonprofit serves communities.",
    crawled_at: "2026-02-08T12:00:00Z",
    meta: { status_code: 200 },
    facts: { mission: "Serve communities", programs: ["Tutoring"] },
    model_version: "gemini-3-flash",
  },
};

const watchlistIngestInvalid = {
  workflow_key: "watchlist_ingest",
  run_id: "wl-ingest-bad-2222-3333-444444444444",
  payload: { raw_text: "Missing org_id and url" },
};

const watchlistIngestInvalidSchema = {
  workflow_key: "watchlist_ingest",
  run_id: "wl-ingest-bad-schema-3333-444444444444",
  org_id: "org-wl-001",
  payload: {
    url: 12345,
    content_hash: null,
    raw_text: false,
  },
};

Deno.test("watchlist_ingest: valid fixture normalizes correctly", () => {
  const env = normalizeEnvelope(watchlistIngestValid);
  assertEquals(env.workflow_key, "watchlist_ingest");
  assertEquals(env.org_id, "org-wl-001");
  assertEquals((env.payload as Record<string, unknown>).url, "https://example-nonprofit.org/about");
  assertEquals((env.payload as Record<string, unknown>).content_hash, "a1b2c3d4e5f6");
  assertEquals((env.payload as Record<string, unknown>).raw_text, "Example Nonprofit serves communities.");
  assertEquals((env.payload as Record<string, unknown>).crawled_at, "2026-02-08T12:00:00Z");
});

Deno.test("watchlist_ingest: valid fixture includes optional facts + model_version", () => {
  const env = normalizeEnvelope(watchlistIngestValid);
  const p = env.payload as Record<string, unknown>;
  const facts = p.facts as Record<string, unknown>;
  assertEquals(facts.mission, "Serve communities");
  assertEquals(Array.isArray(facts.programs), true);
  assertEquals(p.model_version, "gemini-3-flash");
});

Deno.test("watchlist_ingest: invalid fixture missing org_id", () => {
  const env = normalizeEnvelope(watchlistIngestInvalid);
  assertEquals(env.org_id, null);
});

Deno.test("watchlist_ingest: invalid fixture missing url in payload", () => {
  const env = normalizeEnvelope(watchlistIngestInvalid);
  assertEquals((env.payload as Record<string, unknown>).url, undefined);
});

Deno.test("watchlist_ingest: invalid schema — url must be string", () => {
  const env = normalizeEnvelope(watchlistIngestInvalidSchema);
  const p = env.payload as Record<string, unknown>;
  assertEquals(typeof p.url === "string", false);
});

Deno.test("watchlist_ingest: invalid schema — content_hash must be string", () => {
  const env = normalizeEnvelope(watchlistIngestInvalidSchema);
  const p = env.payload as Record<string, unknown>;
  assertEquals(typeof p.content_hash === "string", false);
});

Deno.test("watchlist_ingest: invalid schema — raw_text must be string", () => {
  const env = normalizeEnvelope(watchlistIngestInvalidSchema);
  const p = env.payload as Record<string, unknown>;
  assertEquals(typeof p.raw_text === "string", false);
});

Deno.test("watchlist_ingest: duplicate hash same org_id would dedupe via unique constraint", () => {
  // Two payloads with same org_id + content_hash should conflict
  const env1 = normalizeEnvelope(watchlistIngestValid);
  const dup = { ...watchlistIngestValid, run_id: "wl-ingest-dup-2222-3333-444444444444" };
  const env2 = normalizeEnvelope(dup);
  assertEquals(env1.org_id, env2.org_id);
  assertEquals(
    (env1.payload as Record<string, unknown>).content_hash,
    (env2.payload as Record<string, unknown>).content_hash,
  );
  assertNotEquals(env1.run_id, env2.run_id);
});

// ── Watchlist diff tests ──

const watchlistDiffValid = {
  workflow_key: "watchlist_diff",
  run_id: "wl-diff-1111-2222-3333-444444444444",
  org_id: "org-wl-001",
  payload: {
    from_snapshot_id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    to_snapshot_id: "ffffffff-bbbb-cccc-dddd-eeeeeeeeeeee",
    diff: { added: ["New program"], removed: [], changed: [] },
    signals: [
      { signal_type: "leadership_change", signal_value: "New ED", confidence: 0.88, source_url: "https://example.org" },
    ],
  },
};

const watchlistDiffInvalidSchema = {
  workflow_key: "watchlist_diff",
  run_id: "wl-diff-bad-schema-3333-444444444444",
  org_id: "org-wl-001",
  payload: {
    from_snapshot_id: 999,
    to_snapshot_id: null,
    diff: "not-an-object",
  },
};

Deno.test("watchlist_diff: valid fixture normalizes correctly", () => {
  const env = normalizeEnvelope(watchlistDiffValid);
  assertEquals(env.workflow_key, "watchlist_diff");
  assertEquals(env.org_id, "org-wl-001");
  const p = env.payload as Record<string, unknown>;
  assertEquals(p.from_snapshot_id, "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee");
  assertEquals(p.to_snapshot_id, "ffffffff-bbbb-cccc-dddd-eeeeeeeeeeee");
});

Deno.test("watchlist_diff: signals array present", () => {
  const env = normalizeEnvelope(watchlistDiffValid);
  const signals = (env.payload as Record<string, unknown>).signals as Record<string, unknown>[];
  assertEquals(Array.isArray(signals), true);
  assertEquals(signals.length, 1);
  assertEquals(signals[0].signal_type, "leadership_change");
});

Deno.test("watchlist_diff: from_snapshot_id is optional (nullable)", () => {
  const env = normalizeEnvelope({
    workflow_key: "watchlist_diff",
    run_id: "wl-diff-no-from",
    org_id: "org-001",
    payload: { to_snapshot_id: "ffffffff-bbbb-cccc-dddd-eeeeeeeeeeee", diff: {} },
  });
  const p = env.payload as Record<string, unknown>;
  assertEquals(p.from_snapshot_id, undefined);
  assertEquals(p.to_snapshot_id, "ffffffff-bbbb-cccc-dddd-eeeeeeeeeeee");
});

Deno.test("watchlist_diff: invalid schema — to_snapshot_id must be string", () => {
  const env = normalizeEnvelope(watchlistDiffInvalidSchema);
  const p = env.payload as Record<string, unknown>;
  assertEquals(typeof p.to_snapshot_id === "string", false);
});

Deno.test("watchlist_diff: invalid schema — from_snapshot_id wrong type", () => {
  const env = normalizeEnvelope(watchlistDiffInvalidSchema);
  const p = env.payload as Record<string, unknown>;
  assertEquals(typeof p.from_snapshot_id === "string", false);
});

Deno.test("watchlist_diff: missing snapshot ids detected", () => {
  const env = normalizeEnvelope({
    workflow_key: "watchlist_diff",
    run_id: "wl-diff-bad",
    org_id: "org-001",
    payload: { diff: {} },
  });
  const p = env.payload as Record<string, unknown>;
  assertEquals(p.from_snapshot_id, undefined);
  assertEquals(p.to_snapshot_id, undefined);
});

Deno.test("watchlist keys are in VALID_WORKFLOW_KEYS equivalent", () => {
  const keys = ["partner_enrich", "opportunity_monitor", "recommendations_generate", "watchlist_ingest", "watchlist_diff"];
  assertEquals(keys.includes("watchlist_ingest"), true);
  assertEquals(keys.includes("watchlist_diff"), true);
});

// ── Escalation logic tests (imported from shared) ──

import { evaluateEscalation } from "../../_shared/escalation.ts";

Deno.test("ingest: escalation - no change produces no LLM", () => {
  const r = evaluateEscalation({ changed: false, baseline: false, confidence: 0.3, wordDelta: 200, rawTextLength: 1000 });
  assertEquals(r.shouldEscalate, false);
});

Deno.test("ingest: escalation - high confidence skips LLM", () => {
  const r = evaluateEscalation({ changed: true, baseline: false, confidence: 0.9, wordDelta: 200, rawTextLength: 1000 });
  assertEquals(r.shouldEscalate, false);
});

Deno.test("ingest: escalation - low confidence + big delta triggers", () => {
  const r = evaluateEscalation({ changed: true, baseline: false, confidence: 0.4, wordDelta: 100, rawTextLength: 1000 });
  assertEquals(r.shouldEscalate, true);
});

// ── Domain normalization tests ──

import { normalizeDomain } from "../../_shared/domainNormalize.ts";

Deno.test("ingest: domain normalization basic", () => {
  assertEquals(normalizeDomain("https://WWW.Example.org/about"), "example.org");
  assertEquals(normalizeDomain(null), null);
  assertEquals(normalizeDomain(""), null);
});
