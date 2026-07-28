/**
 * operator-impersonate-start — Operator-only edge function to start a time-limited tenant session.
 *
 * WHAT: Creates an impersonation session after verifying consent + admin role.
 * WHERE: Called from Operator Activation Console.
 * WHY: Safe, auditable, time-limited operator access to tenant admin views.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function jsonOk(data: Record<string, unknown>) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function jsonError(status: number, msg: string) {
  return new Response(JSON.stringify({ ok: false, error: msg }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const authHeader = req.headers.get("authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return jsonError(401, "Missing auth token");
  }
  const token = authHeader.slice(7).trim();
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token);
  if (claimsErr || !claimsData?.claims) {
    return jsonError(401, "Invalid token");
  }
  const userId = claimsData.claims.sub as string;

  const svc = createClient(supabaseUrl, serviceRoleKey);

  // Verify admin role
  const { data: adminRole } = await svc
    .from("user_roles")
    .select("id")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();

  if (!adminRole) {
    return jsonError(403, "Admin role required");
  }

  try {
    const body = await req.json();
    const { tenant_id, reason } = body;
    if (!tenant_id) return jsonError(400, "tenant_id required");
    if (!reason || String(reason).trim().length < 3) {
      return jsonError(400, "A reason is required for the audit trail");
    }

    // Check consent: either activation_offers.consent_granted=true or tenant is a demo tenant
    const { data: offer } = await svc
      .from("activation_offers")
      .select("consent_granted")
      .eq("tenant_id", tenant_id)
      .maybeSingle();

    const { data: demoTenant } = await svc
      .from("demo_tenants")
      .select("id")
      .eq("tenant_id", tenant_id)
      .maybeSingle();

    const consentGranted = offer?.consent_granted === true;
    const isDemo = !!demoTenant;

    // Check operator_security_settings
    const { data: settings } = await svc
      .from("operator_security_settings")
      .select("*")
      .limit(1)
      .maybeSingle();

    const allowDemo = settings?.allow_demo_impersonation ?? true;
    const allowProd = settings?.allow_production_impersonation ?? false;
    const maxMinutes = settings?.max_impersonation_minutes ?? 60;

    if (isDemo && !allowDemo) {
      return jsonError(403, "Demo impersonation is disabled");
    }

    if (!isDemo && !consentGranted) {
      return jsonError(403, "Tenant has not granted operator access consent. Ask them to enable it in their activation settings.");
    }

    if (!isDemo && !allowProd) {
      return jsonError(403, "Production impersonation is disabled in Operator Security Settings.");
    }

    // End any existing active sessions for this operator
    await svc
      .from("impersonation_sessions")
      .update({ status: "ended", ended_at: new Date().toISOString() })
      .eq("admin_user_id", userId)
      .eq("status", "active");

    // Get a target user (first tenant admin/user) for the impersonation record
    const { data: tenantUsers } = await svc
      .from("tenant_users")
      .select("user_id")
      .eq("tenant_id", tenant_id)
      .limit(1);

    const targetUserId = tenantUsers?.[0]?.user_id ?? userId;

    // Get tenant info
    const { data: tenantInfo } = await svc
      .from("tenants")
      .select("name, slug")
      .eq("id", tenant_id)
      .maybeSingle();

    // Get target profile
    const { data: targetProfile } = await svc
      .from("profiles")
      .select("display_name, nickname")
      .eq("user_id", targetUserId)
      .maybeSingle();

    const ipHash = req.headers.get("x-forwarded-for") || null;
    const userAgent = req.headers.get("user-agent") || null;

    // Create impersonation session
    const { data: session, error: insertError } = await svc
      .from("impersonation_sessions")
      .insert({
        admin_user_id: userId,
        tenant_id,
        target_user_id: targetUserId,
        is_demo: isDemo,
        reason: reason,
        ip_hash: ipHash,
        user_agent: userAgent,
      })
      .select("id")
      .single();

    if (insertError) {
      return jsonError(500, insertError.message);
    }

    const expiresAt = new Date(Date.now() + maxMinutes * 60 * 1000).toISOString();

    return jsonOk({
      ok: true,
      impersonation_session_id: session.id,
      tenant_id,
      tenant_slug: tenantInfo?.slug,
      tenant_name: tenantInfo?.name,
      target_user_id: targetUserId,
      target_display_name: targetProfile?.nickname || targetProfile?.display_name || "Tenant Admin",
      is_demo: isDemo,
      expires_at: expiresAt,
      max_minutes: maxMinutes,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[operator-impersonate-start] Error:", msg);
    return jsonError(500, msg);
  }
});
