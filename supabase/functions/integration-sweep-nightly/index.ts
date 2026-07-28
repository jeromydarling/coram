/**
 * integration-sweep-nightly — Automated connector health sweep.
 *
 * WHAT: Runs simulation smoke+dry-run for all active connectors.
 * WHERE: Scheduled nightly or triggered manually by admin.
 * WHY: Catch mapping/contract regressions without vendor accounts.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getSimulationProfile, simulateConnectorFetch } from "../_shared/connectorSim.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function jsonOk(data: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function jsonError(status: number, code: string, message: string) {
  return new Response(
    JSON.stringify({ ok: false, error: code, message }),
    { status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}

const SWEEP_PROFILES = ["basic", "auth_fail", "rate_limited", "schema_drift"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  // Allow service-role calls (cron) or admin JWT
  const authHeader = req.headers.get("authorization") ?? "";
  const svc = createClient(supabaseUrl, serviceKey);

  const isServiceRole = authHeader.includes(serviceKey);
  if (!isServiceRole) {
    if (!authHeader.startsWith("Bearer ")) return jsonError(401, "unauthorized", "Missing auth");
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) return jsonError(401, "unauthorized", "Invalid token");
    const { data: roles } = await svc.from("user_roles").select("role").eq("user_id", user.id);
    if (!(roles ?? []).some((r: { role: string }) => r.role === "admin")) return jsonError(403, "forbidden", "Admin only");
  }

  const body = await req.json().catch(() => ({}));
  const scope = body.scope ?? "all";
  const targetConnector = body.connector_key ?? null;
  const runKey = body.run_key ?? `sweep-${new Date().toISOString().split("T")[0]}`;

  // Get a demo tenant for test runs (first available)
  const { data: demoTenant } = await svc
    .from("demo_tenants")
    .select("tenant_id")
    .limit(1)
    .maybeSingle();

  const tenantId = demoTenant?.tenant_id ?? "00000000-0000-0000-0000-000000000000";

  try {
    // Get active connectors
    let connectorQuery = svc.from("integration_connectors").select("key, display_name").eq("active", true);
    if (scope === "connector" && targetConnector) {
      connectorQuery = connectorQuery.eq("key", targetConnector);
    }
    const { data: connectors } = await connectorQuery;

    const results: Array<{
      connector_key: string;
      profile_key: string;
      status: string;
      details: Record<string, unknown>;
    }> = [];

    for (const connector of connectors ?? []) {
      for (const profileKey of SWEEP_PROFILES) {
        const profile = await getSimulationProfile(svc, connector.key, profileKey);
        if (!profile) {
          results.push({
            connector_key: connector.key,
            profile_key: profileKey,
            status: "failed",
            details: { error: "Profile not found" },
          });
          continue;
        }

        const sim = simulateConnectorFetch(connector.key, profile, runKey);
        const passed = profileKey === "auth_fail" || profileKey === "rate_limited"
          ? !sim.ok // error profiles should fail gracefully
          : sim.ok;

        const testStatus = passed ? "passed" : "failed";

        // Write integration_test_runs
        await svc.from("integration_test_runs").insert({
          tenant_id: tenantId,
          connector_key: connector.key,
          environment: "simulation",
          simulation_profile_key: profileKey,
          test_type: "smoke",
          status: testStatus,
          details: {
            simulated: true,
            profile_key: profileKey,
            warnings: sim.warnings,
            counts: sim.data ? Object.fromEntries(
              Object.entries(sim.data).map(([k, v]) => [k, Array.isArray(v) ? v.length : 0])
            ) : {},
            error: sim.error ?? null,
          },
          completed_at: new Date().toISOString(),
        });

        results.push({
          connector_key: connector.key,
          profile_key: profileKey,
          status: testStatus,
          details: { warnings: sim.warnings, error: sim.error ?? null },
        });
      }

      // Update operator_integration_health
      const connectorResults = results.filter((r) => r.connector_key === connector.key);
      const passed = connectorResults.filter((r) => r.status === "passed").length;
      const failed = connectorResults.filter((r) => r.status === "failed").length;
      const lastError = connectorResults.find((r) => r.status === "failed")?.details?.error;

      await svc
        .from("operator_integration_health")
        .upsert(
          {
            tenant_id: tenantId,
            connector_key: connector.key,
            environment: "simulation",
            simulated_runs_passed: passed,
            simulated_runs_failed: failed,
            last_error_code: lastError ? String((lastError as Record<string, unknown>)?.code ?? "UNKNOWN") : null,
            last_checked_at: new Date().toISOString(),
            last_status: failed > 0 ? "warning" : "ok",
            success_rate: Math.round((passed / Math.max(passed + failed, 1)) * 100),
            updated_at: new Date().toISOString(),
          },
          { onConflict: "tenant_id,connector_key,environment" },
        );
    }

    return jsonOk({
      ok: true,
      run_key: runKey,
      connectors_tested: connectors?.length ?? 0,
      results,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("integration-sweep-nightly error:", msg);
    return jsonError(500, "internal_error", msg);
  }
});
