/**
 * ecosystem-rollup-weekly — Aggregates tenant-level ecosystem health.
 *
 * WHAT: Reads testimonium_rollups + communio signals, writes ecosystem_health_rollups.
 * WHERE: Scheduled weekly or on-demand by admin.
 * WHY: Operator Console can show ecosystem health without querying heavy tables.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

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

    // Get all tenants with their archetypes
    const { data: tenants } = await svc
      .from("tenants")
      .select("id, archetype");

    let tenantsProcessed = 0;

    if (tenants) {
      for (const t of tenants) {
        const tenantId = t.id;
        const archetype = t.archetype || "unknown";

        // Count reflections this week
        const { count: reflectionsCount } = await svc
          .from("opportunity_reflections")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", tenantId)
          .gte("created_at", weekStart);

        // Count events this week
        const { count: eventsCount } = await svc
          .from("events")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", tenantId)
          .gte("created_at", weekStart);

        // Count communio shares this week
        const { count: communioShares } = await svc
          .from("communio_shared_signals")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", tenantId)
          .gte("created_at", weekStart);

        // Gather testimonium flags this week (types only, no PII)
        const { data: flags } = await svc
          .from("testimonium_flags")
          .select("flag_type")
          .eq("tenant_id", tenantId)
          .gte("created_at", weekStart)
          .limit(100);

        const flagTypes = (flags || []).map((f) => f.flag_type);

        await svc.from("ecosystem_health_rollups").upsert(
          {
            tenant_id: tenantId,
            week_start: weekStart,
            archetype,
            reflections_count: reflectionsCount ?? 0,
            events_count: eventsCount ?? 0,
            communio_shares: communioShares ?? 0,
            testimonium_flags: flagTypes,
          },
          { onConflict: "tenant_id,week_start" },
        );
        tenantsProcessed++;
      }
    }

    return new Response(
      JSON.stringify({ ok: true, tenants_processed: tenantsProcessed, week_start: weekStart }),
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
