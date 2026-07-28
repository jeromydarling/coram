/**
 * narrative-detect-moments — Detects value moments from existing signals.
 *
 * WHAT: Reads testimonium rollups, events, journey changes, voluntarium, communio
 *       and inserts deterministic narrative_value_moments.
 * WHERE: Runs weekly via cron or manual admin trigger.
 * WHY: Powers the Narrative Economy without AI generation.
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

    // Window: last 7 days
    const now = new Date();
    const weekAgo = new Date(now);
    weekAgo.setUTCDate(weekAgo.getUTCDate() - 7);
    const windowStart = weekAgo.toISOString();
    const windowEnd = now.toISOString();

    // 1. Get recent testimonium rollups for momentum/growth detection
    const { data: rollups } = await svc
      .from("testimonium_rollups")
      .select("tenant_id, metro_id, reflection_count, journey_moves, volunteer_activity, email_touch_count, event_presence_count")
      .gte("week_start", weekAgo.toISOString().slice(0, 10))
      .limit(2000);

    // 2. Get recent testimonium flags for reconnection/drift signals
    const { data: flags } = await svc
      .from("testimonium_flags")
      .select("tenant_id, metro_id, flag_type, description")
      .gte("created_at", windowStart)
      .limit(1000);

    // 3. Get communio shared signals for collaboration detection
    const { data: communioSignals } = await svc
      .from("communio_shared_signals")
      .select("tenant_id, metro_id, signal_type")
      .gte("created_at", windowStart)
      .limit(1000);

    // Dedupe key: tenant_id:moment_type:metro_id:week
    const weekKey = weekAgo.toISOString().slice(0, 10);

    // Check existing moments for this window to avoid duplicates
    const { data: existing } = await svc
      .from("narrative_value_moments")
      .select("tenant_id, moment_type, metro_id")
      .gte("occurred_at", windowStart)
      .lt("occurred_at", windowEnd);

    const existingSet = new Set(
      (existing || []).map((e: any) => `${e.tenant_id}:${e.moment_type}:${e.metro_id || "null"}`)
    );

    const moments: Array<{
      tenant_id: string;
      metro_id: string | null;
      opportunity_id: string | null;
      source: string;
      moment_type: string;
      summary: string;
    }> = [];

    function addMoment(
      tenantId: string,
      metroId: string | null,
      source: string,
      momentType: string,
      summary: string
    ) {
      const key = `${tenantId}:${momentType}:${metroId || "null"}`;
      if (!existingSet.has(key)) {
        existingSet.add(key);
        moments.push({
          tenant_id: tenantId,
          metro_id: metroId,
          opportunity_id: null,
          source,
          moment_type: momentType,
          summary: summary.slice(0, 240),
        });
      }
    }

    // Detect from rollups
    for (const r of rollups || []) {
      // Growth: reflections + journey moves
      if ((r.reflection_count ?? 0) >= 2 && (r.journey_moves ?? 0) >= 1) {
        addMoment(
          r.tenant_id,
          r.metro_id,
          "testimonium",
          "growth",
          "Reflections are deepening alongside relationship movement — a season of growth."
        );
      }

      // Momentum: journey moves + event presence
      if ((r.journey_moves ?? 0) >= 2 && (r.event_presence_count ?? 0) >= 1) {
        addMoment(
          r.tenant_id,
          r.metro_id,
          "journey",
          "momentum",
          "Relationships are advancing with community presence strengthening the path forward."
        );
      }

      // Community presence: events + volunteers
      if ((r.event_presence_count ?? 0) >= 2 || (r.volunteer_activity ?? 0) >= 2) {
        addMoment(
          r.tenant_id,
          r.metro_id,
          r.volunteer_activity >= 2 ? "voluntarium" : "signum",
          "community_presence",
          "Community presence is growing — showing up matters."
        );
      }
    }

    // Detect from testimonium flags
    for (const f of flags || []) {
      if (f.flag_type === "reconnection") {
        addMoment(
          f.tenant_id,
          f.metro_id,
          "testimonium",
          "reconnection",
          f.description || "A relationship has been renewed after a quiet season."
        );
      }
      if (f.flag_type === "momentum") {
        addMoment(
          f.tenant_id,
          f.metro_id,
          "testimonium",
          "momentum",
          f.description || "Forward movement is building across relationships."
        );
      }
      if (f.flag_type === "growth") {
        addMoment(
          f.tenant_id,
          f.metro_id,
          "testimonium",
          "growth",
          f.description || "Volunteer participation is expanding community roots."
        );
      }
    }

    // Detect communio collaboration
    const communioCounts = new Map<string, number>();
    for (const cs of communioSignals || []) {
      const key = `${cs.tenant_id}:${cs.metro_id || "null"}`;
      communioCounts.set(key, (communioCounts.get(key) || 0) + 1);
    }
    for (const [key, count] of communioCounts) {
      if (count >= 2) {
        const [tenantId, metroId] = key.split(":");
        addMoment(
          tenantId,
          metroId === "null" ? null : metroId,
          "communio",
          "collaboration",
          `Community collaboration is active — ${count} signals shared this week.`
        );
      }
    }

    // Insert moments
    if (moments.length > 0) {
      const { error: insertErr } = await svc
        .from("narrative_value_moments")
        .insert(moments);
      if (insertErr) throw insertErr;
    }

    const stats = {
      moments_created: moments.length,
      rollups_scanned: (rollups || []).length,
      flags_scanned: (flags || []).length,
      communio_signals_scanned: (communioSignals || []).length,
    };

    // Health telemetry
    await svc.from("system_health_events").insert({
      schedule_key: "narrative_detect_moments",
      status: "ok",
      stats,
    });

    return new Response(JSON.stringify({ ok: true, ...stats }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    try {
      const svc2 = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );
      await svc2.from("system_health_events").insert({
        schedule_key: "narrative_detect_moments",
        status: "error",
        error: { message: err.message },
      });
    } catch (_) { /* best effort */ }

    return new Response(JSON.stringify({ ok: false, error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
