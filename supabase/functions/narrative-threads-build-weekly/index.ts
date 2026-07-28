/**
 * narrative-threads-build-weekly — Assembles weekly story threads from moments.
 *
 * WHAT: Groups moments, ranks them, generates deterministic summary, inserts thread + citations.
 * WHERE: Called weekly per tenant or manually by operator.
 * WHY: Powers the "This Week's Story" card on the command center.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MOMENT_WEIGHTS: Record<string, number> = {
  reflection: 5,
  visit_note: 4,
  touchpoint: 3,
  event_attended: 2,
  signal: 1,
};

const QUIET_WEEK_TITLE = "A Quiet Week";
const QUIET_WEEK_SUMMARY =
  "Some weeks are quiet. Presence still matters. When reflections or visits are recorded, the story begins to gather here.";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { tenant_id, week_start } = await req.json();
    if (!tenant_id) throw new Error("tenant_id required");

    const svc = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Calculate week window
    const ws = week_start
      ? new Date(week_start)
      : (() => { const d = new Date(); d.setUTCDate(d.getUTCDate() - d.getUTCDay()); d.setUTCHours(0,0,0,0); return d; })();
    const we = new Date(ws);
    we.setUTCDate(we.getUTCDate() + 7);
    const weekStartStr = ws.toISOString().slice(0, 10);

    // Step 1: Refresh moments first (call the sibling function logic inline)
    // Just pull existing moments for the window
    const { data: moments } = await svc
      .from("narrative_moments")
      .select("*")
      .eq("tenant_id", tenant_id)
      .gte("occurred_at", ws.toISOString())
      .lt("occurred_at", we.toISOString())
      .order("occurred_at", { ascending: false })
      .limit(50);

    // Check for existing thread this week
    const { data: existingThread } = await svc
      .from("narrative_threads")
      .select("id")
      .eq("tenant_id", tenant_id)
      .eq("week_start", weekStartStr)
      .eq("scope", "tenant")
      .maybeSingle();

    if (existingThread) {
      return new Response(
        JSON.stringify({ ok: true, threads_created: 0, reason: "thread_exists" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let threadsCreated = 0;

    if (!moments?.length) {
      // Quiet week
      const { error } = await svc.from("narrative_threads").insert({
        tenant_id,
        week_start: weekStartStr,
        scope: "tenant",
        title: QUIET_WEEK_TITLE,
        summary: QUIET_WEEK_SUMMARY,
        signals: [],
        open_loops: [],
      });
      if (error) throw error;
      threadsCreated = 1;
    } else {
      // Rank and select top 3-7 moments
      const ranked = [...moments].sort((a, b) => {
        const wa = MOMENT_WEIGHTS[a.moment_type] || 1;
        const wb = MOMENT_WEIGHTS[b.moment_type] || 1;
        return wb - wa;
      });
      const selected = ranked.slice(0, Math.min(7, Math.max(3, ranked.length)));

      // Build deterministic summary
      const reflectionCount = selected.filter(m => m.moment_type === "reflection").length;
      const visitCount = selected.filter(m => m.moment_type === "visit_note").length;
      const eventCount = selected.filter(m => m.moment_type === "event_attended").length;
      const signalCount = selected.filter(m => m.moment_type === "signal").length;

      const parts: string[] = [];
      if (reflectionCount > 0) parts.push(`${reflectionCount} reflection${reflectionCount > 1 ? "s" : ""} recorded`);
      if (visitCount > 0) parts.push(`${visitCount} visit note${visitCount > 1 ? "s" : ""} captured`);
      if (eventCount > 0) parts.push(`${eventCount} event${eventCount > 1 ? "s" : ""} attended`);
      if (signalCount > 0) parts.push(`${signalCount} signal${signalCount > 1 ? "s" : ""} noticed`);

      const summary = parts.length > 0
        ? `This week: ${parts.join(", ")}. The story continues to form through these quiet moments of attention.`
        : "A week of steady presence — the story is taking shape.";

      const title = reflectionCount >= 2
        ? "A Week of Deepening"
        : visitCount >= 2
        ? "A Week of Presence"
        : eventCount >= 2
        ? "A Week of Showing Up"
        : "This Week's Thread";

      // Collect unique signal types
      const signalBadges = [...new Set(selected.map(m => m.moment_type))];

      // Insert thread
      const { data: thread, error: threadErr } = await svc
        .from("narrative_threads")
        .insert({
          tenant_id,
          week_start: weekStartStr,
          scope: "tenant",
          title,
          summary,
          signals: signalBadges,
          open_loops: [],
        })
        .select("id")
        .single();

      if (threadErr) throw threadErr;

      // Insert citations
      const citations = selected.map((m, i) => ({
        thread_id: thread.id,
        moment_id: m.id,
        rank: i + 1,
        used_excerpt: m.excerpt,
      }));

      if (citations.length > 0) {
        const { error: citErr } = await svc
          .from("narrative_thread_moments")
          .insert(citations);
        if (citErr) throw citErr;
      }

      threadsCreated = 1;
    }

    // Health telemetry
    await svc.from("system_health_events").insert({
      schedule_key: "narrative_threads_build_weekly",
      status: "ok",
      stats: { threads_created: threadsCreated, moments_found: moments?.length || 0 },
    }).catch(() => {});

    return new Response(
      JSON.stringify({ ok: true, threads_created: threadsCreated }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ ok: false, error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
