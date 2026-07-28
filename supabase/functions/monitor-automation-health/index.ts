import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-internal-key",
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

/**
 * monitor-automation-health
 *
 * Runs on a schedule (every 15 min via pg_cron or n8n).
 * Checks:
 *   1. Failed automation runs in the last window
 *   2. Stuck runs (dispatched/running > 10 min)
 *   3. Unified AI budget usage approaching ceiling
 *
 * Emits push notifications to admins via notification-dispatcher.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const internalNotifyKey = Deno.env.get("INTERNAL_NOTIFY_KEY") ?? "";
  const scheduleSecret = Deno.env.get("N8N_SCHEDULE_SECRET") ?? "";

  // Auth: schedule secret, anon key (cron), or service role
  const authHeader = req.headers.get("authorization") ?? "";
  const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

  const isSchedule = scheduleSecret && bearer === scheduleSecret;
  const isCron = bearer === anonKey;
  const isService = bearer === serviceKey;

  if (!isSchedule && !isCron && !isService) {
    return jsonError(401, "UNAUTHORIZED", "Invalid auth");
  }

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  const windowMinutes = 15;
  const cutoff = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString();

  const alerts: { event_type: string; fingerprint: string; title: string; body: string; deep_link: string; priority: string }[] = [];

  // 1. Check for recent failed runs
  const { data: failedRuns } = await admin
    .from("automation_runs")
    .select("run_id, workflow_key, error_message, created_at")
    .eq("status", "error")
    .gte("created_at", cutoff)
    .order("created_at", { ascending: false })
    .limit(20);

  if (failedRuns && failedRuns.length > 0) {
    // Group by workflow_key
    const byKey: Record<string, typeof failedRuns> = {};
    for (const r of failedRuns) {
      if (!byKey[r.workflow_key]) byKey[r.workflow_key] = [];
      byKey[r.workflow_key].push(r);
    }

    for (const [wk, runs] of Object.entries(byKey)) {
      const latestError = runs[0].error_message || "Unknown error";
      alerts.push({
        event_type: "automation_failed",
        fingerprint: `auto_fail_${wk}_${new Date().toISOString().slice(0, 13)}`, // hourly dedup
        title: `⚠️ ${runs.length} failed ${wk} run${runs.length > 1 ? "s" : ""}`,
        body: `Latest: ${latestError.slice(0, 200)}`,
        deep_link: "/admin/automation-health",
        priority: "high",
      });
    }
  }

  // 2. Check for stuck runs (>10 min)
  const stuckCutoff = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { data: stuckRuns } = await admin
    .from("automation_runs")
    .select("run_id, workflow_key, created_at, status")
    .in("status", ["dispatched", "running"])
    .lt("created_at", stuckCutoff)
    .limit(20);

  if (stuckRuns && stuckRuns.length > 0) {
    alerts.push({
      event_type: "automation_failed",
      fingerprint: `auto_stuck_${new Date().toISOString().slice(0, 13)}`,
      title: `🔄 ${stuckRuns.length} stuck workflow${stuckRuns.length > 1 ? "s" : ""}`,
      body: `Workflows: ${[...new Set(stuckRuns.map((r) => r.workflow_key))].join(", ")}`,
      deep_link: "/admin/automation-health",
      priority: "normal",
    });
  }

  // 3. Check unified AI budget usage against operator ceiling
  const { data: budgetRow } = await admin
    .from("operator_ai_budget")
    .select("monthly_call_cap")
    .limit(1)
    .maybeSingle();

  const monthlyCap = budgetRow?.monthly_call_cap ?? 500;
  const periodStart = new Date();
  periodStart.setUTCDate(1);
  periodStart.setUTCHours(0, 0, 0, 0);

  const { data: usageRows } = await admin
    .from("tenant_usage_counters")
    .select("ai_calls")
    .gte("period_start", periodStart.toISOString().slice(0, 10));

  const totalUsage = (usageRows || []).reduce(
    (sum: number, r: { ai_calls: number }) => sum + (r.ai_calls || 0),
    0,
  );

  const WARNING_THRESHOLD = 0.8; // 80%

  if (totalUsage >= monthlyCap * WARNING_THRESHOLD) {
    const pct = Math.round((totalUsage / monthlyCap) * 100);
    alerts.push({
      event_type: "credit_warning",
      fingerprint: `credit_ai_${new Date().toISOString().slice(0, 10)}`, // daily dedup
      title: `📊 AI budget at ${pct}%`,
      body: `${totalUsage}/${monthlyCap} calls used this month. ${totalUsage >= monthlyCap ? "Ceiling reached — new AI calls may be throttled." : "Approaching monthly ceiling."}`,
      deep_link: "/operator/system",
      priority: totalUsage >= monthlyCap ? "high" : "normal",
    });
  }

  // Emit all alerts via notification-dispatcher
  let emitted = 0;
  for (const alert of alerts) {
    try {
      const resp = await fetch(`${supabaseUrl}/functions/v1/notification-dispatcher`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${serviceKey}`,
          "x-internal-key": internalNotifyKey,
        },
        body: JSON.stringify({
          mode: "emit",
          ...alert,
          user_id: null, // broadcast to admins
          metadata: {},
          tier: "T1",
        }),
      });
      if (resp.ok) emitted++;
      await resp.text(); // consume body
    } catch (e) {
      console.error("Failed to emit alert:", e);
    }
  }

  // Also insert into user_alerts for in-app display
  if (alerts.length > 0) {
    const { data: adminUsers } = await admin
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");

    for (const adminUser of (adminUsers || [])) {
      for (const alert of alerts) {
        await admin.from("user_alerts").upsert(
          {
            user_id: adminUser.user_id,
            alert_type: alert.event_type,
            ref_type: "automation",
            ref_id: alert.fingerprint,
            message: `${alert.title} — ${alert.body}`,
          },
          { onConflict: "user_id,ref_id", ignoreDuplicates: true },
        ).then(() => {});
      }
    }
  }

  return jsonOk({
    ok: true,
    alerts_generated: alerts.length,
    alerts_emitted: emitted,
    failed_runs: failedRuns?.length || 0,
    stuck_runs: stuckRuns?.length || 0,
    ai_usage: totalUsage,
    ai_cap: monthlyCap,
  });
});
