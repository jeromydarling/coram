/**
 * nri-support-context — Returns structured context for the NRI Support Companion.
 *
 * WHAT: Gathers tenant context (features, archetype, onboarding progress) for AI assistant.
 * WHERE: Called by NRISupportCompanion component.
 * WHY: Provides contextual guidance without exposing PII.
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

    const { tenant_id } = await req.json();
    if (!tenant_id) {
      return new Response(JSON.stringify({ error: "tenant_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    // Verify membership
    const { data: membership } = await admin
      .from("tenant_users")
      .select("id")
      .eq("tenant_id", tenant_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!membership) {
      return new Response(JSON.stringify({ error: "Access denied" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Gather context in parallel
    const [tenantRes, flagsRes, sessionRes, progressRes] = await Promise.all([
      admin.from("tenants").select("name, tier, archetype, status").eq("id", tenant_id).single(),
      admin.from("tenant_feature_flags").select("key, enabled").eq("tenant_id", tenant_id),
      admin.from("onboarding_sessions").select("status, current_step, archetype").eq("tenant_id", tenant_id).maybeSingle(),
      admin.from("onboarding_progress").select("step_key, status").eq("tenant_id", tenant_id),
    ]);

    const enabledFeatures = (flagsRes.data ?? [])
      .filter((f: any) => f.enabled)
      .map((f: any) => f.key);

    const completedSteps = (progressRes.data ?? [])
      .filter((p: any) => p.status === "complete")
      .map((p: any) => p.step_key);

    const pendingSteps = (progressRes.data ?? [])
      .filter((p: any) => p.status === "pending")
      .map((p: any) => p.step_key);

    // Build context — NO PII
    const context = {
      archetype: tenantRes.data?.archetype ?? null,
      tier: tenantRes.data?.tier ?? null,
      tenant_status: tenantRes.data?.status ?? null,
      enabled_features: enabledFeatures,
      onboarding_status: sessionRes.data?.status ?? "not_started",
      current_step: sessionRes.data?.current_step ?? null,
      completed_steps: completedSteps,
      pending_steps: pendingSteps,
      next_suggestion: pendingSteps[0] ?? null,
    };

    return new Response(
      JSON.stringify({ ok: true, context }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
