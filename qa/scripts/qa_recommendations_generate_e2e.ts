/**
 * Hands-off E2E QA runner for recommendations_generate.
 * Dispatches → polls automation_runs → validates ai_recommendations.
 *
 * OPT-IN ONLY: requires LIVE_QA=1 to run.
 *
 * Env vars:
 *   LIVE_QA                     (required, must be "1")
 *   SUPABASE_URL                (required)
 *   SUPABASE_SERVICE_ROLE_KEY   (required)
 *   TIMEOUT_SECONDS             (optional, default 180)
 *   POLL_INTERVAL_MS            (optional, default 3000)
 *
 * Usage:
 *   LIVE_QA=1 SUPABASE_URL=xxx SUPABASE_SERVICE_ROLE_KEY=xxx npx tsx qa/scripts/qa_recommendations_generate_e2e.ts
 */

import { dispatchRecommendationsGenerate } from "./smoke_recommendations_generate";

// ── Opt-in guard ──
if (process.env.LIVE_QA !== "1") {
  console.log(
    "⚠️  This is an opt-in live E2E test. Set LIVE_QA=1 to run.\n" +
    "   Example: LIVE_QA=1 SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx qa/scripts/qa_recommendations_generate_e2e.ts",
  );
  process.exit(0);
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TIMEOUT_SECONDS = Number(process.env.TIMEOUT_SECONDS) || 180;
const POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS) || 3000;

const REQUIRED = { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY };
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
  if (!resp.ok) throw new Error(`REST GET ${path} → ${resp.status}: ${await resp.text()}`);
  return resp.json();
}

async function main() {
  // ── A) Dispatch ──
  console.log("═══════════════════════════════════════");
  console.log("  Step A: Dispatching recommendations_generate");
  console.log("═══════════════════════════════════════\n");

  const result = await dispatchRecommendationsGenerate(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
  const run_id = result.run_id;
  console.log(`\n   ✅ run_id: ${run_id}\n`);

  // ── B) Poll automation_runs ──
  console.log("═══════════════════════════════════════");
  console.log("  Step B: Polling automation_runs");
  console.log("═══════════════════════════════════════\n");

  const startTime = Date.now();
  const deadline = startTime + TIMEOUT_SECONDS * 1000;
  let finalStatus = "unknown";

  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

    const rows = (await restGet(
      `automation_runs?run_id=eq.${run_id}&select=run_id,status,error_message,processed_at,payload`,
    )) as Record<string, unknown>[];

    const elapsed = Math.round((Date.now() - startTime) / 1000);

    if (!rows.length) {
      process.stdout.write(` ${elapsed}s`);
      continue;
    }

    const row = rows[0];
    finalStatus = String(row.status);

    if (finalStatus === "processed") {
      console.log(`   ✅ status=processed (${elapsed}s)\n`);
      break;
    }

    if (finalStatus === "error") {
      console.error(`\n   ❌ status=error (${elapsed}s)`);
      console.error(`   error_message: ${row.error_message}`);
      process.exit(1);
    }

    process.stdout.write(` ${elapsed}s`);
  }

  if (finalStatus !== "processed") {
    console.error(`\n❌ Timed out after ${TIMEOUT_SECONDS}s. Last status: ${finalStatus}`);
    process.exit(1);
  }

  // ── C) Validate results ──
  console.log("═══════════════════════════════════════");
  console.log("  Step C: Validating results");
  console.log("═══════════════════════════════════════\n");

  // Fetch automation_runs payload for this run
  const runs = (await restGet(
    `automation_runs?run_id=eq.${run_id}&select=payload,error_message`,
  )) as Record<string, unknown>[];
  const runPayload = runs[0]?.payload as Record<string, unknown> | null;

  // Fetch ai_recommendations rows
  const recommendations = (await restGet(
    `ai_recommendations?run_id=eq.${run_id}&select=id,recommendation_type,title,priority,created_at`,
  )) as Record<string, unknown>[];

  let outcome: "recommendations" | "short_circuit" | "payload_only" | "fail" = "fail";

  if (recommendations.length > 0) {
    outcome = "recommendations";
    console.log(`   ✅ ${recommendations.length} ai_recommendations row(s)`);
    for (const row of recommendations) {
      console.log(
        `      id=${row.id}  type=${row.recommendation_type}  title=${row.title}  priority=${row.priority}`,
      );
    }
  } else if (
    runPayload &&
    typeof runPayload === "object" &&
    (runPayload.reason || runPayload.inputs_summary)
  ) {
    outcome = "short_circuit";
    console.log("   ✅ Workflow short-circuited (no recommendations generated)");
    console.log(`      reason: ${runPayload.reason ?? "n/a"}`);
    console.log(`      inputs_summary: ${JSON.stringify(runPayload.inputs_summary ?? null)}`);
  } else if (runPayload && typeof runPayload === "object" && Object.keys(runPayload).length > 0) {
    outcome = "payload_only";
    console.log("   ✅ automation_runs has non-empty payload (result persisted)");
  } else {
    console.error("   ❌ No ai_recommendations, no short-circuit reason, and no payload for this run_id");
    process.exit(1);
  }

  // ── Summary ──
  console.log("\n═══════════════════════════════════════");
  console.log("  RESULT");
  console.log("═══════════════════════════════════════\n");

  const summary = {
    ok: true,
    run_id,
    automation_status: finalStatus,
    outcome,
    recommendation_rows: recommendations.length,
  };
  console.log(JSON.stringify(summary, null, 2));
  console.log("\n✅ E2E recommendations_generate QA PASSED");
}

main().catch((err) => {
  console.error("❌ E2E QA error:", err);
  process.exit(1);
});
