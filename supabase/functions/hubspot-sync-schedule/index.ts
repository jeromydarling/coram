/**
 * HubSpot Sync Schedule
 * Runs on cron (daily). Iterates active connections, pushes changed entities.
 * Batches max 50 per connection. Logs summary to hubspot_sync_log + system_job_runs.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function getServiceClient() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startedAt = new Date();

  try {
    const supabase = getServiceClient();

    // Get all active connections
    const { data: connections, error: connError } = await supabase
      .from("hubspot_connections")
      .select("id, user_id, hubspot_mode, sync_scope")
      .eq("status", "active");

    if (connError) throw connError;

    console.log(`[hubspot-sync-schedule] Found ${connections?.length || 0} active connections`);

    let totalPushed = 0;
    let totalSkipped = 0;
    let totalFailed = 0;

    for (const conn of connections || []) {
      const scope = (conn.sync_scope || {}) as Record<string, boolean>;

      // Find changed opportunities (updated in last 25 hours to overlap)
      if (scope.partners !== false) {
        const { data: changedOpps } = await supabase
          .from("opportunities")
          .select("id")
          .gt("updated_at", new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString())
          .limit(50);

        if (changedOpps?.length) {
          const oppIds = changedOpps.map((o: { id: string }) => o.id);

          // Call hubspot-push internally
          const pushResp = await fetch(`${SUPABASE_URL}/functions/v1/hubspot-push`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            },
            body: JSON.stringify({
              connection_id: conn.id,
              opportunity_ids: oppIds,
              user_id_override: conn.user_id,
            }),
          });

          if (pushResp.ok) {
            const result = await pushResp.json();
            totalPushed += result.summary?.ok || 0;
            totalSkipped += result.summary?.skipped || 0;
            totalFailed += result.summary?.failed || 0;
          } else {
            console.error(`[hubspot-sync-schedule] Push failed for connection ${conn.id}:`, await pushResp.text());
            totalFailed++;
          }
        }
      }

      // Find changed contacts
      if (scope.contacts !== false) {
        const { data: changedContacts } = await supabase
          .from("contacts")
          .select("id")
          .gt("updated_at", new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString())
          .limit(50);

        if (changedContacts?.length) {
          const contactIds = changedContacts.map((c: { id: string }) => c.id);

          const pushResp = await fetch(`${SUPABASE_URL}/functions/v1/hubspot-push`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            },
            body: JSON.stringify({
              connection_id: conn.id,
              contact_ids: contactIds,
              user_id_override: conn.user_id,
            }),
          });

          if (pushResp.ok) {
            const result = await pushResp.json();
            totalPushed += result.summary?.ok || 0;
            totalSkipped += result.summary?.skipped || 0;
            totalFailed += result.summary?.failed || 0;
          }
        }
      }
    }

    const completedAt = new Date();
    const durationMs = completedAt.getTime() - startedAt.getTime();

    // Write system_job_runs entry
    await supabase.from("system_job_runs").insert({
      job_key: "hubspot_sync_daily",
      scope: "system",
      status: totalFailed > 0 ? "partial" : "completed",
      started_at: startedAt.toISOString(),
      completed_at: completedAt.toISOString(),
      duration_ms: durationMs,
      stats: {
        connections_processed: connections?.length || 0,
        pushed: totalPushed,
        skipped: totalSkipped,
        failed: totalFailed,
      },
      outputs: {},
      errors: [],
    });

    console.log(`[hubspot-sync-schedule] Complete: ${totalPushed} pushed, ${totalSkipped} skipped, ${totalFailed} failed`);

    return new Response(JSON.stringify({
      success: true,
      connections_processed: connections?.length || 0,
      pushed: totalPushed,
      skipped: totalSkipped,
      failed: totalFailed,
      duration_ms: durationMs,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[hubspot-sync-schedule] Error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
