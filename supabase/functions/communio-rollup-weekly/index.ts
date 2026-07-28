import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/** Monday of the current ISO week as yyyy-MM-dd */
function currentWeekStart(): string {
  const now = new Date();
  const day = now.getUTCDay();
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
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const weekStart = currentWeekStart();
    const { data: groups } = await svc.from("communio_groups").select("id");

    let groupsUpdated = 0;

    if (groups) {
      for (const g of groups) {
        const gid = g.id;

        // Get memberships for tenant count
        const { data: memberships } = await svc
          .from("communio_memberships")
          .select("tenant_id")
          .eq("group_id", gid);

        const tenantIds = memberships?.map((m) => m.tenant_id) ?? [];
        const tenantCount = tenantIds.length;

        // Aggregate signal types from testimonium_flags for member tenants this week
        let momentumCount = 0;
        let driftCount = 0;
        let reconnectionCount = 0;
        let growthCount = 0;

        if (tenantIds.length > 0) {
          const { data: flags } = await svc
            .from("testimonium_flags")
            .select("flag_type, tenant_id")
            .in("tenant_id", tenantIds)
            .gte("created_at", weekStart);

          for (const f of flags ?? []) {
            const ft = (f.flag_type || "").toLowerCase();
            if (ft.includes("momentum") || ft.includes("spike")) momentumCount++;
            else if (ft.includes("drift") || ft.includes("decline")) driftCount++;
            else if (ft.includes("reconnect") || ft.includes("reactivat")) reconnectionCount++;
            else if (ft.includes("growth") || ft.includes("increas")) growthCount++;
          }
        }

        // Shared events this week
        const { count: eventsCount } = await svc
          .from("communio_shared_events")
          .select("id", { count: "exact", head: true })
          .eq("group_id", gid)
          .gte("created_at", weekStart);

        await svc.from("communio_signal_metrics").upsert(
          {
            group_id: gid,
            week_start: weekStart,
            momentum_count: momentumCount,
            drift_count: driftCount,
            reconnection_count: reconnectionCount,
            growth_count: growthCount,
            shared_event_count: eventsCount ?? 0,
            tenant_count: tenantCount,
          },
          { onConflict: "group_id,week_start" },
        );
        groupsUpdated++;
      }
    }

    return new Response(
      JSON.stringify({ ok: true, groups_updated: groupsUpdated, week_start: weekStart }),
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
