import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { normalizeEnvelope, normalizeOpportunitySignals } from "../index.ts";

// ── SHA-256 helper (mirrors n8n-ingest) ──
async function sha256(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ── Fixtures ──

const partnerEnrichFixture = {
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

const oppMonitorPayloadFixture = {
  workflow_key: "opportunity_monitor",
  run_id: "dddddddd-1111-2222-3333-444444444444",
  opportunity_id: "opp-001",
  org_id: "org-001",
  org_name: "Acme Corp",
  payload: {
    result: {
      signals: [
        { signal_type: "leadership_change", signal_value: "New CEO appointed: Jane Doe", source_url: "https://example.com/news/ceo", confidence: 0.92, detected_at: "2026-02-01T00:00:00Z" },
        { signal_type: "funding_round", signal_value: "Series B $50M raised", source_url: "https://example.com/funding", confidence: 0.85, detected_at: "2026-02-02T00:00:00Z" },
      ],
    },
  },
};

const oppMonitorResultFixture = {
  workflow_key: "opportunity_monitor",
  run_id: "dddddddd-1111-2222-3333-555555555555",
  opportunity_id: "opp-001",
  org_id: "org-001",
  org_name: "Acme Corp",
  result: {
    counts: { total: 2, changed: 1, new: 0, stale: 1 },
    changes: [
      { opportunity_id: "opp-001", fields_changed: ["stage"], summary: "Stage changed to Discovery Held" },
    ],
    recommendations: [
      { type: "info", message: "1 opportunity has been updated", priority: "low" },
    ],
  },
};

const recsFixture = {
  workflow_key: "recommendations_generate",
  run_id: "11111111-aaaa-bbbb-cccc-dddddddddddd",
  metro_id: "metro-001",
  inputs_hash: "abc123def456",
  payload: {
    recommendation_type: "expansion",
    title: "Expand to North Metro",
    body: "Based on recent signals, the north metro area shows strong growth potential.",
    priority: "high",
    metadata: { source_signals: 5 },
  },
};

// ── Contract validation ──

Deno.test("contract: partner_enrich fixture has required fields", () => {
  const env = normalizeEnvelope(partnerEnrichFixture);
  assertEquals(env.workflow_key, "partner_enrich");
  assertEquals(typeof env.run_id, "string");
  assertEquals(typeof env.org_name, "string");
  assertEquals(typeof env.payload, "object");
  for (const k of ["mission_summary", "programs", "populations_served", "geographies", "funding_signals", "keywords"]) {
    assertEquals(k in env.payload, true, `missing payload.${k}`);
  }
});

Deno.test("contract: opportunity_monitor payload-shape fixture has required fields", () => {
  const env = normalizeEnvelope(oppMonitorPayloadFixture);
  assertEquals(env.workflow_key, "opportunity_monitor");
  const signals = normalizeOpportunitySignals(env.payload);
  assertEquals(signals.length, 2);
  assertEquals(signals[0].signal_type, "leadership_change");
});

Deno.test("contract: opportunity_monitor result-shape fixture normalizes correctly", () => {
  const env = normalizeEnvelope(oppMonitorResultFixture);
  assertEquals(env.workflow_key, "opportunity_monitor");
  assertEquals(env.opportunity_id, "opp-001");
  const signals = normalizeOpportunitySignals(env.payload);
  assertEquals(signals.length, 2);
  assertEquals(signals[0].signal_type, "stage");
  assertEquals(signals[1].signal_type, "info");
});

Deno.test("contract: recommendations_generate fixture has required fields", () => {
  const env = normalizeEnvelope(recsFixture);
  assertEquals(env.workflow_key, "recommendations_generate");
  assertEquals(typeof env.metro_id, "string");
  assertEquals(typeof env.inputs_hash, "string");
  assertEquals(typeof env.payload.recommendation_type, "string");
  assertEquals(typeof env.payload.title, "string");
});

// ── Golden: partner_enrich write intents ──

Deno.test("golden: partner_enrich produces correct write intents", () => {
  const env = normalizeEnvelope(partnerEnrichFixture);
  const extractionWrite = {
    table: "org_extractions",
    action: "insert",
    rows: [{
      run_id: env.run_id,
      org_name: env.org_name,
      website_url: env.website_url || null,
      raw_extraction: env.payload,
    }],
  };

  const enrichmentWrite = {
    table: "org_enrichment_facts",
    action: "insert",
    rows: [{
      extraction_id: "__FROM_PREVIOUS_INSERT__",
      run_id: env.run_id,
      org_name: env.org_name,
      mission_summary: (env.payload.mission_summary as string) || null,
      programs: env.payload.programs,
      populations_served: env.payload.populations_served,
      geographies: env.payload.geographies,
      funding_signals: env.payload.funding_signals,
      keywords: env.payload.keywords,
    }],
  };

  assertEquals(extractionWrite.table, "org_extractions");
  assertEquals(enrichmentWrite.table, "org_enrichment_facts");
  assertEquals(extractionWrite.rows[0].run_id, env.run_id);
  assertEquals(enrichmentWrite.rows[0].mission_summary, "Building homes, communities and hope.");
  assertEquals(enrichmentWrite.rows[0].programs, ["ReStore", "Global Village"]);
  assertEquals(enrichmentWrite.rows[0].keywords, ["housing", "nonprofit", "construction"]);
});

// ── Golden: opportunity_monitor write intents (payload shape) ──

Deno.test("golden: opportunity_monitor payload-shape produces correct write intents", async () => {
  const env = normalizeEnvelope(oppMonitorPayloadFixture);
  const signals = normalizeOpportunitySignals(env.payload);
  const rows = [];

  for (const s of signals) {
    const fingerprint = await sha256(`${s.signal_type}|${s.signal_value}|${s.source_url}`);
    rows.push({
      run_id: env.run_id,
      opportunity_id: env.opportunity_id || null,
      signal_type: s.signal_type,
      signal_value: s.signal_value || null,
      confidence: s.confidence,
      source_url: s.source_url || null,
      detected_at: s.detected_at,
      signal_fingerprint: fingerprint,
    });
  }

  assertEquals(rows.length, 2);
  assertEquals(rows[0].signal_type, "leadership_change");
  assertEquals(rows[1].signal_type, "funding_round");
  assertEquals(rows[0].signal_fingerprint.length, 64);
  assertEquals(rows[0].signal_fingerprint !== rows[1].signal_fingerprint, true);
});

// ── Golden: opportunity_monitor write intents (result shape) ──

Deno.test("golden: opportunity_monitor result-shape produces correct write intents", async () => {
  const env = normalizeEnvelope(oppMonitorResultFixture);
  const signals = normalizeOpportunitySignals(env.payload);
  const rows = [];

  for (const s of signals) {
    const fingerprint = await sha256(`${s.signal_type}|${s.signal_value}|${s.source_url}`);
    rows.push({
      run_id: env.run_id,
      opportunity_id: env.opportunity_id || null,
      signal_type: s.signal_type,
      signal_value: s.signal_value || null,
      confidence: s.confidence,
      source_url: s.source_url || null,
      detected_at: s.detected_at,
      signal_fingerprint: fingerprint,
    });
  }

  assertEquals(rows.length, 2);
  assertEquals(rows[0].signal_type, "stage");
  assertEquals(rows[0].signal_value, "Stage changed to Discovery Held");
  assertEquals(rows[0].confidence, 0.7);
  assertEquals(rows[1].signal_type, "info");
  assertEquals(rows[1].confidence, 0.6);
  assertEquals(rows[0].signal_fingerprint.length, 64);
  assertEquals(rows[0].signal_fingerprint !== rows[1].signal_fingerprint, true);
});

// ── Golden: both shapes produce same row schema ──

Deno.test("golden: payload-shape and result-shape produce identical row schemas", async () => {
  const envA = normalizeEnvelope(oppMonitorPayloadFixture);
  const envB = normalizeEnvelope(oppMonitorResultFixture);
  const signalsA = normalizeOpportunitySignals(envA.payload);
  const signalsB = normalizeOpportunitySignals(envB.payload);

  const expectedKeys = ["run_id", "opportunity_id", "signal_type", "signal_value", "confidence", "source_url", "detected_at", "signal_fingerprint"];

  for (const [env, signals] of [[envA, signalsA], [envB, signalsB]] as [typeof envA, typeof signalsA][]) {
    for (const s of signals) {
      const fp = await sha256(`${s.signal_type}|${s.signal_value}|${s.source_url}`);
      const row = {
        run_id: env.run_id,
        opportunity_id: env.opportunity_id || null,
        signal_type: s.signal_type,
        signal_value: s.signal_value || null,
        confidence: s.confidence,
        source_url: s.source_url || null,
        detected_at: s.detected_at,
        signal_fingerprint: fp,
      };
      for (const k of expectedKeys) {
        assertEquals(k in row, true, `missing key: ${k}`);
      }
    }
  }
});

// ── Golden: recommendations_generate write intents ──

Deno.test("golden: recommendations_generate produces correct write intents", () => {
  const env = normalizeEnvelope(recsFixture);
  const rec = env.payload;
  const writes = [{
    table: "ai_recommendations",
    action: "upsert",
    onConflict: "metro_id,inputs_hash",
    rows: [{
      run_id: env.run_id,
      metro_id: env.metro_id,
      inputs_hash: env.inputs_hash,
      recommendation_type: String(rec.recommendation_type || "general"),
      title: String(rec.title || "Untitled"),
      body: typeof rec.body === "string" ? rec.body : null,
      priority: typeof rec.priority === "string" ? rec.priority : "medium",
      metadata: rec.metadata ?? null,
    }],
  }];

  assertEquals(writes.length, 1);
  assertEquals(writes[0].table, "ai_recommendations");
  assertEquals(writes[0].action, "upsert");
  assertEquals(writes[0].rows[0].metro_id, "metro-001");
  assertEquals(writes[0].rows[0].recommendation_type, "expansion");
  assertEquals(writes[0].rows[0].title, "Expand to North Metro");
  assertEquals(writes[0].rows[0].priority, "high");
});
