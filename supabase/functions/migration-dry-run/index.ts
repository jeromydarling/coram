/**
 * migration-dry-run — Preview what a migration would produce without writing.
 *
 * WHAT: Analyzes source data (real or simulated) and shows mapping preview.
 * WHERE: Admin Migration Harness.
 * WHY: Safety — see before you commit.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getSimulationProfile, buildSimulatedSourcePayload } from "../_shared/connectorSim.ts";

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

const DEFAULT_MAPPINGS: Record<string, Record<string, Record<string, string>>> = {
  hubspot: {
    companies: { name: "organization", domain: "website_url", description: "notes" },
    contacts: { firstname: "name", email: "email", phone: "phone", jobtitle: "title" },
    deals: { dealname: "organization", dealstage: "stage" },
    notes: { hs_note_body: "notes", hs_timestamp: "activity_date_time" },
  },
  salesforce: {
    accounts: { Name: "organization", Website: "website_url", Description: "notes" },
    contacts: { Name: "name", Email: "email", Phone: "phone", Title: "title" },
    opportunities: { Name: "organization", StageName: "stage" },
    tasks: { Subject: "title", Description: "notes" },
  },
  bloomerang: {
    constituents: { FullName: "name", PrimaryEmail: "email", PrimaryPhone: "phone" },
    organizations: { Name: "organization" },
    interactions: { Purpose: "notes", Date: "activity_date_time" },
  },
  csv: {
    organizations: { name: "organization", website: "website_url" },
    contacts: { name: "name", email: "email", phone: "phone", title: "title" },
    activities: { type: "activity_type", date: "activity_date_time", notes: "notes" },
  },
};

// Generic simulation mapping (maps sim field names to CROS fields)
const SIM_MAPPINGS: Record<string, Record<string, string>> = {
  companies: { name: "organization", domain: "website_url", description: "notes", about: "notes" },
  contacts: { firstname: "name", lastname: "name_suffix", email: "email", phone: "phone", mobile: "phone", jobtitle: "title", role: "title" },
  activities: { type: "activity_type", date: "activity_date_time", notes: "notes" },
  tasks: { subject: "title", status: "status", due_date: "due_date" },
  events: { name: "event_name", date: "event_date", location: "location" },
};

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

  const { tenant_id, connector_key, environment, source } = await req.json();
  if (!tenant_id || !connector_key || !environment) {
    return jsonError(400, "bad_request", "tenant_id, connector_key, environment required");
  }

  try {
    // ── SIMULATION SOURCE ──
    let effectiveSource = source;
    if (source?.type === "simulate") {
      const profile = await getSimulationProfile(svc, connector_key, source.profile_key);
      if (!profile) {
        return jsonError(404, "not_found", `Simulation profile '${source.profile_key}' not found`);
      }
      if (profile.behavior.mode === "error") {
        return jsonOk({
          ok: false,
          simulated: true,
          profile_key: source.profile_key,
          error_code: profile.behavior.error_code,
          message: `Simulated error: ${profile.behavior.error_code}`,
        });
      }
      const payload = buildSimulatedSourcePayload(connector_key, profile, source.run_key ?? `dry-${Date.now()}`);
      effectiveSource = { type: "csv", data: payload.data, _simulation: { profile_key: source.profile_key, run_key: source.run_key } };
    }

    // Look up custom mappings or use defaults
    const { data: customMappings } = await svc
      .from("migration_field_mappings")
      .select("object_type, mapping")
      .eq("tenant_id", tenant_id)
      .eq("connector_key", connector_key);

    const mappings: Record<string, Record<string, string>> = {};

    // Use sim mappings for simulation, else connector defaults
    const isSimulated = !!source?._simulation || source?.type === "simulate";
    const defaultMap = isSimulated ? SIM_MAPPINGS : (DEFAULT_MAPPINGS[connector_key] ?? DEFAULT_MAPPINGS.csv);

    for (const [objType, fields] of Object.entries(defaultMap)) {
      mappings[objType] = { ...fields };
    }
    for (const cm of customMappings ?? []) {
      if (cm.mapping && typeof cm.mapping === "object") {
        mappings[cm.object_type] = { ...mappings[cm.object_type], ...(cm.mapping as Record<string, string>) };
      }
    }

    const warnings: string[] = [];
    const sampleRows: Record<string, unknown[]> = {};
    const counts: Record<string, number> = {};

    if (effectiveSource?.type === "csv" && effectiveSource.data) {
      for (const [objectType, rows] of Object.entries(effectiveSource.data as Record<string, unknown[]>)) {
        const arr = Array.isArray(rows) ? rows : [];
        counts[objectType] = arr.length;
        sampleRows[objectType] = arr.slice(0, 5);

        if (arr.length > 50000) {
          warnings.push(`${objectType}: exceeds 50,000 row limit (${arr.length} rows)`);
        }
        if (!mappings[objectType] && !SIM_MAPPINGS[objectType]) {
          warnings.push(`${objectType}: no field mapping defined`);
        }
      }
    } else {
      for (const objType of Object.keys(mappings)) {
        counts[objType] = 0;
        sampleRows[objType] = [];
      }
      if (effectiveSource?.type !== "csv") {
        warnings.push("API-based import: actual counts will be determined during commit");
      }
    }

    const simMeta = effectiveSource?._simulation ?? (source?.type === "simulate" ? { profile_key: source.profile_key, run_key: source.run_key } : null);

    const { data: run, error: runErr } = await svc
      .from("migration_runs")
      .insert({
        tenant_id,
        connector_key,
        environment,
        mode: "dry_run",
        status: "completed",
        source_summary: {
          type: effectiveSource?.type ?? "csv",
          counts,
          ...(simMeta ? { simulation_profile_key: simMeta.profile_key } : {}),
        },
        mapping_summary: { mappings, warnings },
        results_summary: { preview: true, sample_rows: sampleRows },
        completed_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (runErr) throw new Error(runErr.message);

    // Write test run record if simulated
    if (simMeta) {
      await svc.from("integration_test_runs").insert({
        tenant_id,
        connector_key,
        environment: "simulation",
        simulation_profile_key: simMeta.profile_key,
        test_type: "dry_run",
        status: "passed",
        details: { migration_run_id: run.id, counts, warnings },
        completed_at: new Date().toISOString(),
      });
    }

    return jsonOk({
      ok: true,
      migration_run_id: run.id,
      mappings,
      counts,
      warnings,
      sample_rows: sampleRows,
      ...(simMeta ? { simulated: true, profile_key: simMeta.profile_key } : {}),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("migration-dry-run error:", msg);
    return jsonError(500, "internal_error", msg);
  }
});
