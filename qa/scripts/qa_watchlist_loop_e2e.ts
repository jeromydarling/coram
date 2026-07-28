/**
 * Hands-off E2E QA runner for the full watchlist loop:
 *   baseline ingest → changed ingest → assert diff + signal
 *
 * OPT-IN ONLY: requires LIVE_QA=1 to run.
 *
 * Usage:
 *   LIVE_QA=1 SUPABASE_URL=xxx SUPABASE_SERVICE_ROLE_KEY=xxx npx tsx qa/scripts/qa_watchlist_loop_e2e.ts
 */

import { SMOKE_ORG_ID } from "./constants";

if (process.env.LIVE_QA !== "1") {
  console.log(
    "⚠️  This is an opt-in live E2E test. Set LIVE_QA=1 to run.\n" +
    "   Example: LIVE_QA=1 SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx qa/scripts/qa_watchlist_loop_e2e.ts",
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

async function pollRun(runId: string): Promise<void> {
  const deadline = Date.now() + TIMEOUT_SECONDS * 1000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    const rows = (await restGet(
      `automation_runs?run_id=eq.${runId}&select=run_id,status,error_message`,
    )) as Record<string, unknown>[];
    if (!rows.length) continue;
    const status = String(rows[0].status);
    if (status === "processed") return;
    if (status === "error") throw new Error(`Run errored: ${rows[0].error_message}`);
  }
  throw new Error(`Timed out after ${TIMEOUT_SECONDS}s`);
}

async function main() {
  const testOrgId = SMOKE_ORG_ID;
  const ts = Date.now();
  const baselineHash = `qa-baseline-${ts}`;
  const changedHash = `qa-changed-${ts}`;
  const run1 = `qa-wl-loop-1-${ts}`;
  const run2 = `qa-wl-loop-2-${ts}`;

  // ── Step 1: Baseline ingest ──
  console.log("═══ Step 1: Baseline ingest ═══");
  const r1 = await callIngest({
    workflow_key: "watchlist_ingest",
    run_id: run1,
    org_id: testOrgId,
    org_name: "PCs for People",
    payload: {
      url: "https://www.pcsforpeople.org/about",
      content_hash: baselineHash,
      raw_text: "Baseline content for QA loop test.",
      crawled_at: new Date().toISOString(),
    },
  });
  console.log(`   ✅ Baseline: ok=${r1.ok}, snapshot_id=${r1.snapshot_id}, baseline=${r1.baseline}`);
  await pollRun(run1);

  // ── Step 2: Changed ingest ──
  console.log("\n═══ Step 2: Changed ingest ═══");
  const r2 = await callIngest({
    workflow_key: "watchlist_ingest",
    run_id: run2,
    org_id: testOrgId,
    org_name: "PCs for People",
    payload: {
      url: "https://www.pcsforpeople.org/about",
      content_hash: changedHash,
      raw_text: "Updated content for QA loop test with new programs added.",
      crawled_at: new Date().toISOString(),
    },
  });
  console.log(`   ✅ Changed: ok=${r2.ok}, snapshot_id=${r2.snapshot_id}, changed=${r2.changed}`);
  await pollRun(run2);

  // ── Step 3: Validate snapshots ──
  console.log("\n═══ Step 3: Validate snapshots ═══");
  const snaps = (await restGet(
    `org_snapshots?org_id=eq.${testOrgId}&content_hash=in.(${baselineHash},${changedHash})&select=id,content_hash`,
  )) as Record<string, unknown>[];
  if (snaps.length < 2) {
    console.error(`   ❌ Expected 2 snapshots, got ${snaps.length}`);
    process.exit(1);
  }
  console.log(`   ✅ ${snaps.length} snapshots`);

  // ── Step 4: Validate diff ──
  console.log("\n═══ Step 4: Validate diffs ═══");
  const snap2Id = r2.snapshot_id as string;
  const diffs = (await restGet(
    `org_snapshot_diffs?org_id=eq.${testOrgId}&to_snapshot_id=eq.${snap2Id}&select=id,diff`,
  )) as Record<string, unknown>[];
  if (!diffs.length) {
    console.error("   ❌ No diff row found linking snapshots");
    process.exit(1);
  }
  console.log(`   ✅ ${diffs.length} diff(s)`);

  // ── Step 5: Validate signal ──
  console.log("\n═══ Step 5: Validate signals ═══");
  const signals = (await restGet(
    `org_watchlist_signals?org_id=eq.${testOrgId}&snapshot_id=eq.${snap2Id}&select=id,signal_type,summary`,
  )) as Record<string, unknown>[];
  if (!signals.length) {
    console.error("   ❌ No watchlist signal emitted");
    process.exit(1);
  }
  console.log(`   ✅ ${signals.length} signal(s): ${signals[0].signal_type}`);

  console.log("\n═══ RESULT ═══");
  console.log("✅ E2E watchlist loop QA PASSED");
}

main().catch((err) => {
  console.error("❌ E2E QA error:", err);
  process.exit(1);
});
