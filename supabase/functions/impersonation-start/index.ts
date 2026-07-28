/**
 * impersonation-start — Admin-only edge function to begin a scoped impersonation session.
 *
 * WHAT: Creates an impersonation_sessions row after validating admin role and tenant safety gates.
 * WHERE: Called from Demo Lab admin UI.
 * WHY: Allows admins to "view as" a user in demo tenants for testing/support without changing auth.
 *
 * Implementation: Path B — no token minting. Returns session descriptor for client-side "acting as" mode.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

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
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify the caller's JWT
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ ok: false, message: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify admin role server-side
    const sb = createClient(supabaseUrl, serviceKey);
    const { data: adminRole } = await sb
      .from("user_roles")
      .select("id")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!adminRole) {
      return new Response(JSON.stringify({ ok: false, message: "Admin role required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { tenant_id, target_user_id, reason } = body;

    if (!tenant_id || !target_user_id) {
      return new Response(JSON.stringify({ ok: false, message: "tenant_id and target_user_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if tenant is demo
    const { data: demoTenant } = await sb
      .from("demo_tenants")
      .select("id")
      .eq("tenant_id", tenant_id)
      .maybeSingle();

    const isDemo = !!demoTenant;

    // Load security settings
    const { data: settings } = await sb
      .from("operator_security_settings")
      .select("*")
      .limit(1)
      .maybeSingle();

    const allowDemo = settings?.allow_demo_impersonation ?? true;
    const allowProd = settings?.allow_production_impersonation ?? false;
    const maxMinutes = settings?.max_impersonation_minutes ?? 60;

    if (isDemo && !allowDemo) {
      return new Response(JSON.stringify({ ok: false, message: "Demo impersonation is disabled" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!isDemo && !allowProd) {
      return new Response(JSON.stringify({ ok: false, message: "Production impersonation is disabled. Enable in Operator Security Settings." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify target user belongs to tenant
    const { data: tenantUser } = await sb
      .from("tenant_users")
      .select("id")
      .eq("tenant_id", tenant_id)
      .eq("user_id", target_user_id)
      .maybeSingle();

    if (!tenantUser) {
      return new Response(JSON.stringify({ ok: false, message: "Target user does not belong to this tenant" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // End any existing active sessions for this admin
    await sb
      .from("impersonation_sessions")
      .update({ status: "ended", ended_at: new Date().toISOString() })
      .eq("admin_user_id", user.id)
      .eq("status", "active");

    // Fetch target user profile for display
    const { data: targetProfile } = await sb
      .from("profiles")
      .select("display_name, nickname")
      .eq("user_id", target_user_id)
      .maybeSingle();

    // Fetch tenant info
    const { data: tenantInfo } = await sb
      .from("tenants")
      .select("name, slug")
      .eq("id", tenant_id)
      .maybeSingle();

    // Create impersonation session
    const expiresAt = new Date(Date.now() + maxMinutes * 60 * 1000).toISOString();
    const ipHash = req.headers.get("x-forwarded-for") || null;
    const userAgent = req.headers.get("user-agent") || null;

    const { data: session, error: insertError } = await sb
      .from("impersonation_sessions")
      .insert({
        admin_user_id: user.id,
        tenant_id,
        target_user_id,
        is_demo: isDemo,
        reason: reason || null,
        ip_hash: ipHash,
        user_agent: userAgent,
      })
      .select("id")
      .single();

    if (insertError) {
      return new Response(JSON.stringify({ ok: false, message: insertError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      ok: true,
      impersonation_session_id: session.id,
      tenant_id,
      tenant_slug: tenantInfo?.slug,
      tenant_name: tenantInfo?.name,
      target_user_id,
      target_display_name: targetProfile?.nickname || targetProfile?.display_name || "User",
      is_demo: isDemo,
      expires_at: expiresAt,
      max_minutes: maxMinutes,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ ok: false, message: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
