import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { evaluateCampaignRisk } from "../_shared/campaignRiskEval.ts";

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

    // RBAC
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    // deno-lint-ignore no-explicit-any
    if ((roles || []).some((r: any) => r.role === "warehouse_manager")) {
      return jsonError("Access denied", 403);
    }

    const body = await req.json();
    const { campaign_id, rationale } = body;
    if (!campaign_id) return jsonError("campaign_id required");

    // ── Campaigns add-on entitlement check ──────────────────
    const { data: campaignForTenant } = await supabase
      .from("email_campaigns")
      .select("tenant_id")
      .eq("id", campaign_id)
      .maybeSingle();

    if (campaignForTenant?.tenant_id) {
      const { data: entRow } = await supabase
        .from("tenant_entitlements")
        .select("campaigns_enabled")
        .eq("tenant_id", campaignForTenant.tenant_id)
        .maybeSingle();

      if (!entRow?.campaigns_enabled) {
        return jsonError("Campaigns add-on required", 403);
      }
    }
    const { data: campaign } = await supabase
      .from("email_campaigns")
      .select("id, created_by, status")
      .eq("id", campaign_id)
      .single();

    if (!campaign) return jsonError("Campaign not found", 404);

    // deno-lint-ignore no-explicit-any
    const userRoles = (roles || []).map((r: any) => r.role as string);
    const isRim = userRoles.some((r: string) => ["admin", "regional_lead", "staff"].includes(r));
    if (campaign.created_by !== userId && !isRim) return jsonError("Access denied", 403);

    if (!["draft", "audience_ready", "paused"].includes(campaign.status)) {
      return jsonError(`Cannot create send intent for campaign in status: ${campaign.status}`);
    }

    // Expire any existing active intents
    await supabase
      .from("email_campaign_send_intents")
      .update({ intent_status: "expired" })
      .eq("campaign_id", campaign_id)
      .in("intent_status", ["proposed", "acknowledged"]);

    // Evaluate risk
    const risk = await evaluateCampaignRisk(supabase, campaign_id, userId);

    const requiresAck = risk.risk_level === "medium" || risk.risk_level === "high";
    const intentStatus = requiresAck ? "proposed" : "acknowledged";
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString(); // 30 minutes

    const { data: intent, error: insertError } = await supabase
      .from("email_campaign_send_intents")
      .insert({
        campaign_id,
        created_by: userId,
        intent_status: intentStatus,
        rationale: rationale || null,
        risk_level: risk.risk_level,
        risk_reasons: risk.risk_reasons,
        requires_ack: requiresAck,
        expires_at: expiresAt,
        acked_at: requiresAck ? null : new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      console.error("Failed to create intent:", insertError);
      return jsonError("Failed to create send intent: " + insertError.message, 500);
    }

    return jsonResponse({
      intent,
      risk: {
        risk_level: risk.risk_level,
        risk_reasons: risk.risk_reasons,
        audience_size: risk.audience_size,
      },
    });
  } catch (error) {
    console.error("create-send-intent error:", error);
    return jsonError(error instanceof Error ? error.message : "Internal error", 500);
  }
});
