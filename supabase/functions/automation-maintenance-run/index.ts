import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * automation-maintenance-run — Weekly cleanup of old automation_runs.
 *
 * Responsibilities:
 *  1. Call archive_old_automation_runs() to delete runs older than 90 days
 *     with terminal statuses (processed, deduped, skipped, rate_limited, throttled).
 *  2. Refresh story_events_cache materialized view.
 *  3. Return { ok, deleted_count, cache_refreshed }.
 *
 * Intended to be called weekly via cron/scheduler.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1. Archive old runs
    const { data: archiveResult, error: archiveError } = await supabase.rpc(
      "archive_old_automation_runs",
    );

    if (archiveError) {
      console.error("[maintenance] Archive failed:", archiveError.message);
      return new Response(
        JSON.stringify({ ok: false, error: archiveError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const deleted_count = (archiveResult as { ok: boolean; deleted_count: number })?.deleted_count ?? 0;
    console.log(`[maintenance] Archived ${deleted_count} old automation runs`);

    // 2. Refresh story events cache
    let cache_refreshed = false;
    const { error: refreshError } = await supabase.rpc("refresh_story_events_cache");
    if (refreshError) {
      console.error("[maintenance] Cache refresh failed:", refreshError.message);
    } else {
      cache_refreshed = true;
      console.log("[maintenance] Story events cache refreshed");
    }

    // 3. Clean up old living system signals (90+ days)
    let living_signals_cleaned = 0;
    const { data: livingResult, error: livingError } = await supabase.rpc(
      "archive_old_living_signals",
    );
    if (livingError) {
      console.error("[maintenance] Living signals cleanup failed:", livingError.message);
    } else {
      living_signals_cleaned = (livingResult as { ok: boolean; deleted_count: number })?.deleted_count ?? 0;
      console.log(`[maintenance] Cleaned ${living_signals_cleaned} old living signals`);
    }

    return new Response(
      JSON.stringify({ ok: true, deleted_count, cache_refreshed, living_signals_cleaned }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[maintenance] Error:", message);
    return new Response(
      JSON.stringify({ ok: false, error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
