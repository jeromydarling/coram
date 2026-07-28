/**
 * CLI smoke test: dispatch a fresh partner_enrich run via n8n-dispatch.
 * Can be run standalone or imported as a module.
 *
 * Requires env vars:
 *   SUPABASE_URL                (required)
 *   SUPABASE_SERVICE_ROLE_KEY   (required)
 *
 * Usage:
 *   SUPABASE_URL=xxx SUPABASE_SERVICE_ROLE_KEY=xxx npx tsx qa/scripts/smoke_partner_enrich.ts
 */

import { SMOKE_WEBSITE_URL, SMOKE_ORG_NAME, SMOKE_ORG_ID } from "./constants";

export interface DispatchResult {
  ok: boolean;
  run_id: string;
  [key: string]: unknown;
}

export async function dispatchPartnerEnrich(
  supabaseUrl: string,
  serviceRoleKey: string,
): Promise<DispatchResult> {
  const url = `${supabaseUrl}/functions/v1/n8n-dispatch`;

  const payload = {
    workflow_key: "partner_enrich",
    org_id: SMOKE_ORG_ID,
    org_name: SMOKE_ORG_NAME,
    website_url: SMOKE_WEBSITE_URL,
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
const isMain = process.argv[1]?.endsWith("smoke_partner_enrich.ts");
if (isMain) {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error("❌ Missing env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  dispatchPartnerEnrich(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    .then((result) => {
      console.log(`\n✅ Dispatch succeeded — run_id: ${result.run_id}`);
    })
    .catch((err) => {
      console.error("❌ Smoke dispatch error:", err);
      process.exit(1);
    });
}
