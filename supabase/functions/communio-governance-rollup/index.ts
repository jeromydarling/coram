import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/** Monday of the current ISO week as yyyy-MM-dd */
function currentWeekStart(): string {
  const now = new Date();
  const day = now.getUTCDay(); // 0=Sun
  const diff = (day === 0 ? -6 : 1) - day;
  const mon = new Date(now);
  mon.setUTCDate(mon.getUTCDate() + diff);
  return mon.toISOString().slice(0, 10);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ── Auth: admin guard ──
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
      { global: { headers: { Authorization: authHeader } } },
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

    // ── Service role client ──
    const svc = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json().catch(() => ({}));
    const scope: string = body.scope || "all";
    const tenantIdFilter: string | null = body.tenant_id || null;
    const weekStart = currentWeekStart();

    // ════════════════════════════════════════════════
    // PART 1 — Communio Group Metrics
    // ════════════════════════════════════════════════

    const { data: groups } = await svc
      .from("communio_groups")
      .select("id");

    let groupsUpdated = 0;

    if (groups) {
      for (const g of groups) {
        const gid = g.id;

        // Tenant count + collaboration_levels
        const { data: memberships } = await svc
          .from("communio_memberships")
          .select("sharing_level")
          .eq("group_id", gid);

        const tenantCount = memberships?.length ?? 0;
        const levels: Record<string, number> = {};
        for (const m of memberships ?? []) {
          const lv = m.sharing_level || "none";
          levels[lv] = (levels[lv] || 0) + 1;
        }

        // Signals shared this week
        const { count: signalsCount } = await svc
          .from("communio_shared_signals")
          .select("id", { count: "exact", head: true })
          .eq("group_id", gid)
          .gte("created_at", weekStart);

        // Events shared this week
        const { count: eventsCount } = await svc
          .from("communio_shared_events")
          .select("id", { count: "exact", head: true })
          .eq("group_id", gid)
          .gte("created_at", weekStart);

        await svc.from("communio_group_metrics").upsert(
          {
            group_id: gid,
            tenant_count: tenantCount,
            signals_shared_count: signalsCount ?? 0,
            events_shared_count: eventsCount ?? 0,
            collaboration_levels: levels,
            week_start: weekStart,
          },
          { onConflict: "group_id,week_start" },
        );
        groupsUpdated++;
      }
    }

    // ════════════════════════════════════════════════
    // PART 2 — NRI Usage Metrics per tenant
    // ════════════════════════════════════════════════

    let tenantsQuery = svc.from("tenants").select("id");
    if (scope === "tenant" && tenantIdFilter) {
      tenantsQuery = tenantsQuery.eq("id", tenantIdFilter);
    }
    const { data: tenants } = await tenantsQuery;

    let tenantsUpdated = 0;

    if (tenants) {
      for (const t of tenants) {
        const tid = t.id;

        // Signals generated (testimonium_events this week)
        const { count: sigGen } = await svc
          .from("testimonium_events")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", tid)
          .gte("occurred_at", weekStart);

        // Signals shared to communio this week
        const { count: sigShared } = await svc
          .from("communio_shared_signals")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", tid)
          .gte("created_at", weekStart);

        // Reflections triggered (impulsus_entries this week)
        const { count: reflections } = await svc
          .from("impulsus_entries")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", tid)
          .gte("created_at", weekStart);

        // Testimonium flags generated this week
        const { count: flags } = await svc
          .from("testimonium_flags")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", tid)
          .gte("created_at", weekStart);

        await svc.from("nri_usage_metrics").upsert(
          {
            tenant_id: tid,
            week_start: weekStart,
            signals_generated: sigGen ?? 0,
            signals_shared_to_communio: sigShared ?? 0,
            reflections_triggered: reflections ?? 0,
            testimonium_flags_generated: flags ?? 0,
          },
          { onConflict: "tenant_id,week_start" },
        );
        tenantsUpdated++;
      }
    }

    return new Response(
      JSON.stringify({ ok: true, groups_updated: groupsUpdated, tenants_updated: tenantsUpdated }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
