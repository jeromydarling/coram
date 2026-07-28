/**
 * praeceptum-update — Adaptive guidance memory updater.
 *
 * WHAT: Upserts praeceptum_guidance_memory rows when assistant events occur.
 * WHERE: Called from AssistChip and Signum hooks.
 * WHY: Deterministic scoring of which guidance prompts actually help humans.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ ok: false, error: "Missing authorization" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const svcKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Validate user
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) {
      return new Response(
        JSON.stringify({ ok: false, error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body = await req.json();
    const { tenant_id, prompt_key, context, event_type, archetype_key } = body;

    if (!tenant_id || !prompt_key || !context || !event_type) {
      return new Response(
        JSON.stringify({ ok: false, error: "Missing required fields: tenant_id, prompt_key, context, event_type" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const validTypes = ["intervention", "resolution", "friction_after"];
    if (!validTypes.includes(event_type)) {
      return new Response(
        JSON.stringify({ ok: false, error: `Invalid event_type. Must be one of: ${validTypes.join(", ")}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Verify user belongs to tenant
    const svc = createClient(supabaseUrl, svcKey);
    const { data: membership } = await svc
      .from("tenant_users")
      .select("id")
      .eq("tenant_id", tenant_id)
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    if (!membership) {
      return new Response(
        JSON.stringify({ ok: false, error: "User not member of tenant" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Check if praeceptum is enabled for this tenant
    const { data: settings } = await svc
      .from("tenant_praeceptum_settings")
      .select("enabled")
      .eq("tenant_id", tenant_id)
      .maybeSingle();

    if (settings && !settings.enabled) {
      return new Response(
        JSON.stringify({ ok: true, message: "Praeceptum disabled for tenant" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Fetch existing row
    const { data: existing } = await svc
      .from("praeceptum_guidance_memory")
      .select("id, intervention_count, resolution_count, friction_after_count")
      .eq("tenant_id", tenant_id)
      .eq("context", context)
      .eq("prompt_key", prompt_key)
      .maybeSingle();

    let intervention_count = existing?.intervention_count ?? 0;
    let resolution_count = existing?.resolution_count ?? 0;
    let friction_after_count = existing?.friction_after_count ?? 0;

    switch (event_type) {
      case "intervention": intervention_count++; break;
      case "resolution": resolution_count++; break;
      case "friction_after": friction_after_count++; break;
    }

    // Deterministic confidence: (resolution + 1) / (intervention + friction_after + 2)
    const confidence_score = Number(
      ((resolution_count + 1) / (intervention_count + friction_after_count + 2)).toFixed(4)
    );

    const now = new Date().toISOString();

    if (existing) {
      await svc
        .from("praeceptum_guidance_memory")
        .update({
          intervention_count,
          resolution_count,
          friction_after_count,
          confidence_score,
          archetype_key: archetype_key || undefined,
          last_seen_at: now,
          updated_at: now,
        })
        .eq("id", existing.id);
    } else {
      await svc
        .from("praeceptum_guidance_memory")
        .insert({
          tenant_id,
          context,
          prompt_key,
          archetype_key: archetype_key || null,
          intervention_count,
          resolution_count,
          friction_after_count,
          confidence_score,
          last_seen_at: now,
        });
    }

    return new Response(
      JSON.stringify({ ok: true, confidence_score }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ ok: false, error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
