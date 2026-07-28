/**
 * Hands-off smoke test for watchlist loop (NO Firecrawl).
 * Calls n8n-ingest directly with controlled payloads.
 *
 * OPT-IN: requires LIVE_QA=1 to run.
 *
 * Usage:
 *   LIVE_QA=1 SUPABASE_URL=xxx SUPABASE_SERVICE_ROLE_KEY=xxx npx tsx qa/scripts/qa_watchlist_smoke.ts
 */

import { SMOKE_ORG_ID } from "./constants";

if (process.env.LIVE_QA !== "1") {
  console.log(
    "⚠️  Opt-in smoke test. Set LIVE_QA=1 to run.\n" +
    "   LIVE_QA=1 SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx qa/scripts/qa_watchlist_smoke.ts",
  );
  process.exit(0);
}

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const TIMEOUT_SECONDS = Number(process.env.TIMEOUT_SECONDS) || 90;
const POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS) || 2000;

const required = { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY };
const missing = Object.entries(required).filter(([, v]) => !v).map(([k]) => k);
if (missing.length) { console.error(`❌ Missing: ${missing.join(", ")}`); process.exit(1); }

const headers = {
  apikey: SUPABASE_SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
  "Content-Type": "application/json",
};

async function restGet(path: string): Promise<unknown[]> {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers });
  if (!r.ok) throw new Error(`GET ${path} → ${r.status}: ${await r.text()}`);
  return r.json();
}

async function callIngest(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const r = await fetch(`${SUPABASE_URL}/functions/v1/n8n-ingest`, {
    method: "POST",
    headers: { Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(`ingest failed: ${JSON.stringify(data)}`);
  return data as Record<string, unknown>;
}

async function pollRun(runId: string): Promise<void> {
  const deadline = Date.now() + TIMEOUT_SECONDS * 1000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    const rows = (await restGet(`automation_runs?run_id=eq.${runId}&select=status,error_message`)) as Record<string, unknown>[];
    if (!rows.length) continue;
    const s = String(rows[0].status);
    if (s === "processed") return;
    if (s === "error") throw new Error(`Run error: ${rows[0].error_message}`);
  }
  throw new Error("Timed out");
}

async function ensureWatchlistRow(orgId: string) {
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/org_watchlist`, {
      method: "POST",
      headers: { ...headers, Prefer: "return=representation" },
      body: JSON.stringify({ org_id: orgId, website_url: "https://www.pcsforpeople.org", enabled: true, cadence: "manual" }),
    });
  } catch { /* may already exist */ }
}

async function main() {
  const orgId = SMOKE_ORG_ID;
  const ts = Date.now();
  const hash1 = `smoke-baseline-${ts}`;
  const hash2 = `smoke-changed-${ts}`;
  const run1 = `smoke-wl-1-${ts}`;
  const run2 = `smoke-wl-2-${ts}`;
  let pass = true;

  console.log("═══ Watchlist Smoke Test ═══\n");

  // 1. Ensure watchlist row
  await ensureWatchlistRow(orgId);
  console.log("✓ Watchlist row ensured");

  // 2. Baseline ingest
  const r1 = await callIngest({
    workflow_key: "watchlist_ingest", run_id: run1, org_id: orgId, org_name: "PCs for People",
    payload: { url: "https://www.pcsforpeople.org", content_hash: hash1, raw_text: "Baseline smoke content.", crawled_at: new Date().toISOString() },
  });
  console.log(`✓ Baseline ingest: snapshot_id=${r1.snapshot_id}, baseline=${r1.baseline}`);
  await pollRun(run1);

  // 3. Changed ingest
  const r2 = await callIngest({
    workflow_key: "watchlist_ingest", run_id: run2, org_id: orgId, org_name: "PCs for People",
    payload: { url: "https://www.pcsforpeople.org", content_hash: hash2, raw_text: "Changed smoke content with updates.", crawled_at: new Date().toISOString() },
  });
  console.log(`✓ Changed ingest: snapshot_id=${r2.snapshot_id}, changed=${r2.changed}`);
  await pollRun(run2);

  // 4. Assert snapshots
  const snaps = (await restGet(`org_snapshots?org_id=eq.${orgId}&content_hash=in.(${hash1},${hash2})&select=id`)) as unknown[];
  if (snaps.length < 2) { console.error(`✗ Expected >=2 snapshots, got ${snaps.length}`); pass = false; }
  else console.log(`✓ ${snaps.length} snapshots`);

  // 5. Assert diff
  const snap2Id = r2.snapshot_id as string;
  const diffs = (await restGet(`org_snapshot_diffs?org_id=eq.${orgId}&to_snapshot_id=eq.${snap2Id}&select=id,diff`)) as Record<string, unknown>[];
  if (!diffs.length) { console.error("✗ No diff row"); pass = false; }
  else {
    const d = diffs[0].diff as Record<string, unknown>;
    if (d?.changed !== true) { console.error("✗ Diff.changed != true"); pass = false; }
    else console.log("✓ Diff exists with changed=true");
  }

  // 6. Assert signal
  const sigs = (await restGet(`org_watchlist_signals?org_id=eq.${orgId}&snapshot_id=eq.${snap2Id}&select=id,signal_type`)) as Record<string, unknown>[];
  if (!sigs.length) { console.error("✗ No signal emitted"); pass = false; }
  else console.log(`✓ Signal emitted: ${sigs[0].signal_type}`);

  // 7. Assert last_crawled_at
  const wl = (await restGet(`org_watchlist?org_id=eq.${orgId}&select=last_crawled_at`)) as Record<string, unknown>[];
  if (!wl.length || !wl[0].last_crawled_at) { console.error("✗ last_crawled_at not updated"); pass = false; }
  else console.log("✓ last_crawled_at updated");

  console.log(`\n═══ ${pass ? "PASS" : "FAIL"} ═══`);
  if (!pass) process.exit(1);
}

main().catch((err) => { console.error("❌ Smoke error:", err); process.exit(1); });
