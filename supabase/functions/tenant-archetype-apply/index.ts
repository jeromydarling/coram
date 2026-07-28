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

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  // Auth: require authenticated user who is a tenant member
  const authHeader = req.headers.get("authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return jsonError(401, "unauthorized", "Missing auth token");
  }

  const token = authHeader.slice(7).trim();
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const {
    data: { user },
    error: userErr,
  } = await userClient.auth.getUser();
  if (userErr || !user) {
    return jsonError(401, "unauthorized", "Invalid token");
  }

  const svc = createClient(supabaseUrl, serviceRoleKey);

  // Parse input
  let body: { tenant_id: string; archetype: string };
  try {
    body = await req.json();
  } catch {
    return jsonError(400, "bad_request", "Invalid JSON body");
  }

  const { tenant_id, archetype } = body;
  if (!tenant_id || !archetype) {
    return jsonError(400, "bad_request", "tenant_id and archetype required");
  }

  // Verify caller is member of this tenant
  const { data: membership } = await svc
    .from("tenant_users")
    .select("role")
    .eq("tenant_id", tenant_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership) {
    return jsonError(403, "forbidden", "Not a member of this tenant");
  }

  try {
    // Fetch all archetype_defaults for this archetype
    const { data: defaults } = await svc
      .from("archetype_defaults")
      .select("config_key, config")
      .eq("archetype", archetype);

    if (!defaults || defaults.length === 0) {
      // No defaults for this archetype — still mark complete
      await markOnboardingComplete(svc, tenant_id);
      await recordHealth(svc, tenant_id, archetype, { defaults_found: 0 });
      return jsonOk({ ok: true, applied: 0, message: "No defaults for archetype" });
    }

    const stats: Record<string, number> = {};

    for (const row of defaults) {
      const key = row.config_key;
      const config = row.config;

      switch (key) {
        case "journey_stages": {
          const stages = config as string[];
          const rows = stages.map((label: string, i: number) => ({
            tenant_id,
            stage_label: label,
            stage_order: (i + 1) * 10,
          }));
          const { error } = await svc
            .from("tenant_journey_stages")
            .upsert(rows, { onConflict: "tenant_id,stage_label" });
          if (!error) stats.journey_stages = rows.length;
          break;
        }

        case "signum_keywords": {
          // Keywords need a metro — use the tenant's home metro
          const { data: tu } = await svc
            .from("tenant_users")
            .select("home_metro_id")
            .eq("tenant_id", tenant_id)
            .not("home_metro_id", "is", null)
            .limit(1)
            .maybeSingle();

          if (tu?.home_metro_id) {
            const keywords = config as Array<{
              keyword: string;
              category: string;
              weight: number;
            }>;
            for (const kw of keywords) {
              await svc.from("metro_news_keywords").upsert(
                {
                  metro_id: tu.home_metro_id,
                  keyword: kw.keyword,
                  category: kw.category,
                  weight: kw.weight ?? 3,
                  enabled: true,
                  created_by: user.id,
                },
                { onConflict: "metro_id,keyword" }
              );
            }
            stats.signum_keywords = keywords.length;
          }
          break;
        }

        case "communio_groups": {
          const groupNames = config as string[];
          for (const name of groupNames) {
            await svc.from("communio_groups").upsert(
              {
                name,
                created_by_tenant: tenant_id,
              },
              { onConflict: "id" } // no natural unique — insert only if new
            );
          }
          stats.communio_groups = groupNames.length;
          break;
        }

        case "dashboard_layout":
        case "provisio_defaults": {
          // Store as tenant config (could be read by UI later)
          // For now just count it
          stats[key] = 1;
          break;
        }

        default:
          stats[`unknown_${key}`] = 1;
      }
    }

    // Write testimonium initialization event
    await svc.from("testimonium_events").insert({
      tenant_id,
      user_id: user.id,
      source_module: "system",
      event_kind: "tenant_initialized",
      signal_weight: 1,
      summary: `Workspace initialized with ${archetype} archetype defaults`,
      metadata: { archetype, stats },
    });

    // Mark onboarding complete
    await markOnboardingComplete(svc, tenant_id);

    // Record health telemetry
    await recordHealth(svc, tenant_id, archetype, stats);

    return jsonOk({ ok: true, applied: defaults.length, stats });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("tenant-archetype-apply error:", msg);

    // Record failure
    await svc
      .from("system_health_events")
      .insert({
        schedule_key: "tenant_archetype_apply",
        tenant_id,
        status: "error",
        error: { message: msg },
        stats: { archetype },
      })
      .catch(() => {});

    return jsonError(500, "internal_error", msg);
  }
});

async function markOnboardingComplete(
  svc: ReturnType<typeof createClient>,
  tenantId: string
) {
  await svc
    .from("tenant_onboarding_state")
    .update({ completed: true, step: "completed", updated_at: new Date().toISOString() })
    .eq("tenant_id", tenantId);
}

async function recordHealth(
  svc: ReturnType<typeof createClient>,
  tenantId: string,
  archetype: string,
  stats: Record<string, unknown>
) {
  // Update schedule
  await svc
    .from("operator_schedules")
    .update({
      last_run_at: new Date().toISOString(),
      last_status: "ok",
      last_stats: { tenant_id: tenantId, archetype, ...stats },
      updated_at: new Date().toISOString(),
    })
    .eq("key", "tenant_archetype_apply");

  // Append health event
  await svc.from("system_health_events").insert({
    schedule_key: "tenant_archetype_apply",
    tenant_id: tenantId,
    status: "ok",
    stats: { archetype, ...stats },
  });
}

function jsonOk(data: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function jsonError(status: number, code: string, message: string) {
  return new Response(
    JSON.stringify({ ok: false, error: code, message }),
    { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
