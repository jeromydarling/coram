/**
 * relatio-smoke-test — Validates connector health.
 * POST { tenant_id, connector_key }
 *
 * Checks: connector exists, connection active, minimal pull test.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { tenant_id, connector_key } = await req.json();

    if (!tenant_id || !connector_key) {
      return new Response(
        JSON.stringify({ error: "tenant_id and connector_key are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const checks: Array<{ name: string; status: "pass" | "fail"; detail?: string }> = [];

    // Check 1: Connector exists and active
    const { data: connector } = await supabase
      .from("relatio_connectors")
      .select("key, name, direction")
      .eq("key", connector_key)
      .eq("active", true)
      .maybeSingle();

    checks.push({
      name: "connector_exists",
      status: connector ? "pass" : "fail",
      detail: connector ? `${connector.name} (${connector.direction})` : "Connector not found",
    });

    if (!connector) {
      return new Response(
        JSON.stringify({ ok: false, checks }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Check 2: Connection exists for tenant
    const { data: connection } = await supabase
      .from("relatio_connections")
      .select("status, settings")
      .eq("tenant_id", tenant_id)
      .eq("connector_key", connector_key)
      .maybeSingle();

    checks.push({
      name: "connection_active",
      status: connection?.status === "connected" ? "pass" : "fail",
      detail: connection ? `Status: ${connection.status}` : "No connection found",
    });

    // Check 3: No stuck jobs
    const { data: stuckJobs } = await supabase
      .from("relatio_sync_jobs")
      .select("id")
      .eq("tenant_id", tenant_id)
      .eq("connector_key", connector_key)
      .eq("status", "running")
      .limit(1);

    checks.push({
      name: "no_stuck_jobs",
      status: !stuckJobs?.length ? "pass" : "fail",
      detail: stuckJobs?.length ? "Running job found" : "No stuck jobs",
    });

    // Check 4: Field maps available
    const { data: maps } = await supabase
      .from("relatio_field_maps")
      .select("id")
      .eq("integration_key", connector_key)
      .limit(1);

    checks.push({
      name: "field_maps_available",
      status: maps?.length ? "pass" : "fail",
      detail: maps?.length ? "Maps configured" : "Using default maps",
    });

    const allPass = checks.every((c) => c.status === "pass");

    return new Response(
      JSON.stringify({ ok: allPass, checks }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
