/**
 * Hands-off E2E QA runner for watchlist_ingest.
 * Inserts a test org_watchlist row, calls n8n-ingest directly,
 * polls automation_runs until processed, validates org_snapshots created.
 *
 * OPT-IN ONLY: requires LIVE_QA=1 to run.
 *
 * Usage:
 *   LIVE_QA=1 SUPABASE_URL=xxx SUPABASE_SERVICE_ROLE_KEY=xxx npx tsx qa/scripts/qa_watchlist_ingest_e2e.ts
 */

import { SMOKE_ORG_ID } from "./constants";

if (process.env.LIVE_QA !== "1") {
  console.log(
    "⚠️  This is an opt-in live E2E test. Set LIVE_QA=1 to run.\n" +
    "   Example: LIVE_QA=1 SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx qa/scripts/qa_watchlist_ingest_e2e.ts",
  );
  process.exit(0);
}

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const TIMEOUT_SECONDS = Number(process.env.TIMEOUT_SECONDS) || 120;
const POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS) || 2000;

const REQUIRED = { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY };
const missing = Object.entries(REQUIRED).filter(([, v]) => !v).map(([k]) => k);
if (missing.length) {
  console.error(`❌ Missing env vars: ${missing.join(", ")}`);
  process.exit(1);
}

const serviceHeaders = {
  apikey: SUPABASE_SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
  "Content-Type": "application/json",
};

async function restGet(path: string): Promise<unknown[]> {
  const resp = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: serviceHeaders });
  if (!resp.ok) throw new Error(`REST GET ${path} → ${resp.status}: ${await resp.text()}`);
  return resp.json();
}

async function restPost(path: string, body: Record<string, unknown>): Promise<unknown> {
  const resp = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: "POST",
    headers: { ...serviceHeaders, Prefer: "return=representation" },
    body: JSON.stringify(body),
  });
  if (!resp.ok && resp.status !== 409) throw new Error(`REST POST ${path} → ${resp.status}: ${await resp.text()}`);
  return resp.json();
}

async function callIngest(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
  const resp = await fetch(`${SUPABASE_URL}/functions/v1/n8n-ingest`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(`n8n-ingest failed: ${JSON.stringify(data)}`);
  return data as Record<string, unknown>;
}

async function pollRun(runId: string): Promise<string> {
  const startTime = Date.now();
  const deadline = startTime + TIMEOUT_SECONDS * 1000;

  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    const rows = (await restGet(
      `automation_runs?run_id=eq.${runId}&select=run_id,status,error_message`,
    )) as Record<string, unknown>[];

    if (!rows.length) continue;
    const status = String(rows[0].status);
    if (status === "processed") return status;
    if (status === "error") throw new Error(`Run errored: ${rows[0].error_message}`);
  }
  throw new Error(`Timed out after ${TIMEOUT_SECONDS}s`);
}

async function main() {
  const testOrgId = SMOKE_ORG_ID;
  const runId = `qa-wl-ingest-${Date.now()}`;
  const contentHash = `qa-hash-${Date.now()}`;

  console.log("═══ Step 1: Ensure org_watchlist row ═══");
  try {
    await restPost("org_watchlist", {
      org_id: testOrgId,
      website_url: "https://www.pcsforpeople.org/about",
      enabled: true,
      cadence: "manual",
    });
    console.log("   ✅ Watchlist row created");
  } catch {
    console.log("   ℹ️  Watchlist row may already exist");
  }

  console.log("\n═══ Step 2: Call n8n-ingest (watchlist_ingest) ═══");
  const ingestResult = await callIngest({
    workflow_key: "watchlist_ingest",
    run_id: runId,
    org_id: testOrgId,
    org_name: "PCs for People",
    payload: {
      url: "https://www.pcsforpeople.org/about",
      content_hash: contentHash,
      raw_text: "PCs for People provides low-cost computers and internet to underserved communities.",
      crawled_at: new Date().toISOString(),
      meta: { status_code: 200 },
    },
  });
  console.log(`   ✅ Ingest returned: ok=${ingestResult.ok}, snapshot_id=${ingestResult.snapshot_id}`);

  console.log("\n═══ Step 3: Poll automation_runs ═══");
  await pollRun(runId);
  console.log("   ✅ status=processed");

  console.log("\n═══ Step 4: Validate org_snapshots ═══");
  const snapshots = (await restGet(
    `org_snapshots?org_id=eq.${testOrgId}&content_hash=eq.${contentHash}&select=id,content_hash,crawled_at`,
  )) as Record<string, unknown>[];

  if (!snapshots.length) {
    console.error("   ❌ No org_snapshots rows found");
    process.exit(1);
  }
  console.log(`   ✅ ${snapshots.length} snapshot(s) found`);

  console.log("\n═══ RESULT ═══");
  console.log("✅ E2E watchlist_ingest QA PASSED");
}

main().catch((err) => {
  console.error("❌ E2E QA error:", err);
  process.exit(1);
});
