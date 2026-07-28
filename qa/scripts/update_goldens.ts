/**
 * Regenerate golden expected-write JSON files from valid fixtures.
 * Opt-in only — run manually when ingest logic changes:
 *   npx tsx qa/scripts/update_goldens.ts
 */

import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { createHash } from "crypto";
import { resolve, dirname } from "path";

const ROOT = resolve(dirname(new URL(import.meta.url).pathname), "../..");
const FIXTURES = resolve(ROOT, "qa/fixtures/n8n");
const GOLDENS = resolve(ROOT, "qa/golden");

mkdirSync(GOLDENS, { recursive: true });

function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

function loadJson(path: string): Record<string, unknown> {
  return JSON.parse(readFileSync(path, "utf-8"));
}

// ── partner_enrich ──
function buildPartnerEnrichWrites(fixture: Record<string, unknown>) {
  const payload = fixture.payload as Record<string, unknown>;
  return [
    {
      table: "org_extractions",
      action: "insert",
      rows: [{
        run_id: fixture.run_id,
        org_name: fixture.org_name,
        website_url: fixture.website_url || null,
        raw_extraction: payload,
      }],
    },
    {
      table: "org_enrichment_facts",
      action: "insert",
      rows: [{
        extraction_id: "__FROM_PREVIOUS_INSERT__",
        run_id: fixture.run_id,
        org_name: fixture.org_name,
        mission_summary: (payload.mission_summary as string) || null,
        programs: Array.isArray(payload.programs) ? payload.programs : [],
        populations_served: Array.isArray(payload.populations_served) ? payload.populations_served : [],
        geographies: Array.isArray(payload.geographies) ? payload.geographies : [],
        funding_signals: Array.isArray(payload.funding_signals) ? payload.funding_signals : [],
        keywords: Array.isArray(payload.keywords) ? payload.keywords : [],
      }],
    },
  ];
}

// ── opportunity_monitor ──
function buildOppMonitorWrites(fixture: Record<string, unknown>) {
  const payload = fixture.payload as Record<string, unknown>;
  const result = payload.result as Record<string, unknown>;
  const signals = result.signals as Record<string, unknown>[];

  const rows = signals.map((s) => {
    const signalType = String(s.signal_type || "unknown");
    const summary = s.signal_value != null ? String(s.signal_value) : "";
    const sourceUrl = typeof s.source_url === "string" ? s.source_url : "";
    const fingerprint = sha256(`${signalType}|${summary}|${sourceUrl}`);

    return {
      run_id: fixture.run_id,
      opportunity_id: fixture.opportunity_id || null,
      signal_type: signalType,
      signal_value: summary || null,
      confidence: typeof s.confidence === "number" ? s.confidence : null,
      source_url: sourceUrl || null,
      detected_at: typeof s.detected_at === "string" ? s.detected_at : null,
      signal_fingerprint: fingerprint,
    };
  });

  return [{ table: "opportunity_signals", action: "insert", rows }];
}

// ── recommendations_generate ──
function buildRecsWrites(fixture: Record<string, unknown>) {
  const rec = fixture.payload as Record<string, unknown>;
  return [{
    table: "ai_recommendations",
    action: "upsert",
    onConflict: "metro_id,inputs_hash",
    rows: [{
      run_id: fixture.run_id,
      metro_id: fixture.metro_id,
      inputs_hash: fixture.inputs_hash,
      recommendation_type: String(rec.recommendation_type || "general"),
      title: String(rec.title || "Untitled"),
      body: typeof rec.body === "string" ? rec.body : null,
      priority: typeof rec.priority === "string" ? rec.priority : "medium",
      metadata: rec.metadata ?? null,
    }],
  }];
}

// ── Generate ──
const peFixture = loadJson(resolve(FIXTURES, "partner_enrich.valid.json"));
writeFileSync(
  resolve(GOLDENS, "partner_enrich.expected_writes.json"),
  JSON.stringify(buildPartnerEnrichWrites(peFixture), null, 2) + "\n",
);
console.log("✅ partner_enrich.expected_writes.json");

const omFixture = loadJson(resolve(FIXTURES, "opportunity_monitor.valid.changed.json"));
writeFileSync(
  resolve(GOLDENS, "opportunity_monitor.expected_writes.json"),
  JSON.stringify(buildOppMonitorWrites(omFixture), null, 2) + "\n",
);
console.log("✅ opportunity_monitor.expected_writes.json");

const rgFixture = loadJson(resolve(FIXTURES, "recommendations_generate.valid.json"));
writeFileSync(
  resolve(GOLDENS, "recommendations_generate.expected_writes.json"),
  JSON.stringify(buildRecsWrites(rgFixture), null, 2) + "\n",
);
console.log("✅ recommendations_generate.expected_writes.json");

console.log("\n🎉 All goldens updated.");
