/**
 * narrative-moments-refresh — Collects narrative moments from activity sources.
 *
 * WHAT: Scans activities, reflections, events, journeys, friction for moment-worthy items.
 * WHERE: Called before thread building or on schedule.
 * WHY: Moments are the atomic unit of the Narrative Engine.
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
    const { tenant_id } = await req.json();
    if (!tenant_id) throw new Error("tenant_id required");

    const svc = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    let created = 0;

    // 1. Activities (Visit Notes, Meetings, Calls)
    const { data: activities } = await svc
      .from("activities")
      .select("id, activity_type, notes, activity_date_time, opportunity_id, metro_id, tenant_id")
      .eq("tenant_id", tenant_id)
      .gte("activity_date_time", weekAgo)
      .in("activity_type", ["Visit Note", "Meeting", "Call", "Email"])
      .not("notes", "is", null)
      .limit(200);

    for (const a of activities || []) {
      const excerpt = a.activity_type === "Visit Note"
        ? (a.notes || "").slice(0, 280)
        : `${a.activity_type}: ${(a.notes || "").slice(0, 250)}`;

      const { error } = await svc.from("narrative_moments").upsert({
        tenant_id: a.tenant_id,
        metro_id: a.metro_id,
        opportunity_id: a.opportunity_id,
        source_table: "activities",
        source_id: a.id,
        moment_type: a.activity_type === "Visit Note" ? "visit_note" : "touchpoint",
        excerpt,
        occurred_at: a.activity_date_time,
      }, { onConflict: "source_table,source_id" });

      if (!error) created++;
    }

    // 2. Reflections (opportunity_reflections)
    const { data: reflections } = await svc
      .from("opportunity_reflections")
      .select("id, reflection, created_at, opportunity_id")
      .gte("created_at", weekAgo)
      .limit(200);

    for (const r of reflections || []) {
      // Get tenant from opportunity
      const { data: opp } = await svc
        .from("opportunities")
        .select("tenant_id, metro_id")
        .eq("id", r.opportunity_id)
        .single();

      if (!opp || opp.tenant_id !== tenant_id) continue;

      const { error } = await svc.from("narrative_moments").upsert({
        tenant_id,
        metro_id: opp.metro_id,
        opportunity_id: r.opportunity_id,
        source_table: "opportunity_reflections",
        source_id: r.id,
        moment_type: "reflection",
        excerpt: (r.reflection || "").slice(0, 280),
        occurred_at: r.created_at,
      }, { onConflict: "source_table,source_id" });

      if (!error) created++;
    }

    // 3. Events attended
    const { data: events } = await svc
      .from("events")
      .select("id, event_name, event_date, metro_id, tenant_id")
      .eq("tenant_id", tenant_id)
      .eq("attended", true)
      .gte("event_date", weekAgo)
      .limit(100);

    for (const e of events || []) {
      const { error } = await svc.from("narrative_moments").upsert({
        tenant_id: e.tenant_id,
        metro_id: e.metro_id,
        opportunity_id: null,
        source_table: "events",
        source_id: e.id,
        moment_type: "event_attended",
        excerpt: `Attended ${e.event_name}`,
        occurred_at: e.event_date,
      }, { onConflict: "source_table,source_id" });

      if (!error) created++;
    }

    // 4. Testimonium flags
    const { data: flags } = await svc
      .from("testimonium_flags")
      .select("id, flag_type, description, metro_id, tenant_id, created_at")
      .eq("tenant_id", tenant_id)
      .gte("created_at", weekAgo)
      .limit(100);

    for (const f of flags || []) {
      const { error } = await svc.from("narrative_moments").upsert({
        tenant_id: f.tenant_id,
        metro_id: f.metro_id,
        opportunity_id: null,
        source_table: "testimonium_flags",
        source_id: f.id,
        moment_type: "signal",
        excerpt: `Signal: ${f.flag_type} — ${(f.description || "").slice(0, 200)}`,
        occurred_at: f.created_at,
      }, { onConflict: "source_table,source_id" });

      if (!error) created++;
    }

    // Health telemetry
    await svc.from("system_health_events").insert({
      schedule_key: "narrative_moments_refresh",
      status: "ok",
      stats: { moments_created: created, tenant_id },
    }).catch(() => {});

    return new Response(
      JSON.stringify({ ok: true, moments_created: created }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ ok: false, error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
