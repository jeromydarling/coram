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
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify caller is admin
    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const {
      data: { user },
    } = await anonClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: roleCheck } = await anonClient.rpc("has_role", {
      _user_id: user.id,
      _role: "admin",
    });
    if (!roleCheck) {
      return new Response(JSON.stringify({ error: "Admin required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Service role client for writes
    const svc = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json().catch(() => ({}));
    const scope: string = body.scope || "all";
    const tenantIdFilter: string | null = body.tenant_id || null;

    // 1. Get tenants
    let tenantsQuery = svc.from("tenants").select("id, slug, archetype");
    if (scope === "tenant" && tenantIdFilter) {
      tenantsQuery = tenantsQuery.eq("id", tenantIdFilter);
    }
    const { data: tenants, error: tErr } = await tenantsQuery;
    if (tErr) throw tErr;
    if (!tenants || tenants.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, tenants_processed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const archCounts: Record<
      string,
      { count: number; reflectionDays: number[]; eventDays: number[]; signalDays: number[] }
    > = {};

    for (const t of tenants) {
      const tid = t.id;
      const arch = t.archetype || "unknown";

      // Counts
      const [opps, evts, refs, sigs, users, communio] = await Promise.all([
        svc.from("opportunities").select("id", { count: "exact", head: true }).eq("tenant_id", tid),
        svc.from("events").select("id", { count: "exact", head: true }).eq("tenant_id", tid),
        svc.from("opportunity_reflections").select("id", { count: "exact", head: true }),
        svc.from("testimonium_events").select("id", { count: "exact", head: true }).eq("tenant_id", tid),
        svc.from("tenant_users").select("id", { count: "exact", head: true }).eq("tenant_id", tid),
        svc.from("communio_memberships").select("id", { count: "exact", head: true }).eq("tenant_id", tid),
      ]);

      // Last activity
      const { data: lastAct } = await svc
        .from("testimonium_events")
        .select("occurred_at")
        .eq("tenant_id", tid)
        .order("occurred_at", { ascending: false })
        .limit(1);

      const stats = {
        tenant_id: tid,
        archetype: arch,
        active_users: users.count ?? 0,
        opportunities_count: opps.count ?? 0,
        events_count: evts.count ?? 0,
        reflections_count: refs.count ?? 0,
        narrative_signals_count: sigs.count ?? 0,
        communio_opt_in: (communio.count ?? 0) > 0,
        last_activity_at: lastAct?.[0]?.occurred_at ?? null,
        updated_at: new Date().toISOString(),
      };

      await svc.from("operator_tenant_stats").upsert(stats, {
        onConflict: "tenant_id",
      });

      // Narrative metrics
      const { data: driftRows } = await svc
        .from("testimonium_flags")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tid)
        .eq("flag_type", "drift");

      await svc.from("operator_narrative_metrics").upsert(
        {
          tenant_id: tid,
          signal_count: sigs.count ?? 0,
          drift_events: driftRows?.length ?? 0,
          heatmap_updates: 0,
          testimonium_runs: sigs.count ?? 0,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "tenant_id" }
      );

      // Integration health from migration_runs
      const { data: migRuns } = await svc
        .from("migration_runs")
        .select("connector_key, environment, status")
        .eq("tenant_id", tid)
        .order("started_at", { ascending: false })
        .limit(50);

      if (migRuns && migRuns.length > 0) {
        const connGroups: Record<string, typeof migRuns> = {};
        for (const r of migRuns) {
          const key = `${r.connector_key}:${r.environment}`;
          if (!connGroups[key]) connGroups[key] = [];
          connGroups[key].push(r);
        }
        for (const [gk, runs] of Object.entries(connGroups)) {
          const [ck, env] = gk.split(":");
          const total = runs.length;
          const errors = runs.filter((r) => r.status === "failed").length;
          const rate = total > 0 ? ((total - errors) / total) * 100 : 100;
          const lastStatus =
            errors > 0 && errors / total > 0.3
              ? "error"
              : errors > 0
              ? "warning"
              : "ok";

          await svc.from("operator_integration_health").upsert(
            {
              tenant_id: tid,
              connector_key: ck,
              environment: env,
              last_sync_at: new Date().toISOString(),
              last_status: lastStatus,
              success_rate: Math.round(rate * 10) / 10,
              error_count: errors,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "tenant_id,connector_key,environment" }
          );
        }
      }

      // Archetype aggregation prep
      if (!archCounts[arch]) {
        archCounts[arch] = { count: 0, reflectionDays: [], eventDays: [], signalDays: [] };
      }
      archCounts[arch].count++;
    }

    // Archetype metrics
    for (const [arch, data] of Object.entries(archCounts)) {
      await svc.from("operator_archetype_metrics").upsert(
        {
          archetype: arch,
          tenant_count: data.count,
          avg_days_to_first_reflection: 0,
          avg_days_to_first_event: 0,
          avg_days_to_first_signal: 0,
          conversion_rate: 0,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "archetype" }
      );
    }

    // ── Phase 8: Metro ecosystem metrics ──
    // Compute tenant_count per metro, expansion interest, growth velocity
    const metroTenantCounts: Record<string, number> = {};
    for (const t of tenants) {
      // Count tenants per metro via tenant_users → opportunities → metros
      // Simplified: use opportunities count as proxy for metro engagement
    }

    // Aggregate metros
    const { data: allMetros } = await svc
      .from("metros")
      .select("id, ecosystem_status, expansion_priority");

    if (allMetros) {
      for (const metro of allMetros) {
        // Count tenants with opportunities in this metro
        const { count: oppTenants } = await svc
          .from("opportunities")
          .select("tenant_id", { count: "exact", head: true })
          .eq("metro_id", metro.id);

        // Count expansion interest edges
        const { count: expansionInterest } = await svc
          .from("ecosystem_edges")
          .select("id", { count: "exact", head: true })
          .eq("edge_type", "expansion_interest");

        // Growth velocity: events in last 30 days vs previous 30 days
        const now30 = new Date(Date.now() - 30 * 86400000).toISOString();
        const now60 = new Date(Date.now() - 60 * 86400000).toISOString();

        const { count: eventsRecent } = await svc
          .from("events")
          .select("id", { count: "exact", head: true })
          .eq("metro_id", metro.id)
          .gte("event_date", now30);

        const { count: eventsPrior } = await svc
          .from("events")
          .select("id", { count: "exact", head: true })
          .eq("metro_id", metro.id)
          .gte("event_date", now60)
          .lt("event_date", now30);

        const prior = eventsPrior ?? 0;
        const recent = eventsRecent ?? 0;
        const velocity = prior > 0 ? ((recent - prior) / prior) * 100 : (recent > 0 ? 100 : 0);

        // Communio overlap: shared signals in this metro
        const { count: communioSignals } = await svc
          .from("communio_shared_signals")
          .select("id", { count: "exact", head: true })
          .eq("metro_id", metro.id);

        await svc.from("operator_metro_metrics").upsert(
          {
            metro_id: metro.id,
            tenant_count: oppTenants ?? 0,
            expansion_interest_count: expansionInterest ?? 0,
            growth_velocity: Math.round(velocity * 10) / 10,
            communio_overlap_score: Math.min(100, (communioSignals ?? 0) * 10),
            updated_at: new Date().toISOString(),
          },
          { onConflict: "metro_id" }
        );
      }
    }

    // NRI story signals count (last 7 days)
    const { count: signalCount7d } = await svc
      .from("nri_story_signals")
      .select("id", { count: "exact", head: true })
      .gte("created_at", new Date(Date.now() - 7 * 86400000).toISOString());

    // Drift flags count (last 7 days)
    const { count: driftFlags7d } = await svc
      .from("testimonium_flags")
      .select("id", { count: "exact", head: true })
      .eq("flag_type", "drift")
      .gte("created_at", new Date(Date.now() - 7 * 86400000).toISOString());

    // Latest system_health_events per schedule_key
    const { data: latestHealthEvents } = await svc
      .from("system_health_events")
      .select("*")
      .order("occurred_at", { ascending: false })
      .limit(20);

    const stats = {
      tenants_processed: tenants.length,
      nri_signals_7d: signalCount7d ?? 0,
      drift_flags_7d: driftFlags7d ?? 0,
      latest_health_events: (latestHealthEvents || []).length,
    };

    // Write operator-refresh schedule health
    await svc
      .from("operator_schedules")
      .update({
        last_run_at: new Date().toISOString(),
        last_status: "ok",
        last_stats: stats,
        last_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq("key", "operator_refresh_daily");

    await svc.from("system_health_events").insert({
      schedule_key: "operator_refresh_daily",
      status: "ok",
      stats,
    });

    return new Response(
      JSON.stringify({ ok: true, ...stats }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
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
          last_error: { message: (err as Error).message },
          updated_at: new Date().toISOString(),
        })
        .eq("key", "operator_refresh_daily");

      await svc2.from("system_health_events").insert({
        schedule_key: "operator_refresh_daily",
        status: "error",
        error: { message: (err as Error).message },
      });
    } catch (_) { /* best effort */ }

    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
