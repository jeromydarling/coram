import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * automation-gate — Central dispatcher for all scheduled/background work.
 *
 * Before creating an automation_run, this function:
 *  1. Checks cooldown via check_automation_cooldown()
 *  2. Checks dedupe_key uniqueness
 *  3. Creates the run record
 *  4. Returns { allowed, run_id } or { allowed: false, reason }
 *
 * Body:
 * {
 *   workflow_key: string          — e.g. "gmail_task_parse", "local_pulse_crawl"
 *   dedupe_key?: string           — optional idempotency key
 *   cooldown_seconds?: number     — minimum seconds between runs (default: 0)
 *   priority?: number             — 1-10, default 5
 *   metro_id?: string
 *   org_id?: string
 *   payload?: object
 *   triggered_by?: string         — user_id or "cron"
 * }
 */

// Known workflow configs with default cooldowns
const WORKFLOW_DEFAULTS: Record<string, { cooldown: number; priority: number }> = {
  gmail_task_parse:     { cooldown: 3600,   priority: 5 },   // hourly
  local_pulse_crawl:    { cooldown: 604800, priority: 3 },   // weekly
  metro_narrative_build:{ cooldown: 604800, priority: 4 },   // weekly
  drift_detection:      { cooldown: 604800, priority: 3 },   // weekly
  discovery_scrape:     { cooldown: 3600,   priority: 5 },   // manual + scheduled
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json();
    const {
      workflow_key,
      dedupe_key,
      cooldown_seconds,
      priority,
      metro_id,
      org_id,
      payload,
      triggered_by,
    } = body;

    if (!workflow_key) {
      return new Response(
        JSON.stringify({ allowed: false, reason: "missing_workflow_key" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Resolve defaults
    const defaults = WORKFLOW_DEFAULTS[workflow_key] || { cooldown: 0, priority: 5 };
    const effectiveCooldown = cooldown_seconds ?? defaults.cooldown;
    const effectivePriority = priority ?? defaults.priority;
    const effectiveDedupeKey = dedupe_key || `${workflow_key}:${metro_id || "global"}`;

    // 1. Check cooldown
    const { data: cooldownResult, error: cooldownError } = await supabase.rpc(
      "check_automation_cooldown",
      {
        p_workflow_key: workflow_key,
        p_dedupe_key: effectiveDedupeKey,
        p_cooldown_seconds: effectiveCooldown,
      },
    );

    if (cooldownError) {
      console.error("[automation-gate] Cooldown check failed:", cooldownError.message);
      return new Response(
        JSON.stringify({ allowed: false, reason: "cooldown_check_error", error: cooldownError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const cooldownData = cooldownResult as { allowed: boolean; reason: string; seconds_remaining?: number };

    if (!cooldownData.allowed) {
      console.log(
        `[automation-gate] Blocked ${workflow_key} (${effectiveDedupeKey}): ${cooldownData.reason}, ${cooldownData.seconds_remaining}s remaining`,
      );
      return new Response(
        JSON.stringify({
          allowed: false,
          reason: cooldownData.reason,
          seconds_remaining: cooldownData.seconds_remaining,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 2. Create the automation run
    const runId = crypto.randomUUID();
    const { error: insertError } = await supabase.from("automation_runs").insert({
      run_id: runId,
      workflow_key,
      dedupe_key: effectiveDedupeKey,
      cooldown_seconds: effectiveCooldown,
      priority: effectivePriority,
      status: "dispatched",
      metro_id: metro_id || null,
      org_id: org_id || null,
      payload: payload || null,
      triggered_by: triggered_by || null,
    });

    if (insertError) {
      console.error("[automation-gate] Insert failed:", insertError.message);
      return new Response(
        JSON.stringify({ allowed: false, reason: "insert_error", error: insertError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log(`[automation-gate] Dispatched ${workflow_key} run=${runId} dedupe=${effectiveDedupeKey}`);

    return new Response(
      JSON.stringify({ allowed: true, run_id: runId, workflow_key }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[automation-gate] Error:", message);
    return new Response(
      JSON.stringify({ allowed: false, reason: "internal_error", error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
