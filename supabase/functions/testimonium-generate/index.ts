import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing auth" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify user
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error: userErr,
    } = await userClient.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { period_start, period_end, tenant_id, scope } = await req.json();
    if (!period_start || !period_end || !tenant_id) {
      return new Response(
        JSON.stringify({ error: "Missing period_start, period_end, tenant_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const admin = createClient(supabaseUrl, serviceKey);

    // Verify membership + role
    const { data: membership } = await admin
      .from("tenant_users")
      .select("user_id")
      .eq("tenant_id", tenant_id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!membership) {
      return new Response(JSON.stringify({ error: "Not a tenant member" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: roleCheck } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .in("role", ["admin", "leadership", "regional_lead"]);
    if (!roleCheck || roleCheck.length === 0) {
      return new Response(
        JSON.stringify({ error: "Requires admin/leadership role" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create generation run
    const { data: run, error: runErr } = await admin
      .from("testimonium_generation_runs")
      .insert({
        tenant_id,
        status: "running",
        period_start,
        period_end,
      })
      .select("id")
      .single();
    if (runErr) throw runErr;

    // Aggregate NRI signals
    const { data: signals } = await admin
      .from("nri_signals")
      .select("source, signal_type, signal_strength")
      .eq("tenant_id", tenant_id)
      .gte("occurred_at", period_start)
      .lte("occurred_at", period_end);

    const signalsBySource: Record<string, { count: number; avgStrength: number; types: string[] }> = {};
    for (const s of signals || []) {
      if (!signalsBySource[s.source]) {
        signalsBySource[s.source] = { count: 0, avgStrength: 0, types: [] };
      }
      const bucket = signalsBySource[s.source];
      bucket.count++;
      bucket.avgStrength =
        (bucket.avgStrength * (bucket.count - 1) + s.signal_strength) / bucket.count;
      if (!bucket.types.includes(s.signal_type)) bucket.types.push(s.signal_type);
    }

    // Count events attended
    const { count: eventsCount } = await admin
      .from("events")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", tenant_id)
      .gte("event_date", period_start)
      .lte("event_date", period_end);

    // Count volunteer hours
    const { data: volData } = await admin
      .from("volunteer_shifts")
      .select("minutes")
      .gte("shift_date", period_start)
      .lte("shift_date", period_end);
    const totalVolMinutes = (volData || []).reduce((s, r) => s + (r.minutes || 0), 0);

    // Count opportunities progress
    const { count: oppCount } = await admin
      .from("opportunities")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", tenant_id)
      .gte("updated_at", period_start)
      .lte("updated_at", period_end);

    // Count reflections (non-private summary only)
    const { count: reflectionCount } = await admin
      .from("opportunity_reflections")
      .select("*", { count: "exact", head: true })
      .gte("created_at", period_start)
      .lte("created_at", period_end);

    // Build narrative JSON (structured, no raw content)
    const stats = {
      nri_signals: signals?.length || 0,
      events_attended: eventsCount || 0,
      volunteer_hours: Math.round(totalVolMinutes / 60),
      relationships_active: oppCount || 0,
      reflections_captured: reflectionCount || 0,
    };

    const narrativeJson = {
      headline: `Narrative Report: ${period_start} to ${period_end}`,
      stats,
      community_movement: {
        summary: buildMovementSummary(signalsBySource),
        signal_count: signalsBySource["civitas"]?.count || 0,
      },
      relationship_growth: {
        summary: `${oppCount || 0} relationships showed activity during this period.`,
        reflections: reflectionCount || 0,
      },
      local_pulse: {
        summary: buildPulseSummary(signalsBySource),
        events: eventsCount || 0,
      },
      volunteer_story: {
        summary: `${Math.round(totalVolMinutes / 60)} volunteer hours contributed across the community.`,
        total_hours: Math.round(totalVolMinutes / 60),
      },
      momentum_summary: {
        summary: buildMomentumSummary(stats),
        signals_by_source: signalsBySource,
      },
    };

    // Create report
    const title = `Community Narrative — ${period_start} to ${period_end}`;
    const { data: report, error: reportErr } = await admin
      .from("testimonium_reports")
      .insert({
        tenant_id,
        title,
        period_start,
        period_end,
        scope: scope || {},
        narrative_json: narrativeJson,
        generated_by: user.id,
      })
      .select("id")
      .single();
    if (reportErr) throw reportErr;

    // Create sections
    const sections = [
      { section_key: "community_movement", order_index: 1, title: "Community Movement", content: narrativeJson.community_movement },
      { section_key: "relationship_growth", order_index: 2, title: "Relationship Growth", content: narrativeJson.relationship_growth },
      { section_key: "local_pulse", order_index: 3, title: "Local Pulse", content: narrativeJson.local_pulse },
      { section_key: "voluntarium", order_index: 4, title: "Voluntārium Impact", content: narrativeJson.volunteer_story },
      { section_key: "momentum_summary", order_index: 5, title: "Momentum Summary", content: narrativeJson.momentum_summary },
    ];

    await admin.from("testimonium_sections").insert(
      sections.map((s) => ({ ...s, report_id: report.id }))
    );

    // Mark run complete
    await admin
      .from("testimonium_generation_runs")
      .update({ status: "complete", stats })
      .eq("id", run.id);

    return new Response(
      JSON.stringify({ ok: true, report_id: report.id, stats }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("testimonium-generate error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function buildMovementSummary(
  sources: Record<string, { count: number; avgStrength: number; types: string[] }>
): string {
  const civitas = sources["civitas"];
  const signum = sources["signum"];
  const parts: string[] = [];
  if (civitas && civitas.count > 0) {
    parts.push(`${civitas.count} community narrative signals detected`);
  }
  if (signum && signum.count > 0) {
    parts.push(`${signum.count} local pulse insights gathered`);
  }
  return parts.length > 0
    ? parts.join(". ") + "."
    : "Community signals are still growing — narrative will develop over time.";
}

function buildPulseSummary(
  sources: Record<string, { count: number; avgStrength: number; types: string[] }>
): string {
  const events = sources["events"];
  const signum = sources["signum"];
  const parts: string[] = [];
  if (events && events.count > 0) {
    parts.push(`${events.count} event-related signals captured`);
  }
  if (signum && signum.count > 0) {
    parts.push(`Local awareness growing with ${signum.count} pulse insights`);
  }
  return parts.length > 0
    ? parts.join(". ") + "."
    : "Local pulse is quiet this period — consider attending upcoming community events.";
}

function buildMomentumSummary(stats: Record<string, number>): string {
  const total = stats.nri_signals + stats.events_attended + stats.relationships_active;
  if (total > 20) {
    return "Strong narrative momentum this period — your community presence is deepening.";
  }
  if (total > 5) {
    return "Steady progress — relationships and community engagement continue to grow.";
  }
  return "Early stages of narrative development — each interaction builds the foundation.";
}
