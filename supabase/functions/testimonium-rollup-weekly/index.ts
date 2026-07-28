/**
 * testimonium-rollup-weekly — Weekly aggregation + gentle flag detection.
 *
 * WHAT: Aggregates testimonium_events into rollups and detects narrative signals.
 * WHERE: Runs via cron weekly (or manual admin trigger).
 * WHY: Produces summary data without analytics pressure.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const svc = createClient(supabaseUrl, serviceKey);

    // Determine week window (Monday-based)
    const now = new Date();
    const dayOfWeek = now.getUTCDay();
    const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const lastMonday = new Date(now);
    lastMonday.setUTCDate(now.getUTCDate() - mondayOffset - 7);
    lastMonday.setUTCHours(0, 0, 0, 0);
    const thisSunday = new Date(lastMonday);
    thisSunday.setUTCDate(lastMonday.getUTCDate() + 7);

    const weekStart = lastMonday.toISOString().slice(0, 10);
    const periodStart = lastMonday.toISOString();
    const periodEnd = thisSunday.toISOString();

    // Get all tenants with events in this period
    const { data: events, error: evErr } = await svc
      .from("testimonium_events")
      .select("tenant_id, metro_id, source_module, event_kind")
      .gte("occurred_at", periodStart)
      .lt("occurred_at", periodEnd)
      .limit(5000);

    if (evErr) throw evErr;
    if (!events || events.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, message: "No events in period", rollups: 0, flags: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Group by tenant + metro
    const groups = new Map<string, {
      tenant_id: string;
      metro_id: string | null;
      reflection_count: number;
      email_touch_count: number;
      event_presence_count: number;
      journey_moves: number;
      volunteer_activity: number;
      provisions_created: number;
      migration_activity: number;
    }>();

    for (const ev of events) {
      const key = `${ev.tenant_id}:${ev.metro_id || "null"}`;
      if (!groups.has(key)) {
        groups.set(key, {
          tenant_id: ev.tenant_id,
          metro_id: ev.metro_id,
          reflection_count: 0,
          email_touch_count: 0,
          event_presence_count: 0,
          journey_moves: 0,
          volunteer_activity: 0,
          provisions_created: 0,
          migration_activity: 0,
        });
      }
      const g = groups.get(key)!;

      switch (ev.source_module) {
        case "impulsus":
          g.reflection_count++;
          break;
        case "email":
        case "campaign":
          g.email_touch_count++;
          break;
        case "event":
          g.event_presence_count++;
          break;
        case "journey":
          g.journey_moves++;
          break;
        case "voluntarium":
          g.volunteer_activity++;
          break;
        case "provisio":
          g.provisions_created++;
          break;
        case "migration":
        case "demo_lab":
          g.migration_activity++;
          break;
      }
    }

    // Upsert rollups
    const rollupRows = Array.from(groups.values()).map((g) => ({
      ...g,
      week_start: weekStart,
    }));

    const { error: upsertErr } = await svc
      .from("testimonium_rollups")
      .upsert(rollupRows, {
        onConflict: "tenant_id,week_start,metro_id",
      });

    if (upsertErr) throw upsertErr;

    // Detect gentle flags by comparing to previous week
    const prevWeekStart = new Date(lastMonday);
    prevWeekStart.setUTCDate(prevWeekStart.getUTCDate() - 7);
    const prevWeekStr = prevWeekStart.toISOString().slice(0, 10);

    const { data: prevRollups } = await svc
      .from("testimonium_rollups")
      .select("*")
      .eq("week_start", prevWeekStr);

    const prevMap = new Map<string, any>();
    for (const r of prevRollups || []) {
      prevMap.set(`${r.tenant_id}:${r.metro_id || "null"}`, r);
    }

    const flags: Array<{
      tenant_id: string;
      metro_id: string | null;
      flag_type: string;
      description: string;
    }> = [];

    for (const [key, curr] of groups) {
      const prev = prevMap.get(key);

      // Momentum: journey moves increasing
      if (prev && curr.journey_moves > prev.journey_moves && curr.journey_moves >= 2) {
        flags.push({
          tenant_id: curr.tenant_id,
          metro_id: curr.metro_id,
          flag_type: "momentum",
          description: `Relationships are moving forward — ${curr.journey_moves} journey transitions this week.`,
        });
      }

      // Drift: reflections dropped 50%+
      if (prev && prev.reflection_count >= 2 && curr.reflection_count < prev.reflection_count * 0.5) {
        flags.push({
          tenant_id: curr.tenant_id,
          metro_id: curr.metro_id,
          flag_type: "drift",
          description: "Reflections have quieted. Perhaps this is a season of listening.",
        });
      }

      // Reconnection: email touches resume after gap
      if (prev && prev.email_touch_count === 0 && curr.email_touch_count >= 2) {
        flags.push({
          tenant_id: curr.tenant_id,
          metro_id: curr.metro_id,
          flag_type: "reconnection",
          description: "Outreach has resumed after a quiet period. Connections are being renewed.",
        });
      }

      // Growth: volunteer activity increasing
      if (prev && curr.volunteer_activity > prev.volunteer_activity && curr.volunteer_activity >= 2) {
        flags.push({
          tenant_id: curr.tenant_id,
          metro_id: curr.metro_id,
          flag_type: "growth",
          description: `Community presence is growing — ${curr.volunteer_activity} volunteer moments this week.`,
        });
      }
    }

    if (flags.length > 0) {
      await svc.from("testimonium_flags").insert(flags);
    }

    const stats = {
      tenants_processed: new Set(Array.from(groups.values()).map(g => g.tenant_id)).size,
      metros_processed: groups.size,
      rollups_written: rollupRows.length,
      flags_created: flags.length,
    };

    // Write schedule health
    await svc
      .from("operator_schedules")
      .update({
        last_run_at: new Date().toISOString(),
        last_status: "ok",
        last_stats: stats,
        last_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq("key", "testimonium_rollup_weekly");

    await svc.from("system_health_events").insert({
      schedule_key: "testimonium_rollup_weekly",
      status: "ok",
      stats,
    });

    return new Response(
      JSON.stringify({ ok: true, ...stats }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    // Try to record failure
    try {
      const svc2 = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );
      await svc2
        .from("operator_schedules")
        .update({
          last_run_at: new Date().toISOString(),
          last_status: "error",
          last_error: { message: err.message },
          updated_at: new Date().toISOString(),
        })
        .eq("key", "testimonium_rollup_weekly");

      await svc2.from("system_health_events").insert({
        schedule_key: "testimonium_rollup_weekly",
        status: "error",
        error: { message: err.message },
      });
    } catch (_) { /* best effort */ }

    return new Response(
      JSON.stringify({ ok: false, error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
