/**
 * Live smoke test for n8n-dispatch edge function.
 * NOT run by default — requires real env vars:
 *   SUPABASE_URL, TEST_USER_JWT
 *   Optional: SUPABASE_SERVICE_ROLE_KEY (enables polling automation_runs)
 *   Optional: WORKFLOW_KEY (default: partner_enrich)
 *   Optional: N8N_DISPATCH_URL (default: ${SUPABASE_URL}/functions/v1/n8n-dispatch)
 *
 * Usage:
 *   npx tsx qa/scripts/live_n8n_dispatch_smoke.ts
 */

const SUPABASE_URL = process.env.SUPABASE_URL;
const TEST_USER_JWT = process.env.TEST_USER_JWT;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const WORKFLOW_KEY = process.env.WORKFLOW_KEY || "partner_enrich";
const N8N_DISPATCH_URL =
  process.env.N8N_DISPATCH_URL ||
  `${SUPABASE_URL}/functions/v1/n8n-dispatch`;

if (!SUPABASE_URL || !TEST_USER_JWT) {
  console.error("❌ Missing env vars: SUPABASE_URL, TEST_USER_JWT");
  process.exit(1);
}

const PAYLOADS: Record<string, Record<string, unknown>> = {
  partner_enrich: {
    workflow_key: "partner_enrich",
    org_id: "smoke-org-001",
    org_name: "Smoke Test Org",
    website_url: "https://smoketest.example.com",
  },
  opportunity_monitor: {
    workflow_key: "opportunity_monitor",
    opportunity_id: "smoke-opp-001",
    org_id: "smoke-org-001",
    org_name: "Smoke Test Org",
    monitor_urls: ["https://smoketest.example.com"],
    previous_hashes: [],
  },
  recommendations_generate: {
    workflow_key: "recommendations_generate",
    metro_id: "smoke-metro-001",
    horizon_days: 7,
    opportunities: [],
    recent_signals: [],
    org_facts: [],
  },
};

async function main() {
  const body = PAYLOADS[WORKFLOW_KEY];
  if (!body) {
    console.error(`❌ Unknown WORKFLOW_KEY: ${WORKFLOW_KEY}`);
    console.error(`   Valid: ${Object.keys(PAYLOADS).join(", ")}`);
    process.exit(1);
  }

  console.log(`📡 POST ${N8N_DISPATCH_URL}`);
  console.log(`   workflow_key: ${WORKFLOW_KEY}`);

  const response = await fetch(N8N_DISPATCH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${TEST_USER_JWT}`,
    },
    body: JSON.stringify(body),
  });

  const text = await response.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = text;
  }

  console.log(`\n📬 Status: ${response.status}`);
  console.log("📦 Response:", JSON.stringify(parsed, null, 2));

  if (
    response.ok &&
    typeof parsed === "object" &&
    parsed !== null &&
    (parsed as Record<string, unknown>).ok === true &&
    typeof (parsed as Record<string, unknown>).run_id === "string"
  ) {
    console.log("\n✅ Dispatch smoke test PASSED");
  } else {
    console.error("\n❌ Dispatch smoke test FAILED");
    process.exit(1);
  }

  const run_id = (parsed as Record<string, unknown>).run_id as string;

  // ── Optional: poll automation_runs ──
  if (SUPABASE_SERVICE_ROLE_KEY) {
    console.log(`\n🔍 Polling automation_runs for run_id=${run_id}...`);
    const pollUrl = `${SUPABASE_URL}/rest/v1/automation_runs?run_id=eq.${run_id}&select=run_id,status,workflow_key,error_message`;

    for (let attempt = 0; attempt < 6; attempt++) {
      await new Promise((r) => setTimeout(r, 2000));

      const pollResp = await fetch(pollUrl, {
        headers: {
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          apikey: SUPABASE_SERVICE_ROLE_KEY,
        },
      });
      const pollText = await pollResp.text();
      let rows: unknown[];
      try {
        rows = JSON.parse(pollText);
      } catch {
        console.log(`   attempt ${attempt + 1}: parse error`);
        continue;
      }

      if (Array.isArray(rows) && rows.length > 0) {
        const row = rows[0] as Record<string, unknown>;
        console.log(`   status: ${row.status}`);
        if (row.status === "dispatched" || row.status === "processed") {
          console.log("✅ automation_runs status OK");
          return;
        }
        if (row.status === "error") {
          console.error(`❌ automation_runs error: ${row.error_message}`);
          process.exit(1);
        }
      }
    }
    console.log("⚠️  Polling timed out — run may still be processing");
  }
}

main().catch((err) => {
  console.error("❌ Smoke test error:", err);
  process.exit(1);
});
