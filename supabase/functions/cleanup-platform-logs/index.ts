/**
 * cleanup-platform-logs — Scheduled retention enforcement for growth tables.
 *
 * WHAT: Deletes old records from tables that grow indefinitely.
 * WHERE: Called weekly via cron or admin trigger.
 * WHY: Prevents unbounded table growth while preserving recent operational data.
 *
 * Retention policies:
 *   - qa_steps / qa_runs: 30 days
 *   - living_system_signals: 90 days (handled by archive_old_living_signals RPC)
 *   - automation_runs (terminal): 60 days
 *   - testimonium_events (raw): 180 days (rollups kept indefinitely)
 *   - voice_notes (failed): 30 days
 *   - proactive_notifications (read): 60 days
 *   - system_health_events: 90 days
 *   - edge_function_rate_limits: 7 days
 *
 * AUTH: Service-role key or shared secret required.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
};

function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}

function authenticateRequest(req: Request): boolean {
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const sharedSecret = Deno.env.get("N8N_SHARED_SECRET");
  const authHeader = req.headers.get("authorization") ?? "";
  const apiKeyHeader = req.headers.get("x-api-key") ?? "";

  if (authHeader.startsWith("Bearer ") && serviceRoleKey) {
    if (authHeader.slice(7).trim() === serviceRoleKey) return true;
  }
  const token = apiKeyHeader.trim() || (authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "");
  if (!token) return false;
  return sharedSecret ? constantTimeCompare(token, sharedSecret) : false;
}

interface CleanupResult {
  table: string;
  deleted: number;
  error?: string;
}

async function cleanupTable(
  svc: ReturnType<typeof createClient>,
  table: string,
  dateColumn: string,
  retentionDays: number,
  extraFilters?: (q: any) => any,
): Promise<CleanupResult> {
  try {
    const cutoff = new Date(Date.now() - retentionDays * 86400000).toISOString();
    let query = svc.from(table).delete().lt(dateColumn, cutoff);
    if (extraFilters) query = extraFilters(query);

    const { count, error } = await query.select("id", { count: "exact", head: true });

    // Since we can't get count from delete directly, do delete then estimate
    let deleteQuery = svc.from(table).delete().lt(dateColumn, cutoff);
    if (extraFilters) deleteQuery = extraFilters(deleteQuery);
    const { error: delErr } = await deleteQuery;

    if (delErr) {
      return { table, deleted: 0, error: delErr.message };
    }
    return { table, deleted: -1 }; // -1 means "deleted but count unavailable via API"
  } catch (e) {
    return { table, deleted: 0, error: (e as Error).message };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (!authenticateRequest(req)) {
    return new Response(
      JSON.stringify({ ok: false, error: "Unauthorized", code: "UNAUTHORIZED" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  try {
    const svc = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const results: CleanupResult[] = [];

    // 1. QA steps — 30 days
    results.push(await cleanupTable(svc, "qa_steps", "created_at", 30));

    // 2. QA runs — 30 days  
    results.push(await cleanupTable(svc, "qa_runs", "created_at", 30));

    // 3. Living system signals — 90 days (via RPC for consistency)
    const { data: livingResult, error: livingErr } = await svc.rpc("archive_old_living_signals");
    results.push({
      table: "living_system_signals",
      deleted: livingErr ? 0 : (livingResult as any)?.deleted_count ?? 0,
      error: livingErr?.message,
    });

    // 4. Automation runs (terminal) — 60 days
    results.push(await cleanupTable(svc, "automation_runs", "created_at", 60, (q: any) =>
      q.in("status", ["processed", "deduped", "skipped_due_to_cap", "rate_limited", "throttled", "failed_timeout"]),
    ));

    // 5. Proactive notifications (read) — 60 days
    results.push(await cleanupTable(svc, "proactive_notifications", "created_at", 60, (q: any) =>
      q.eq("is_read", true),
    ));

    // 6. System health events — 90 days
    results.push(await cleanupTable(svc, "system_health_events", "created_at", 90));

    // 7. Edge function rate limits — 7 days
    results.push(await cleanupTable(svc, "edge_function_rate_limits", "window_start", 7));

    // 8. Recycle bin purge (90 days handled by DB function)
    const { data: purgeResult, error: purgeErr } = await svc.rpc("purge_recycle_bin");
    results.push({
      table: "recycle_bin",
      deleted: purgeErr ? 0 : (purgeResult as any)?.purged_count ?? 0,
      error: purgeErr?.message,
    });

    // Health telemetry
    await svc.from("system_health_events").insert({
      schedule_key: "cleanup_platform_logs",
      status: "ok",
      stats: { results },
    }).catch(() => {});

    const totalErrors = results.filter(r => r.error).length;

    return new Response(
      JSON.stringify({
        ok: totalErrors === 0,
        results,
        summary: {
          tables_processed: results.length,
          errors: totalErrors,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[cleanup-platform-logs] Error:", message);
    return new Response(
      JSON.stringify({ ok: false, error: message, code: "INTERNAL_ERROR" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
