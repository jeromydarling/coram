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
    const { campaign_id } = body;
    if (!campaign_id) return jsonError("campaign_id required");

    // Verify ownership
    const { data: campaign } = await supabase
      .from("email_campaigns")
      .select("id, created_by")
      .eq("id", campaign_id)
      .single();

    if (!campaign) return jsonError("Campaign not found", 404);
    if (campaign.created_by !== userId) return jsonError("Access denied", 403);

    const result = await evaluateCampaignRisk(supabase, campaign_id, userId);
    return jsonResponse(result);
  } catch (error) {
    console.error("evaluate-campaign-risk error:", error);
    return jsonError(error instanceof Error ? error.message : "Internal error", 500);
  }
});
