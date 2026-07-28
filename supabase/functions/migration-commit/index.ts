/**
 * migration-commit — Commits a migration after dry-run approval.
 *
 * WHAT: Writes migrated records to core CRM tables (real or simulated).
 * WHERE: Admin Migration Harness.
 * WHY: Safe, audited data import with deduplication.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getSimulationProfile, buildSimulatedSourcePayload } from "../_shared/connectorSim.ts";
import {
  rescueFailedRows,
  describeFailure,
  type FailedMigrationRow,
} from "../_shared/migrationAiRescue.ts";

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

  const { tenant_id, connector_key, environment, source } = await req.json();
  if (!tenant_id || !connector_key || !environment) {
    return jsonError(400, "bad_request", "tenant_id, connector_key, environment required");
  }

  // ── SIMULATION: require demo tenant ──
  const isSimulation = source?.type === "simulate";
  if (isSimulation) {
    const { data: demo } = await svc
      .from("demo_tenants")
      .select("id")
      .eq("tenant_id", tenant_id)
      .maybeSingle();
    if (!demo) {
      return jsonError(400, "bad_request", "Simulated commits are only allowed for demo tenants");
    }
  }

  try {
    // Resolve simulation source to CSV-like data
    let effectiveSource = source;
    let simProfileKey: string | null = null;
    if (isSimulation) {
      const profile = await getSimulationProfile(svc, connector_key, source.profile_key);
      if (!profile) return jsonError(404, "not_found", `Profile '${source.profile_key}' not found`);
      if (profile.behavior.mode === "error") {
        return jsonError(400, "bad_request", `Cannot commit an error profile (${profile.behavior.error_code})`);
      }
      const payload = buildSimulatedSourcePayload(connector_key, profile, source.run_key ?? `commit-${Date.now()}`);
      simProfileKey = source.profile_key;
      effectiveSource = { type: "csv", data: payload.data };
    }

    // Create migration run
    const { data: run, error: runErr } = await svc
      .from("migration_runs")
      .insert({
        tenant_id,
        connector_key,
        environment,
        mode: "commit",
        status: "running",
        source_summary: {
          type: effectiveSource?.type ?? "csv",
          ...(simProfileKey ? { simulation_profile_key: simProfileKey } : {}),
        },
      })
      .select("id")
      .single();
    if (runErr) throw new Error(runErr.message);

    const results: Record<string, { created: number; updated: number; skipped: number; errors: number }> = {};
    const failedForRescue: FailedMigrationRow[] = [];
    const simPrefix = simProfileKey ? `sim:${connector_key}:${simProfileKey}:${source?.run_key ?? "default"}:` : "";

    if (effectiveSource?.type === "csv" && effectiveSource.data) {
      // Process organizations → opportunities
      if (effectiveSource.data.organizations || effectiveSource.data.companies) {
        const orgs = (effectiveSource.data.organizations ?? effectiveSource.data.companies) as Record<string, string>[];
        const r = { created: 0, updated: 0, skipped: 0, errors: 0 };

        for (const row of orgs) {
          try {
            const orgName = row.name || row.Name || row.organization;
            if (!orgName) { r.skipped++; continue; }

            const { data: existing } = await svc
              .from("opportunities")
              .select("id")
              .eq("tenant_id", tenant_id)
              .ilike("organization", orgName)
              .limit(1)
              .maybeSingle();

            if (existing) {
              r.skipped++;
              await svc.from("migration_run_items").insert({
                migration_run_id: run.id,
                object_type: "organizations",
                action: "skipped",
                external_id: simPrefix + (row.id || ""),
                internal_id: existing.id,
              });
            } else {
              const { data: created } = await svc
                .from("opportunities")
                .insert({
                  organization: orgName,
                  website_url: row.domain || row.website || row.Website || null,
                  notes: row.notes || row.description || row.about || null,
                  tenant_id,
                  stage: "Found",
                  status: "Active",
                  created_by: user.id,
                })
                .select("id")
                .single();
              r.created++;
              await svc.from("migration_run_items").insert({
                migration_run_id: run.id,
                object_type: "organizations",
                action: "created",
                external_id: simPrefix + (row.id || ""),
                internal_id: created?.id,
              });
            }
          } catch (recErr) {
            r.errors++;
            failedForRescue.push({
              source_row: row,
              target_entity: "opportunities",
              failure_reason: describeFailure(recErr, "Organization commit threw"),
            });
          }
        }
        results.organizations = r;
      }

      // Process contacts
      if (effectiveSource.data.contacts) {
        const contacts = effectiveSource.data.contacts as Record<string, string>[];
        const r = { created: 0, updated: 0, skipped: 0, errors: 0 };

        for (const row of contacts) {
          try {
            const name = row.name || row.Name || `${row.firstname || ""} ${row.lastname || ""}`.trim();
            const email = row.email || row.Email || null;
            if (!name) { r.skipped++; continue; }

            if (email) {
              const { data: existing } = await svc
                .from("contacts")
                .select("id")
                .eq("tenant_id", tenant_id)
                .ilike("email", email)
                .limit(1)
                .maybeSingle();

              if (existing) {
                r.skipped++;
                await svc.from("migration_run_items").insert({
                  migration_run_id: run.id,
                  object_type: "contacts",
                  action: "skipped",
                  external_id: simPrefix + (row.id || ""),
                  internal_id: existing.id,
                });
                continue;
              }
            }

            const { data: created } = await svc
              .from("contacts")
              .insert({
                name,
                email,
                phone: row.phone || row.Phone || row.mobile || null,
                title: row.title || row.Title || row.jobtitle || row.role || null,
                tenant_id,
                created_by: user.id,
              })
              .select("id")
              .single();
            r.created++;
            await svc.from("migration_run_items").insert({
              migration_run_id: run.id,
              object_type: "contacts",
              action: "created",
              external_id: simPrefix + (row.id || ""),
              internal_id: created?.id,
            });
          } catch (recErr) {
            r.errors++;
            failedForRescue.push({
              source_row: row,
              target_entity: "people",
              failure_reason: describeFailure(recErr, "Contact commit threw"),
            });
          }
        }
        results.contacts = r;
      }
    }

    // AI rescue — fire after deterministic repair has failed.
    const rescue = await rescueFailedRows({
      migration_id: run.id,
      tenant_id,
      integration_key: connector_key,
      failed_rows: failedForRescue,
    });

    // Finalize run
    await svc
      .from("migration_runs")
      .update({
        status: "completed",
        results_summary: { ...results, ai_rescue: rescue },
        completed_at: new Date().toISOString(),
      })
      .eq("id", run.id);

    // Write test run record if simulated
    if (simProfileKey) {
      await svc.from("integration_test_runs").insert({
        tenant_id,
        connector_key,
        environment: "simulation",
        simulation_profile_key: simProfileKey,
        test_type: "commit",
        status: "passed",
        details: { migration_run_id: run.id, results, ai_rescue: rescue },
        completed_at: new Date().toISOString(),
      });
    }

    return jsonOk({
      ok: true,
      migration_run_id: run.id,
      results,
      ai_rescue: rescue,
      ...(simProfileKey ? { simulated: true, profile_key: simProfileKey } : {}),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("migration-commit error:", msg);
    return jsonError(500, "internal_error", msg);
  }
});
