import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function jsonError(message: string, status = 400) {
  return jsonResponse({ error: message }, status);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonError("Unauthorized", 401);
    }

    const token = authHeader.replace("Bearer ", "");
    const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);
    const userId = claimsData?.claims?.sub;
    if (claimsError || !userId) {
      return jsonError("Invalid token", 401);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // RBAC: admin/regional_lead/staff can acknowledge any intent (not self-only)
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    // deno-lint-ignore no-explicit-any
    const userRoles = (roles || []).map((r: any) => r.role as string);
    const isRim = userRoles.some((r: string) => ["admin", "regional_lead", "staff"].includes(r));
    // deno-lint-ignore no-explicit-any
    if ((roles || []).some((r: any) => r.role === "warehouse_manager")) {
      return jsonError("Access denied", 403);
    }

    const body = await req.json();
    const { campaign_id } = body;
    if (!campaign_id) return jsonError("campaign_id required");

    // Find active proposed intent — RIM roles can acknowledge any user's intent
    let intentQuery = supabase
      .from("email_campaign_send_intents")
      .select("*")
      .eq("campaign_id", campaign_id)
      .eq("intent_status", "proposed");

    // Non-RIM users can only acknowledge their own intents
    if (!isRim) {
      intentQuery = intentQuery.eq("created_by", userId);
    }

    const { data: intent } = await intentQuery.limit(1).maybeSingle();

    if (!intent) {
      return jsonError("No proposed intent found for this campaign", 404);
    }

    // Check expiry
    if (new Date(intent.expires_at) < new Date()) {
      await supabase
        .from("email_campaign_send_intents")
        .update({ intent_status: "expired" })
        .eq("id", intent.id);
      return jsonError("Intent has expired. Please create a new send intent.", 409);
    }

    // Acknowledge
    const { error: updateError } = await supabase
      .from("email_campaign_send_intents")
      .update({
        intent_status: "acknowledged",
        acked_at: new Date().toISOString(),
      })
      .eq("id", intent.id);

    if (updateError) {
      return jsonError("Failed to acknowledge intent: " + updateError.message, 500);
    }

    return jsonResponse({ ok: true });
  } catch (error) {
    console.error("acknowledge-send-intent error:", error);
    return jsonError(error instanceof Error ? error.message : "Internal error", 500);
  }
});
