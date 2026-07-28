/**
 * CLI smoke test: dispatch a fresh recommendations_generate run via n8n-dispatch.
 * Can be run standalone or imported as a module.
 *
 * Requires env vars:
 *   SUPABASE_URL                (required)
 *   SUPABASE_SERVICE_ROLE_KEY   (required)
 *
 * Usage:
 *   SUPABASE_URL=xxx SUPABASE_SERVICE_ROLE_KEY=xxx npx tsx qa/scripts/smoke_recommendations_generate.ts
 */

import { SMOKE_METRO_ID } from "./constants";

export interface DispatchResult {
  ok: boolean;
  run_id: string;
  [key: string]: unknown;
}

export async function dispatchRecommendationsGenerate(
  supabaseUrl: string,
  serviceRoleKey: string,
): Promise<DispatchResult> {
  const url = `${supabaseUrl}/functions/v1/n8n-dispatch`;

  const payload = {
    workflow_key: "recommendations_generate",
    requested_by: "00000000-0000-0000-0000-000000000001",
    metro_id: SMOKE_METRO_ID,
    horizon_days: 14,
    opportunities: [
      {
        id: "00000000-0000-0000-0000-000000000101",
        organization: "Smoke Partner",
        stage: "discovery",
        updated_at: "2026-01-01T00:00:00.000Z",
      },
    ],
    recent_signals: [
      {
        id: "sig_smoke_1",
        type: "status_change",
        summary: "Smoke signal: opportunity updated",
        created_at: "2026-01-01T00:00:00.000Z",
      },
    ],
    org_facts: [
      {
        source: "smoke",
        fact: "Smoke Partner operates locally",
        confidence: 0.5,
      },
    ],
    metadata: {
      smoke_test: true,
      source: "cli",
    },
  };

  console.log(`📡 POST ${url}`);
  console.log(`   workflow_key: ${payload.workflow_key}`);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${serviceRoleKey}`,
    },
    body: JSON.stringify(payload),
  });

  const text = await response.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`Non-JSON response (${response.status}): ${text}`);
  }

  console.log(`\n📬 Status: ${response.status}`);
  console.log("📦 Response:", JSON.stringify(parsed, null, 2));

  if (
    !response.ok ||
    typeof parsed !== "object" ||
    parsed === null ||
    (parsed as Record<string, unknown>).ok !== true ||
    typeof (parsed as Record<string, unknown>).run_id !== "string"
  ) {
    throw new Error(`Dispatch failed: ${JSON.stringify(parsed)}`);
  }

  return parsed as DispatchResult;
}

// ── Standalone execution ──
const isMain = process.argv[1]?.endsWith("smoke_recommendations_generate.ts");
if (isMain) {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error("❌ Missing env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  dispatchRecommendationsGenerate(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    .then((result) => {
      console.log(`\n✅ Dispatch succeeded — run_id: ${result.run_id}`);
    })
    .catch((err) => {
      console.error("❌ Smoke dispatch error:", err);
      process.exit(1);
    });
}
