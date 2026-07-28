/**
 * communio-governance-scan — Weekly scan for abnormal Communio sharing patterns.
 *
 * WHAT: Detects excessive sharing volume and unusual spikes per group.
 * WHERE: Runs weekly via cron or on-demand from operator console.
 * WHY: Protects community trust by flagging anomalies without exposing private data.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user } } = await anonClient.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    const { data: isAdmin } = await anonClient.rpc("has_role", {
      _user_id: user.id,
      _role: "admin",
    });
    if (!isAdmin) return json({ error: "Admin required" }, 403);

    const svc = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
    const flagsCreated: string[] = [];

    // Get all groups
    const { data: groups } = await svc
      .from("communio_groups")
      .select("id, name");

    if (groups) {
      for (const group of groups) {
        // Count shared signals this week
        const { count: signalCount } = await svc
          .from("communio_shared_signals")
          .select("id", { count: "exact", head: true })
          .eq("group_id", group.id)
          .gte("created_at", weekAgo);

        // Count shared events this week
        const { count: eventCount } = await svc
          .from("communio_shared_events")
          .select("id", { count: "exact", head: true })
          .eq("group_id", group.id)
          .gte("created_at", weekAgo);

        const totalShares = (signalCount ?? 0) + (eventCount ?? 0);

        // Get member count
        const { count: memberCount } = await svc
          .from("communio_memberships")
          .select("id", { count: "exact", head: true })
          .eq("group_id", group.id);

        const members = memberCount ?? 1;

        // Excessive sharing: > 50 shares per member per week
        if (totalShares > members * 50) {
          // Check per-tenant distribution for suspicious patterns
          const { data: tenantSignals } = await svc
            .from("communio_shared_signals")
            .select("tenant_id")
            .eq("group_id", group.id)
            .gte("created_at", weekAgo);

          const tenantCounts: Record<string, number> = {};
          for (const ts of tenantSignals ?? []) {
            tenantCounts[ts.tenant_id] = (tenantCounts[ts.tenant_id] ?? 0) + 1;
          }

          // Check if one tenant dominates (>80% of all shares)
          const maxTenantShares = Math.max(...Object.values(tenantCounts), 0);
          const isSuspicious = totalShares > 0 && maxTenantShares / totalShares > 0.8;

          // Don't re-flag if already flagged this week
          const { data: existing } = await svc
            .from("communio_governance_flags")
            .select("id")
            .eq("group_id", group.id)
            .eq("status", "open")
            .gte("created_at", weekAgo)
            .limit(1);

          if (!existing || existing.length === 0) {
            const flagType = isSuspicious ? "suspicious_pattern" : "excessive_sharing";
            const details = isSuspicious
              ? `One tenant accounts for ${Math.round(maxTenantShares / totalShares * 100)}% of ${totalShares} shares this week in "${group.name}".`
              : `${totalShares} shares across ${members} members this week in "${group.name}" — elevated volume.`;

            // Find the dominant tenant for suspicious patterns
            const dominantTenant = isSuspicious
              ? Object.entries(tenantCounts).sort((a, b) => b[1] - a[1])[0]?.[0]
              : Object.keys(tenantCounts)[0];

            await svc.from("communio_governance_flags").insert({
              tenant_id: dominantTenant ?? Object.keys(tenantCounts)[0],
              group_id: group.id,
              flag_type: flagType,
              details,
              severity: isSuspicious ? "high" : "medium",
            });
            flagsCreated.push(flagType);
          }
        }
      }
    }

    return json({
      ok: true,
      groups_scanned: groups?.length ?? 0,
      flags_created: flagsCreated.length,
      flag_types: flagsCreated,
    });
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});
