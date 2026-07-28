/**
 * signum-rollup-weekly — Weekly friction signal aggregation.
 *
 * WHAT: Aggregates Signum friction events from testimonium_events into operator_narrative_metrics.
 * WHERE: Runs via cron weekly (or manual admin trigger).
 * WHY: Produces aggregate friction data for the Operator Nexus without exposing individual patterns.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const FRICTION_KINDS = [
  "friction_idle",
  "friction_repeat_nav",
  "friction_abandon_flow",
  "friction_help_open",
  "friction_multi_edit",
  "assistant_intervention",
  "assistant_resolution",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const svc = createClient(supabaseUrl, serviceKey);

    // Monday-based week window (previous week)
    const now = new Date();
    const dayOfWeek = now.getUTCDay();
    const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const lastMonday = new Date(now);
    lastMonday.setUTCDate(now.getUTCDate() - mondayOffset - 7);
    lastMonday.setUTCHours(0, 0, 0, 0);
    const thisSunday = new Date(lastMonday);
    thisSunday.setUTCDate(lastMonday.getUTCDate() + 7);

    const periodStart = lastMonday.toISOString();
    const periodEnd = thisSunday.toISOString();

    // Fetch friction events for the period
    const { data: events, error: evErr } = await svc
      .from("testimonium_events")
      .select("tenant_id, event_kind, metadata")
      .in("event_kind", FRICTION_KINDS)
      .gte("occurred_at", periodStart)
      .lt("occurred_at", periodEnd)
      .limit(5000);

    if (evErr) throw evErr;
    if (!events || events.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, message: "No friction events in period", tenants_updated: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Group by tenant
    const tenantMap = new Map<string, {
      friction_idle_count: number;
      friction_repeat_nav_count: number;
      friction_abandon_count: number;
      assistant_intervention_count: number;
      assistant_resolution_count: number;
      page_counts: Record<string, number>;
    }>();

    for (const ev of events) {
      if (!tenantMap.has(ev.tenant_id)) {
        tenantMap.set(ev.tenant_id, {
          friction_idle_count: 0,
          friction_repeat_nav_count: 0,
          friction_abandon_count: 0,
          assistant_intervention_count: 0,
          assistant_resolution_count: 0,
          page_counts: {},
        });
      }
      const g = tenantMap.get(ev.tenant_id)!;

      switch (ev.event_kind) {
        case "friction_idle": g.friction_idle_count++; break;
        case "friction_repeat_nav": g.friction_repeat_nav_count++; break;
        case "friction_abandon_flow":
        case "friction_help_open":
        case "friction_multi_edit":
          g.friction_abandon_count++; break;
        case "assistant_intervention": g.assistant_intervention_count++; break;
        case "assistant_resolution": g.assistant_resolution_count++; break;
      }

      // Track page frequency
      const page = (ev.metadata as any)?.page || (ev.metadata as any)?.context || "unknown";
      g.page_counts[page] = (g.page_counts[page] || 0) + 1;
    }

    // Upsert into operator_narrative_metrics
    let tenantsUpdated = 0;
    for (const [tenantId, data] of tenantMap) {
      const topPages = Object.entries(data.page_counts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([page, count]) => ({ page, count }));

      const { error: upsertErr } = await svc
        .from("operator_narrative_metrics")
        .update({
          friction_idle_count: data.friction_idle_count,
          friction_repeat_nav_count: data.friction_repeat_nav_count,
          friction_abandon_count: data.friction_abandon_count,
          assistant_intervention_count: data.assistant_intervention_count,
          assistant_resolution_count: data.assistant_resolution_count,
          top_friction_pages: topPages,
          updated_at: new Date().toISOString(),
        })
        .eq("tenant_id", tenantId);

      if (!upsertErr) tenantsUpdated++;
    }

    const stats = {
      events_processed: events.length,
      tenants_updated: tenantsUpdated,
      unique_tenants: tenantMap.size,
    };

    // Record schedule health
    await svc.from("operator_schedules").update({
      last_run_at: new Date().toISOString(),
      last_status: "ok",
      last_stats: stats,
      last_error: null,
      updated_at: new Date().toISOString(),
    }).eq("key", "signum_rollup_weekly");

    await svc.from("system_health_events").insert({
      schedule_key: "signum_rollup_weekly",
      status: "ok",
      stats,
    });

    return new Response(
      JSON.stringify({ ok: true, ...stats }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    try {
      const svc2 = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      await svc2.from("operator_schedules").update({
        last_run_at: new Date().toISOString(),
        last_status: "error",
        last_error: { message: err.message },
        updated_at: new Date().toISOString(),
      }).eq("key", "signum_rollup_weekly");

      await svc2.from("system_health_events").insert({
        schedule_key: "signum_rollup_weekly",
        status: "error",
        error: { message: err.message },
      });
    } catch (_) { /* best effort */ }

    return new Response(
      JSON.stringify({ ok: false, error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
