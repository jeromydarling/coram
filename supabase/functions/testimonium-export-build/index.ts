/**
 * testimonium-export-build — Assembles a narrative export from existing signals.
 *
 * WHAT: Deterministic assembly of story sections from value moments, rollups, events.
 * WHERE: Called from Testimonium Export page.
 * WHY: Leadership gets "what we witnessed" without writing reports.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Validate caller
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { tenant_id, period_start, period_end, export_type } = body;
    if (!tenant_id || !period_start || !period_end || !export_type) {
      return new Response(JSON.stringify({ ok: false, error: "Missing required fields" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    // Verify tenant membership
    const { data: membership } = await admin
      .from("tenant_users")
      .select("id")
      .eq("tenant_id", tenant_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!membership) {
      return new Response(JSON.stringify({ ok: false, error: "Access denied" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Gather signals
    const [momentsRes, rollupsRes, eventsRes] = await Promise.all([
      admin.from("narrative_value_moments")
        .select("*")
        .eq("tenant_id", tenant_id)
        .gte("occurred_at", period_start)
        .lte("occurred_at", period_end + "T23:59:59Z")
        .order("occurred_at", { ascending: false })
        .limit(200),
      admin.from("testimonium_rollups")
        .select("*")
        .eq("tenant_id", tenant_id)
        .gte("period_start", period_start)
        .lte("period_end", period_end)
        .limit(50),
      admin.from("events")
        .select("id, event_name, event_date, metro_id")
        .eq("tenant_id", tenant_id)
        .gte("event_date", period_start)
        .lte("event_date", period_end)
        .limit(100),
    ]);

    const moments = momentsRes.data || [];
    const rollups = rollupsRes.data || [];
    const events = eventsRes.data || [];

    // Group moments by type
    const grouped: Record<string, any[]> = {};
    for (const m of moments) {
      (grouped[m.moment_type] ||= []).push(m);
    }

    // Build deterministic sections
    const sections: { section_key: string; title: string; body: any; order_index: number }[] = [];

    // Section 1: Where We Showed Up
    const presenceMoments = grouped["community_presence"] || [];
    sections.push({
      section_key: "where_we_showed_up",
      title: "Where We Showed Up",
      body: {
        narrative: presenceMoments.length > 0
          ? `During this period, ${events.length} events marked our community presence.`
          : "Community presence is quietly building.",
        highlights: presenceMoments.slice(0, 5).map((m: any) => m.summary),
        event_count: events.length,
      },
      order_index: 10,
    });

    // Section 2: What Moved Forward
    const growthMoments = grouped["growth"] || [];
    const momentumMoments = grouped["momentum"] || [];
    sections.push({
      section_key: "what_moved_forward",
      title: "What Moved Forward",
      body: {
        narrative: growthMoments.length + momentumMoments.length > 0
          ? `${growthMoments.length} growth signals and ${momentumMoments.length} momentum markers emerged.`
          : "Forward movement is gathering quietly.",
        highlights: [...growthMoments, ...momentumMoments].slice(0, 5).map((m: any) => m.summary),
      },
      order_index: 20,
    });

    // Section 3: Signals of Momentum
    sections.push({
      section_key: "signals_of_momentum",
      title: "Signals of Momentum",
      body: {
        narrative: rollups.length > 0
          ? `${rollups.length} narrative rollups captured during this period.`
          : "Signals are accumulating beneath the surface.",
        rollup_count: rollups.length,
        total_moments: moments.length,
      },
      order_index: 30,
    });

    // Section 4: Community Presence
    const reconnections = grouped["reconnection"] || [];
    const collaborations = grouped["collaboration"] || [];
    sections.push({
      section_key: "community_presence",
      title: "Community Presence",
      body: {
        narrative: reconnections.length + collaborations.length > 0
          ? `${reconnections.length} reconnections and ${collaborations.length} collaborations observed.`
          : "The community web is being woven.",
        highlights: [...reconnections, ...collaborations].slice(0, 5).map((m: any) => m.summary),
      },
      order_index: 40,
    });

    // Section 5: What We're Learning
    sections.push({
      section_key: "what_were_learning",
      title: "What We're Learning",
      body: {
        narrative: moments.length > 0
          ? `Across ${moments.length} moments, patterns of presence and growth are forming.`
          : "Learning emerges as we continue to show up.",
        moment_types: Object.keys(grouped),
        total: moments.length,
      },
      order_index: 50,
    });

    // Metrics snapshot
    const metricsSnapshot = {
      total_moments: moments.length,
      growth_count: growthMoments.length,
      momentum_count: momentumMoments.length,
      reconnection_count: reconnections.length,
      collaboration_count: collaborations.length,
      presence_count: presenceMoments.length,
      event_count: events.length,
      rollup_count: rollups.length,
    };

    // Outline
    const narrativeOutline = {
      chapters: sections.map((s) => s.title),
      period: { start: period_start, end: period_end },
    };

    // Insert export
    const { data: exportRow, error: insertErr } = await admin
      .from("testimonium_exports")
      .insert({
        tenant_id,
        period_start,
        period_end,
        export_type,
        narrative_outline: narrativeOutline,
        metrics_snapshot: metricsSnapshot,
        generated_by: user.id,
      })
      .select("id")
      .single();

    if (insertErr) throw insertErr;

    // Insert sections
    const sectionRows = sections.map((s) => ({
      export_id: exportRow.id,
      ...s,
    }));
    const { error: secErr } = await admin
      .from("testimonium_export_sections")
      .insert(sectionRows);
    if (secErr) throw secErr;

    return new Response(
      JSON.stringify({ ok: true, export_id: exportRow.id, metrics: metricsSnapshot }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    return new Response(
      JSON.stringify({ ok: false, error: e.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
