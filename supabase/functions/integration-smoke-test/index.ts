/**
 * integration-smoke-test — Verifies a connector is healthy.
 *
 * WHAT: Runs basic connectivity and scope checks (real or simulated).
 * WHERE: Admin Migration Harness.
 * WHY: Confidence before running imports.
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  const authHeader = req.headers.get("authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return jsonError(401, "unauthorized", "Missing auth");

  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
  const { data: { user }, error: userErr } = await userClient.auth.getUser();
  if (userErr || !user) return jsonError(401, "unauthorized", "Invalid token");

  const svc = createClient(supabaseUrl, serviceKey);
  const { data: roles } = await svc.from("user_roles").select("role").eq("user_id", user.id);
  if (!(roles ?? []).some((r: { role: string }) => r.role === "admin")) return jsonError(403, "forbidden", "Admin only");

  const { tenant_id, connector_key, environment, mode, simulation_profile_key, run_key } = await req.json();
  if (!tenant_id || !connector_key) {
    return jsonError(400, "bad_request", "tenant_id and connector_key required");
  }

  try {
    // ── SIMULATION MODE ──
    if (mode === "simulate" && simulation_profile_key) {
      const profile = await getSimulationProfile(svc, connector_key, simulation_profile_key);
      if (!profile) {
        return jsonError(404, "not_found", `Simulation profile '${simulation_profile_key}' not found for ${connector_key}`);
      }

      const simResult = simulateConnectorFetch(connector_key, profile, run_key ?? `smoke-${Date.now()}`);
      const checks: Array<{ name: string; status: "pass" | "fail" | "warn"; detail: string }> = [];

      // Check 1: Profile loaded
      checks.push({ name: "profile_loaded", status: "pass", detail: `${profile.display_name} (${profile.profile_key})` });

      // Check 2: Connector fetch simulation
      if (simResult.ok) {
        checks.push({ name: "connector_fetch", status: "pass", detail: `HTTP ${simResult.status} — data received` });
      } else {
        const expectedError = profile.behavior.mode === "error";
        checks.push({
          name: "connector_fetch",
          status: expectedError ? "pass" : "fail",
          detail: expectedError
            ? `Expected error: ${simResult.error?.code} (correctly handled)`
            : `Unexpected error: ${simResult.error?.code}`,
        });
      }

      // Check 3: Mapping coverage
      if (simResult.data) {
        const objTypes = Object.keys(simResult.data);
        checks.push({ name: "mapping_coverage", status: "pass", detail: `${objTypes.length} object types available` });
      } else if (profile.behavior.mode === "error") {
        checks.push({ name: "mapping_coverage", status: "pass", detail: "Skipped (error profile)" });
      }

      // Check 4: Warnings
      if (simResult.warnings.length > 0) {
        checks.push({ name: "warnings", status: "warn", detail: simResult.warnings.join("; ") });
      } else {
        checks.push({ name: "warnings", status: "pass", detail: "No warnings" });
      }

      const allPass = checks.every((c) => c.status !== "fail");

      // Write test run record
      await svc.from("integration_test_runs").insert({
        tenant_id,
        connector_key,
        environment: "simulation",
        simulation_profile_key,
        test_type: "smoke",
        status: allPass ? "passed" : "failed",
        details: { checks, warnings: simResult.warnings, simulated: true },
        completed_at: new Date().toISOString(),
      });

      return jsonOk({ ok: allPass, checks, simulated: true, profile_key: simulation_profile_key });
    }

    // ── REAL MODE (original logic) ──
    const checks: Array<{ name: string; status: "pass" | "fail" | "warn"; detail: string }> = [];

    const { data: connector } = await svc
      .from("integration_connectors")
      .select("key, display_name, direction, active")
      .eq("key", connector_key)
      .single();

    if (!connector) {
      checks.push({ name: "connector_exists", status: "fail", detail: "Connector not found in registry" });
      return jsonOk({ ok: false, checks });
    }
    checks.push({ name: "connector_exists", status: "pass", detail: `${connector.display_name} registered` });

    if (!connector.active) {
      checks.push({ name: "connector_active", status: "fail", detail: "Connector is disabled" });
    } else {
      checks.push({ name: "connector_active", status: "pass", detail: "Connector is active" });
    }

    const env = environment || "sandbox";
    const { data: connection } = await svc
      .from("integration_connections")
      .select("id, status, auth_type")
      .eq("tenant_id", tenant_id)
      .eq("connector_key", connector_key)
      .eq("environment", env)
      .maybeSingle();

    if (!connection) {
      checks.push({ name: "connection_exists", status: "warn", detail: `No ${env} connection configured` });
    } else {
      checks.push({
        name: "connection_exists",
        status: connection.status === "connected" ? "pass" : "fail",
        detail: `Connection status: ${connection.status} (${connection.auth_type})`,
      });
    }

    const { data: mappings } = await svc
      .from("migration_field_mappings")
      .select("object_type")
      .eq("tenant_id", tenant_id)
      .eq("connector_key", connector_key);

    if (!mappings || mappings.length === 0) {
      checks.push({ name: "field_mappings", status: "warn", detail: "Using default mappings (no custom mappings configured)" });
    } else {
      checks.push({ name: "field_mappings", status: "pass", detail: `${mappings.length} object types mapped` });
    }

    const { count: runCount } = await svc
      .from("migration_runs")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", tenant_id)
      .eq("connector_key", connector_key);

    checks.push({
      name: "previous_runs",
      status: "pass",
      detail: `${runCount ?? 0} previous migration runs`,
    });

    const allPass = checks.every((c) => c.status !== "fail");
    return jsonOk({ ok: allPass, checks });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("integration-smoke-test error:", msg);
    return jsonError(500, "internal_error", msg);
  }
});
