/**
 * Live smoke test for n8n-ingest edge function.
 * NOT run by default — requires real env vars:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *
 * Usage:
 *   npx tsx qa/scripts/live_n8n_ingest_smoke.ts
 */

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("❌ Missing env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

async function main() {
  const fixture = await import("../fixtures/n8n/partner_enrich.valid.json", {
    with: { type: "json" },
  });
  const body = fixture.default;

  // Use a unique run_id for each smoke test
  body.run_id = crypto.randomUUID();

  const url = `${SUPABASE_URL}/functions/v1/n8n-ingest`;

  console.log(`📡 POST ${url}`);
  console.log(`   run_id: ${body.run_id}`);
  console.log(`   workflow_key: ${body.workflow_key}`);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
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

  if (response.ok && typeof parsed === "object" && parsed !== null && (parsed as Record<string, unknown>).ok === true) {
    console.log("\n✅ Smoke test PASSED");
  } else {
    console.error("\n❌ Smoke test FAILED");
    process.exit(1);
  }

  // ── Replay test ──
  console.log("\n🔄 Replaying same run_id...");
  const replayResp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify(body),
  });

  const replayText = await replayResp.text();
  let replayParsed: unknown;
  try {
    replayParsed = JSON.parse(replayText);
  } catch {
    replayParsed = replayText;
  }

  console.log(`📬 Replay Status: ${replayResp.status}`);
  console.log("📦 Replay Response:", JSON.stringify(replayParsed, null, 2));

  if (
    replayResp.ok &&
    typeof replayParsed === "object" &&
    replayParsed !== null &&
    (replayParsed as Record<string, unknown>).replay === true
  ) {
    console.log("\n✅ Replay safety PASSED");
  } else {
    console.error("\n❌ Replay safety FAILED");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("❌ Smoke test error:", err);
  process.exit(1);
});
