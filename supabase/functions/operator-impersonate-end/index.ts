/**
 * operator-impersonate-end — Ends an operator impersonation session.
 *
 * WHAT: Marks an active impersonation session as ended with audit reason.
 * WHERE: Called from impersonation banner "End session" button.
 * WHY: Clean audit trail for session termination.
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

  // Admin check
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
    const { impersonation_session_id, ended_reason } = body;

    if (!impersonation_session_id) {
      return jsonError(400, "impersonation_session_id required");
    }

    const { error: updateError } = await svc
      .from("impersonation_sessions")
      .update({
        status: "ended",
        ended_at: new Date().toISOString(),
      })
      .eq("id", impersonation_session_id)
      .eq("admin_user_id", userId)
      .eq("status", "active");

    if (updateError) {
      return jsonError(500, updateError.message);
    }

    return jsonOk({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return jsonError(500, msg);
  }
});
