/**
 * E2E smoke test: dispatch partner_enrich → n8n → ingest → verify DB writes.
 * Opt-in only. Requires real env vars:
 *
 *   SUPABASE_URL              (required)
 *   TEST_USER_JWT             (required) — JWT for a user allowed to dispatch partner_enrich
 *   SUPABASE_SERVICE_ROLE_KEY (required) — used to poll automation_runs + org_extractions
 *   TIMEOUT_SECONDS           (optional, default 90)
 *   POLL_INTERVAL_MS          (optional, default 2000)
 *
 * Usage:
 *   npx tsx qa/scripts/live_e2e_partner_enrich_smoke.ts
 */

const SUPABASE_URL = process.env.SUPABASE_URL;
const TEST_USER_JWT = process.env.TEST_USER_JWT;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TIMEOUT_SECONDS = Number(process.env.TIMEOUT_SECONDS) || 180;
const POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS) || 2500;

const REQUIRED = { SUPABASE_URL, TEST_USER_JWT, SUPABASE_SERVICE_ROLE_KEY };
const missing = Object.entries(REQUIRED).filter(([, v]) => !v).map(([k]) => k);
if (missing.length) {
  console.error(`❌ Missing env vars: ${missing.join(", ")}`);
  process.exit(1);
}

const restHeaders = {
  apikey: SUPABASE_SERVICE_ROLE_KEY!,
  Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
};

async function restGet(path: string): Promise<unknown[]> {
  const resp = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: restHeaders });
  if (!resp.ok) throw new Error(`REST ${path} → ${resp.status}: ${await resp.text()}`);
  return resp.json();
}

async function restGetSafe(path: string): Promise<{ status: number; data: unknown[] }> {
  try {
    const resp = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: restHeaders });
    const data = resp.ok ? await resp.json() : [];
    return { status: resp.status, data: Array.isArray(data) ? data : [] };
  } catch {
    return { status: 0, data: [] };
  }
}

function isUUID(val: unknown): val is string {
  return typeof val === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
}

async function resolveOrgId(): Promise<ResolvedOrg> {
  // Strategy A: Try org-like tables in order
  const orgTables = ["organizations", "organization", "orgs", "partners"];
  for (const table of orgTables) {
    const { status, data } = await restGetSafe(`${table}?select=id,name,website_url&limit=1`);
    if (status === 404) continue; // table doesn't exist
    const rows = data as Record<string, unknown>[];
    if (rows.length && isUUID(rows[0].id)) {
      return {
        org_id: String(rows[0].id),
        org_name: rows[0].name ? String(rows[0].name) : "Smoke Test Org",
        website_url: rows[0].website_url ? String(rows[0].website_url) : "https://example.com",
        source_table: table,
      };
    }
  }

  // Strategy B: opportunities table — use opportunity id as org_id
  const { data: opps } = await restGetSafe(
    "opportunities?select=id,organization&limit=5",
  );
  const oppRows = opps as Record<string, unknown>[];
  for (const row of oppRows) {
    if (isUUID(row.id)) {
      return {
        org_id: String(row.id),
        org_name: row.organization ? String(row.organization) : "Smoke Test Org",
        website_url: "https://example.com",
        source_table: "opportunities",
      };
    }
  }

  // Strategy C: fail
  throw new Error(
    "❌ Unable to resolve org_id from Supabase. No organizations/orgs/partners rows found " +
    "and no opportunities rows with non-null org_id.",
  );
}

async function main() {
  // ── 0) Resolve org_id ──
  console.log("🔍 Step 0: Auto-resolving org_id from database…");
  const resolved = await resolveOrgId();
  console.log(`   ✅ Resolved from '${resolved.source_table}': org_id=${resolved.org_id}`);
  console.log(`      org_name=${resolved.org_name}, website_url=${resolved.website_url}`);

  // ── A) Dispatch ──
  console.log("🚀 Step A: Dispatching partner_enrich…");
  const dispatchUrl = `${SUPABASE_URL}/functions/v1/n8n-dispatch`;
  const dispatchResp = await fetch(dispatchUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${TEST_USER_JWT}`,
    },
    body: JSON.stringify({
      workflow_key: "partner_enrich",
      org_id: resolved.org_id,
      org_name: resolved.org_name,
      website_url: resolved.website_url,
    }),
  });

  const dispatchText = await dispatchResp.text();
  let dispatchData: Record<string, unknown>;
  try {
    dispatchData = JSON.parse(dispatchText);
  } catch {
    console.error(`❌ Dispatch response not JSON: ${dispatchText}`);
    process.exit(1);
  }

  if (!dispatchResp.ok || dispatchData.ok !== true || typeof dispatchData.run_id !== "string") {
    console.error("❌ Dispatch failed:", JSON.stringify(dispatchData, null, 2));
    process.exit(1);
  }

  const run_id = dispatchData.run_id as string;
  console.log(`   ✅ Dispatched. run_id=${run_id}`);

  // ── B) Poll automation_runs ──
  console.log("⏳ Step B: Polling automation_runs…");
  const deadline = Date.now() + TIMEOUT_SECONDS * 1000;
  let automationStatus = "unknown";

  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

    const rows = (await restGet(
      `automation_runs?run_id=eq.${run_id}&select=run_id,status,error_message,processed_at`,
    )) as Record<string, unknown>[];

    const elapsed = Math.round((Date.now() - (deadline - TIMEOUT_SECONDS * 1000)) / 1000);
    if (!rows.length) {
      process.stdout.write(` ${elapsed}s`);
      continue;
    }

    const row = rows[0];
    automationStatus = String(row.status);

    if (automationStatus === "processed") {
      console.log(`\n   ✅ automation_runs status=processed`);
      break;
    }
    if (automationStatus === "error") {
      console.error(`\n❌ automation_runs status=error: ${row.error_message}`);
      process.exit(1);
    }
    process.stdout.write(` ${elapsed}s`);
  }

  if (automationStatus !== "processed") {
    console.error(`\n❌ Timed out after ${TIMEOUT_SECONDS}s. Last status: ${automationStatus}`);
    process.exit(1);
  }

  // ── C) Verify org_extractions ──
  console.log("🔍 Step C: Verifying org_extractions…");
  const extractions = (await restGet(
    `org_extractions?run_id=eq.${run_id}&select=id,org_name,created_at`,
  )) as Record<string, unknown>[];

  if (!extractions.length) {
    console.error("❌ No org_extractions row found for run_id");
    process.exit(1);
  }

  console.log(`   ✅ ${extractions.length} org_extractions row(s) found`);

  // ── Result ──
  const result = {
    ok: true,
    run_id,
    resolved_org_id: resolved.org_id,
    resolved_from: resolved.source_table,
    automation_status: automationStatus,
    extraction_rows: extractions.length,
  };
  console.log("\n📋 Result:", JSON.stringify(result, null, 2));
  console.log("\n✅ E2E partner_enrich smoke test PASSED");
}

main().catch((err) => {
  console.error("❌ E2E smoke test error:", err);
  process.exit(1);
});
