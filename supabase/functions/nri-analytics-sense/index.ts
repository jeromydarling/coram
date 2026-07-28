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
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const today = new Date().toISOString().slice(0, 10);
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);

    // Check existing notes today (max 3/day)
    const { count: todayNotes } = await supabase
      .from("operator_insight_notes")
      .select("*", { count: "exact", head: true })
      .gte("created_at", `${today}T00:00:00Z`);

    if ((todayNotes ?? 0) >= 3) {
      return new Response(
        JSON.stringify({ ok: true, message: "Daily suggestion limit reached (3)" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const suggestions: Array<{ type: string; title: string; narrative: string; evidence: Record<string, unknown>; deep_link?: string }> = [];

    // Read recent rollups for analysis
    const { data: rollups } = await supabase
      .from("operator_analytics_rollups")
      .select("*")
      .gte("day", weekAgo)
      .order("day", { ascending: false });

    if (!rollups?.length) {
      return new Response(
        JSON.stringify({ ok: true, message: "No rollup data to analyze" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Analyze friction patterns (non-error only)
    const frictionRollups = rollups.filter((r: any) => r.metric_key === "friction_signals");
    const avgFriction = frictionRollups.reduce((s: number, r: any) => s + r.metric_value, 0) / Math.max(frictionRollups.length, 1);

    if (avgFriction > 5) {
      suggestions.push({
        type: "ux_suggestion",
        title: "Friction patterns are elevated this week",
        narrative: `An average of ${Math.round(avgFriction)} friction signals per day were detected. Consider reviewing the most common friction routes to identify UI improvements.`,
        evidence: {
          metrics: { avg_daily_friction: Math.round(avgFriction) },
          time_window: "7 days",
          impacted_routes: ["/operator/nexus/friction"],
        },
        deep_link: "/operator/nexus/friction",
      });
    }

    // Analyze adoption — check if tenants are growing but module usage isn't
    const tenantRollups = rollups.filter((r: any) => r.metric_key === "active_tenants");
    const latestTenants = tenantRollups[0]?.metric_value ?? 0;

    if (latestTenants > 3) {
      suggestions.push({
        type: "adoption_suggestion",
        title: "Consider highlighting underused modules",
        narrative: `With ${latestTenants} active tenants, some modules may have low adoption. Gentle onboarding prompts or formation messages could help teams discover features naturally.`,
        evidence: {
          metrics: { active_tenants: latestTenants },
          time_window: "current",
        },
        deep_link: "/operator/nexus/adoption",
      });
    }

    // ── PAID-EVENT TEAM MATURITY (Scientia signal for Operator) ──
    // Check if any tenants created paid events this week
    const { data: paidEvents } = await supabase
      .from("events")
      .select("tenant_id")
      .eq("is_paid", true)
      .gte("created_at", `${weekAgo}T00:00:00Z`)
      .limit(500);

    if (paidEvents && paidEvents.length > 0) {
      const uniquePaidTenants = new Set(paidEvents.map((e: any) => e.tenant_id).filter(Boolean));
      if (uniquePaidTenants.size > 0) {
        suggestions.push({
          type: "maturity_signal",
          title: "Teams are embracing participation payments",
          narrative: `${uniquePaidTenants.size} organization${uniquePaidTenants.size > 1 ? "s" : ""} created paid events this week — ${paidEvents.length} total. This is a sign of growing confidence in using financial moments relationally.`,
          evidence: {
            metrics: {
              tenants_with_paid_events: uniquePaidTenants.size,
              paid_events_created: paidEvents.length,
            },
            time_window: "7 days",
          },
          deep_link: "/operator/scientia/adoption",
        });
      }
    }

    // Limit to remaining budget
    const budget = 3 - (todayNotes ?? 0);
    const toInsert = suggestions.slice(0, budget);

    for (const s of toInsert) {
      await supabase.from("operator_insight_notes").insert(s);
    }

    return new Response(
      JSON.stringify({ ok: true, suggestions_created: toInsert.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ ok: false, error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
