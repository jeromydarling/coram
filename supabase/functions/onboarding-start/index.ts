/**
 * onboarding-start — Creates onboarding session + seeds progress rows.
 *
 * WHAT: Initializes the guided onboarding flow for a tenant.
 * WHERE: Called after tenant creation in Onboarding page.
 * WHY: Ensures every tenant gets a deterministic, archetype-aware onboarding path.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

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
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Auth client to get user
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { archetype, tenant_id } = await req.json();
    if (!archetype || !tenant_id) {
      return new Response(JSON.stringify({ error: "archetype and tenant_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    // Verify user belongs to tenant
    const { data: membership } = await admin
      .from("tenant_users")
      .select("tenant_id")
      .eq("tenant_id", tenant_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!membership) {
      return new Response(JSON.stringify({ error: "Not a member of this tenant" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Upsert onboarding session (idempotent)
    const { error: sessionErr } = await admin
      .from("onboarding_sessions")
      .upsert(
        {
          tenant_id,
          archetype,
          status: "in_progress",
          started_at: new Date().toISOString(),
        },
        { onConflict: "tenant_id" }
      );

    if (sessionErr) throw sessionErr;

    // Fetch steps for this archetype
    const { data: steps, error: stepsErr } = await admin
      .from("onboarding_steps")
      .select("key, order_index")
      .eq("archetype", archetype)
      .order("order_index");

    if (stepsErr) throw stepsErr;

    // Seed progress rows (idempotent via upsert)
    if (steps && steps.length > 0) {
      const progressRows = steps.map((s: any) => ({
        tenant_id,
        step_key: s.key,
        status: "pending",
      }));

      const { error: progressErr } = await admin
        .from("onboarding_progress")
        .upsert(progressRows, { onConflict: "tenant_id,step_key" });

      if (progressErr) throw progressErr;

      // Set current_step to first step
      await admin
        .from("onboarding_sessions")
        .update({ current_step: steps[0].key })
        .eq("tenant_id", tenant_id);
    }

    return new Response(
      JSON.stringify({
        ok: true,
        steps_seeded: steps?.length ?? 0,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
