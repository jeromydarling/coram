/**
 * relatio-commit — Commits a migration, upserting records into CRM tables.
 * POST { tenant_id, connector_key, records }
 *
 * Dedupe: orgs by domain/external_id, contacts by email/external_id.
 * Writes relatio_sync_items log.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
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

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const { tenant_id, connector_key, records } = await req.json();

    if (!tenant_id || !connector_key) {
      return new Response(
        JSON.stringify({ error: "tenant_id and connector_key are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Verify membership
    const { data: membership } = await supabase
      .from("tenant_users")
      .select("tenant_id")
      .eq("tenant_id", tenant_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!membership) {
      return new Response(JSON.stringify({ error: "Not a member of this tenant" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create sync job
    const { data: job, error: jobErr } = await admin
      .from("relatio_sync_jobs")
      .insert({
        tenant_id,
        connector_key,
        direction: "pull",
        mode: "commit",
        status: "running",
      })
      .select("id")
      .single();

    if (jobErr) {
      return new Response(JSON.stringify({ error: jobErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const syncJobId = job.id;
    const inputRecords = Array.isArray(records) ? records.slice(0, 50000) : [];
    const results = { created: 0, updated: 0, skipped: 0, errors: 0 };
    const syncItems: Array<Record<string, unknown>> = [];
    const failedForRescue: FailedMigrationRow[] = [];

    for (const rec of inputRecords) {
      try {
        const orgName = rec.organization || rec.company_name || rec.Account_Name;
        const contactName = rec.name || rec.contact_name || rec.Contact_Name;
        const contactEmail = rec.email || rec.contact_email || rec.Contact_Email;
        const externalId = rec.external_id || rec.id || null;

        // Upsert organization
        if (orgName) {
          const domain = rec.website_url || rec.company_domain || rec.Account_Website || null;

          // Dedupe: check by external_id or domain
          let existingOrg = null;
          if (externalId) {
            const { data } = await admin
              .from("opportunities")
              .select("id")
              .eq("tenant_id", tenant_id)
              .contains("external_ids", { relatio: externalId })
              .maybeSingle();
            existingOrg = data;
          }
          if (!existingOrg && domain) {
            const { data } = await admin
              .from("opportunities")
              .select("id")
              .eq("tenant_id", tenant_id)
              .eq("website_url", domain)
              .maybeSingle();
            existingOrg = data;
          }

          if (existingOrg) {
            results.updated++;
            syncItems.push({
              sync_job_id: syncJobId,
              object_type: "organizations",
              action: "updated",
              external_id: externalId,
              internal_id: existingOrg.id,
            });
          } else {
            const { data: newOrg, error: orgErr } = await admin
              .from("opportunities")
              .insert({
                tenant_id,
                organization: orgName,
                website_url: domain,
                external_ids: externalId ? { relatio: externalId } : {},
                status: "Active",
                stage: "Found",
              })
              .select("id")
              .single();

            if (orgErr) {
              results.errors++;
              syncItems.push({
                sync_job_id: syncJobId,
                object_type: "organizations",
                action: "error",
                external_id: externalId,
                warnings: [orgErr.message],
              });
              failedForRescue.push({
                source_row: rec,
                target_entity: "opportunities",
                failure_reason: describeFailure(orgErr, "Organization insert failed"),
              });
            } else {
              results.created++;
              syncItems.push({
                sync_job_id: syncJobId,
                object_type: "organizations",
                action: "created",
                external_id: externalId,
                internal_id: newOrg.id,
              });

              // Upsert contact under this org
              if (contactName && contactEmail) {
                const { data: existingContact } = await admin
                  .from("contacts")
                  .select("id")
                  .eq("tenant_id", tenant_id)
                  .eq("email", contactEmail)
                  .maybeSingle();

                if (!existingContact) {
                  const { data: newContact } = await admin
                    .from("contacts")
                    .insert({
                      tenant_id,
                      name: contactName,
                      email: contactEmail,
                      opportunity_id: newOrg.id,
                      external_ids: externalId ? { relatio: externalId } : {},
                    })
                    .select("id")
                    .single();

                  if (newContact) {
                    results.created++;
                    syncItems.push({
                      sync_job_id: syncJobId,
                      object_type: "contacts",
                      action: "created",
                      external_id: externalId,
                      internal_id: newContact.id,
                    });
                  }
                } else {
                  results.skipped++;
                  syncItems.push({
                    sync_job_id: syncJobId,
                    object_type: "contacts",
                    action: "skipped",
                    external_id: externalId,
                    internal_id: existingContact.id,
                    warnings: ["Contact already exists"],
                  });
                }
              }
            }
          }
        }
      } catch (recErr) {
        results.errors++;
        failedForRescue.push({
          source_row: rec,
          target_entity: "opportunities",
          failure_reason: describeFailure(recErr, "Row commit threw unexpectedly"),
        });
      }
    }

    // Batch insert sync items
    if (syncItems.length > 0) {
      await admin.from("relatio_sync_items").insert(syncItems);
    }

    // AI rescue — fires only after deterministic repair has failed.
    // Non-blocking; outcome is logged in migration_review_queue.
    const rescue = await rescueFailedRows({
      migration_id: syncJobId,
      tenant_id,
      integration_key: connector_key,
      failed_rows: failedForRescue,
    });

    // Mark job completed
    await admin
      .from("relatio_sync_jobs")
      .update({
        status: results.errors > 0 && results.created === 0 ? "failed" : "completed",
        summary: { ...results, ai_rescue: rescue },
        completed_at: new Date().toISOString(),
      })
      .eq("id", syncJobId);

    return new Response(
      JSON.stringify({ ok: true, sync_job_id: syncJobId, results, ai_rescue: rescue }),
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
