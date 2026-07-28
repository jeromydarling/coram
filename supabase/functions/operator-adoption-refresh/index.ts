import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function scoreToLabel(score: number): string {
  if (score >= 80) return "thriving";
  if (score >= 50) return "active";
  if (score >= 20) return "warming";
  return "quiet";
}

function buildNarrative(daily: Record<string, number>): string[] {
  const lines: string[] = [];
  if (daily.reflections_created > 0) lines.push("This tenant is building relationship memory steadily.");
  if (daily.signum_articles_ingested > 0) lines.push("Signum is active: local awareness is flowing into narrative.");
  if (daily.nri_suggestions_accepted > 0) lines.push("NRI suggestions are being acted on.");
  if (daily.events_added > 0) lines.push("Community presence is growing through events.");
  if (daily.voluntarium_hours_logged > 0) lines.push("Voluntārium is bringing people together.");
  if (daily.communio_shared_signals > 0) lines.push("Communio sharing is active — community trust is building.");
  if (daily.campaign_touches > 0) lines.push("Outreach is flowing through email campaigns.");
  if (lines.length === 0) lines.push("Quiet week — the system is ready when they are.");
  return lines.slice(0, 3);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startedAt = Date.now();

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user } } = await anonClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: isAdmin } = await anonClient.rpc("has_role", {
      _user_id: user.id,
      _role: "admin",
    });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Admin required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const svc = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json().catch(() => ({}));
    const tenantFilter: string | null = body.tenant_id || null;

    // Get tenants
    let tq = svc.from("tenants").select("id");
    if (tenantFilter) tq = tq.eq("id", tenantFilter);
    const { data: tenants, error: tErr } = await tq;
    if (tErr) throw tErr;
    if (!tenants?.length) {
      return new Response(JSON.stringify({ ok: true, tenants_processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().slice(0, 10);
    const dayStart = `${yesterdayStr}T00:00:00Z`;
    const dayEnd = `${yesterdayStr}T23:59:59Z`;

    // Monday of this week
    const now = new Date();
    const day = now.getDay();
    const diff = day === 0 ? 6 : day - 1;
    const monday = new Date(now);
    monday.setDate(monday.getDate() - diff);
    const weekStartStr = monday.toISOString().slice(0, 10);
    const weekStartTs = `${weekStartStr}T00:00:00Z`;

    let tenantsProcessed = 0;

    for (const t of tenants) {
      const tid = t.id;

      // Gather daily counts
      const [
        reflections,
        events,
        nriCreated,
        nriAccepted,
        communio,
        provisio,
      ] = await Promise.all([
        svc.from("opportunity_reflections").select("id", { count: "exact", head: true })
          .gte("created_at", dayStart).lte("created_at", dayEnd),
        svc.from("events").select("id", { count: "exact", head: true })
          .eq("tenant_id", tid).gte("created_at", dayStart).lte("created_at", dayEnd),
        svc.from("nri_story_signals").select("id", { count: "exact", head: true })
          .eq("tenant_id", tid).gte("created_at", dayStart).lte("created_at", dayEnd),
        svc.from("nri_story_signals").select("id", { count: "exact", head: true })
          .eq("tenant_id", tid).eq("kind", "celebration")
          .gte("created_at", dayStart).lte("created_at", dayEnd),
        svc.from("communio_shared_signals").select("id", { count: "exact", head: true })
          .eq("tenant_id", tid).gte("created_at", dayStart).lte("created_at", dayEnd),
        svc.from("provisions").select("id", { count: "exact", head: true })
          .eq("tenant_id", tid).gte("created_at", dayStart).lte("created_at", dayEnd),
      ]);

      const signum = await svc.from("discovered_items").select("id", { count: "exact", head: true })
        .eq("tenant_id", tid).gte("first_seen_at", dayStart).lte("first_seen_at", dayEnd);

      const volunteers = await svc.from("volunteer_shifts").select("minutes")
        .gte("created_at", dayStart).lte("created_at", dayEnd);

      const volMinutes = (volunteers.data || []).reduce((s: number, v: any) => s + (v.minutes || 0), 0);

      const users = await svc.from("tenant_users").select("id", { count: "exact", head: true })
        .eq("tenant_id", tid);

      const dailyRow = {
        tenant_id: tid,
        date: yesterdayStr,
        users_active: users.count ?? 0,
        reflections_created: reflections.count ?? 0,
        events_added: events.count ?? 0,
        signum_articles_ingested: signum.count ?? 0,
        nri_suggestions_created: nriCreated.count ?? 0,
        nri_suggestions_accepted: nriAccepted.count ?? 0,
        communio_shared_signals: communio.count ?? 0,
        provisio_created: provisio.count ?? 0,
        voluntarium_hours_logged: Math.round(volMinutes / 60),
        actions_logged: 0,
        emails_synced: 0,
        campaign_touches: 0,
      };

      await svc.from("operator_adoption_daily").upsert(dailyRow, {
        onConflict: "tenant_id,date",
      });

      // Weekly aggregation
      const { data: weekDays } = await svc
        .from("operator_adoption_daily")
        .select("*")
        .eq("tenant_id", tid)
        .gte("date", weekStartStr)
        .lte("date", yesterdayStr);

      const weekTotals: Record<string, number> = {
        reflections_created: 0,
        events_added: 0,
        signum_articles_ingested: 0,
        nri_suggestions_created: 0,
        nri_suggestions_accepted: 0,
        communio_shared_signals: 0,
        provisio_created: 0,
        voluntarium_hours_logged: 0,
        campaign_touches: 0,
      };

      for (const d of weekDays || []) {
        for (const k of Object.keys(weekTotals)) {
          weekTotals[k] += (d as any)[k] ?? 0;
        }
      }

      // Adoption score (0–100)
      let score = 0;
      if (weekTotals.reflections_created >= 2) score += 10;
      if (weekTotals.events_added >= 1) score += 10;
      if (weekTotals.signum_articles_ingested > 0) score += 10;
      if (weekTotals.nri_suggestions_accepted >= 1) score += 10;
      if (weekTotals.provisio_created >= 1) score += 10;
      if (weekTotals.voluntarium_hours_logged >= 1) score += 10;
      if (weekTotals.communio_shared_signals >= 1) score += 10;
      if (weekTotals.campaign_touches >= 1) score += 10;
      // Bonus for depth
      if (weekTotals.reflections_created >= 5) score += 10;
      if (weekTotals.nri_suggestions_created >= 3) score += 10;
      score = Math.min(score, 100);

      const label = scoreToLabel(score);
      const narrative = buildNarrative(weekTotals);

      await svc.from("operator_adoption_weekly").upsert({
        tenant_id: tid,
        week_start: weekStartStr,
        adoption_score: score,
        adoption_label: label,
        narrative,
      }, { onConflict: "tenant_id,week_start" });

      tenantsProcessed++;
    }

    const stats = { tenants_processed: tenantsProcessed, date: yesterdayStr, week_start: weekStartStr };

    // Job health heartbeat
    await svc.from("operator_job_health").upsert({
      tenant_id: null,
      job_key: "operator-adoption-refresh",
      cadence: "daily",
      last_run_at: new Date().toISOString(),
      last_ok_at: new Date().toISOString(),
      last_status: "ok",
      last_stats: stats,
      last_error: null,
    }, { onConflict: "tenant_id,job_key" });

    await svc.from("system_health_events").insert({
      schedule_key: "operator-adoption-refresh",
      status: "ok",
      stats,
    });

    return new Response(JSON.stringify({ ok: true, ...stats }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    try {
      const svc2 = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );
      await svc2.from("operator_job_health").upsert({
        tenant_id: null,
        job_key: "operator-adoption-refresh",
        cadence: "daily",
        last_run_at: new Date().toISOString(),
        last_status: "error",
        last_error: { message: (err as Error).message },
      }, { onConflict: "tenant_id,job_key" });
    } catch (_) { /* best effort */ }

    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
