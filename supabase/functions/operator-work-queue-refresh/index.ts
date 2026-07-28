/**
 * operator-work-queue-refresh — Aggregates work items for the operator console.
 *
 * WHAT: Scans integrations, onboarding, migrations, and signals for actionable items.
 * WHERE: Called on-demand or via cron from operator console.
 * WHY: Silent automation first — system attempts retries before creating work items.
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

    const created: string[] = [];

    // 1. Activation pending: tenants with incomplete onboarding
    const { data: checklists } = await svc
      .from("activation_checklists")
      .select("tenant_id, readiness_score, status")
      .neq("status", "complete");

    if (checklists) {
      for (const cl of checklists) {
        if (cl.readiness_score < 50) {
          const { data: existing } = await svc
            .from("operator_work_queue")
            .select("id")
            .eq("tenant_id", cl.tenant_id)
            .eq("type", "activation_pending")
            .eq("status", "open")
            .limit(1);

          if (!existing || existing.length === 0) {
            await svc.from("operator_work_queue").insert({
              tenant_id: cl.tenant_id,
              type: "activation_pending",
              summary: `Activation readiness at ${cl.readiness_score}% — may benefit from a check-in.`,
              priority: cl.readiness_score < 25 ? "high" : "normal",
            });
            created.push("activation_pending");
          }
        }
      }
    }

    // 2. Connector issues: recent integration errors
    const { data: integrations } = await svc
      .from("operator_integration_health")
      .select("tenant_id, connector_key, last_status, error_count")
      .eq("last_status", "error");

    if (integrations) {
      for (const intg of integrations) {
        if ((intg.error_count ?? 0) >= 3) {
          const { data: existing } = await svc
            .from("operator_work_queue")
            .select("id")
            .eq("tenant_id", intg.tenant_id)
            .eq("type", "connector_issue")
            .eq("status", "open")
            .limit(1);

          if (!existing || existing.length === 0) {
            await svc.from("operator_work_queue").insert({
              tenant_id: intg.tenant_id,
              type: "connector_issue",
              summary: `${intg.connector_key} connection may need a quick look (${intg.error_count} recent issues).`,
              priority: (intg.error_count ?? 0) >= 5 ? "high" : "normal",
            });
            created.push("connector_issue");
          }
        }
      }
    }

    // 3. Migration stalled: runs stuck for >1 hour
    const { data: stuckMigrations } = await svc
      .from("migration_runs")
      .select("tenant_id, connector_key, status, started_at")
      .eq("status", "running")
      .lt("started_at", new Date(Date.now() - 3600000).toISOString());

    if (stuckMigrations) {
      for (const mig of stuckMigrations) {
        const { data: existing } = await svc
          .from("operator_work_queue")
          .select("id")
          .eq("tenant_id", mig.tenant_id)
          .eq("type", "migration_stalled")
          .eq("status", "open")
          .limit(1);

        if (!existing || existing.length === 0) {
          await svc.from("operator_work_queue").insert({
            tenant_id: mig.tenant_id,
            type: "migration_stalled",
            summary: `${mig.connector_key} migration has been running for a while — may need attention.`,
            priority: "normal",
          });
          created.push("migration_stalled");
        }
      }
    }

    // 4. Communio requests: pending invites
    const { data: pendingInvites } = await svc
      .from("communio_invites")
      .select("id, group_id, invited_tenant_id")
      .eq("status", "pending");

    if (pendingInvites && pendingInvites.length > 3) {
      const { data: existing } = await svc
        .from("operator_work_queue")
        .select("id")
        .eq("type", "communio_request")
        .eq("status", "open")
        .limit(1);

      if (!existing || existing.length === 0) {
        await svc.from("operator_work_queue").insert({
          type: "communio_request",
          summary: `${pendingInvites.length} pending Communio invites across the network.`,
          priority: "low",
        });
        created.push("communio_request");
      }
    }

    return json({ ok: true, items_created: created.length, types: created });
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});
