/**
 * outlook-connect — Initiates Microsoft OAuth flow for Outlook integration.
 *
 * WHAT: Generates Microsoft OAuth authorization URL with required scopes.
 * WHERE: Called from tenant admin email provider settings.
 * WHY: Enables tenant users to connect their Microsoft 365 account for sending.
 *
 * AUTH: Authenticated users only (tenant-scoped).
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub;
    const body = await req.json();
    const { tenant_id, redirect_uri } = body;

    if (!tenant_id || !redirect_uri) {
      return new Response(JSON.stringify({ error: "tenant_id and redirect_uri required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const clientId = Deno.env.get("MICROSOFT_CLIENT_ID");
    if (!clientId) {
      return new Response(JSON.stringify({ error: "Microsoft OAuth not configured. Contact your administrator." }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const scopes = [
      "https://graph.microsoft.com/Mail.Send",
      "https://graph.microsoft.com/User.Read",
      "offline_access",
    ];

    // State encodes user context for callback
    const state = btoa(JSON.stringify({ user_id: userId, tenant_id }));

    const params = new URLSearchParams({
      client_id: clientId,
      response_type: "code",
      redirect_uri,
      response_mode: "query",
      scope: scopes.join(" "),
      state,
      prompt: "consent",
    });

    const authUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params}`;

    return new Response(
      JSON.stringify({ auth_url: authUrl, scopes }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("outlook-connect error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
