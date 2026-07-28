/**
 * HubSpot OAuth Connect + Token Refresh
 * Handles: auth-url, callback, refresh, disconnect, status
 * 
 * OAuth is STUBBED until HUBSPOT_CLIENT_ID / HUBSPOT_CLIENT_SECRET are configured.
 * All other operations (status, disconnect) work immediately.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const HUBSPOT_CLIENT_ID = Deno.env.get("HUBSPOT_CLIENT_ID") || "";
const HUBSPOT_CLIENT_SECRET = Deno.env.get("HUBSPOT_CLIENT_SECRET") || "";

function getServiceClient() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function getUserFromAuth(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const supabase = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });

  const token = authHeader.replace("Bearer ", "");
  const { data, error } = await supabase.auth.getClaims(token);
  if (error || !data?.claims) return null;
  return data.claims.sub as string;
}

async function refreshHubSpotToken(
  refreshToken: string
): Promise<{ access_token: string; refresh_token: string; expires_in: number } | null> {
  if (!HUBSPOT_CLIENT_ID || !HUBSPOT_CLIENT_SECRET) return null;

  const resp = await fetch("https://api.hubapi.com/oauth/v1/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: HUBSPOT_CLIENT_ID,
      client_secret: HUBSPOT_CLIENT_SECRET,
      refresh_token: refreshToken,
    }),
  });

  if (!resp.ok) {
    console.error("HubSpot token refresh failed:", await resp.text());
    return null;
  }

  return await resp.json();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "";

    // --- AUTH URL (start OAuth flow) ---
    if (action === "auth-url") {
      const userId = await getUserFromAuth(req);
      if (!userId) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!HUBSPOT_CLIENT_ID) {
        return new Response(JSON.stringify({
          error: "HubSpot OAuth not configured. Add HUBSPOT_CLIENT_ID and HUBSPOT_CLIENT_SECRET secrets.",
          stubbed: true,
        }), {
          status: 501, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const redirectUri = `${SUPABASE_URL}/functions/v1/hubspot-connect?action=callback`;
      const scopes = [
        "crm.objects.companies.read", "crm.objects.companies.write",
        "crm.objects.contacts.read", "crm.objects.contacts.write",
        "crm.objects.deals.read", "crm.objects.deals.write",
        "crm.schemas.deals.read",
        "crm.objects.owners.read",
        "timeline",
      ].join("%20");

      const authUrl = `https://app.hubspot.com/oauth/authorize?client_id=${HUBSPOT_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scopes}&state=${userId}`;

      return new Response(JSON.stringify({ authUrl }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- CALLBACK (OAuth redirect) ---
    if (action === "callback") {
      const code = url.searchParams.get("code");
      const userId = url.searchParams.get("state");

      if (!code || !userId) {
        return new Response("Missing code or state", { status: 400, headers: corsHeaders });
      }

      const redirectUri = `${SUPABASE_URL}/functions/v1/hubspot-connect?action=callback`;
      const tokenResp = await fetch("https://api.hubapi.com/oauth/v1/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          client_id: HUBSPOT_CLIENT_ID,
          client_secret: HUBSPOT_CLIENT_SECRET,
          redirect_uri: redirectUri,
          code,
        }),
      });

      if (!tokenResp.ok) {
        console.error("HubSpot token exchange failed:", await tokenResp.text());
        return new Response("Token exchange failed", { status: 500, headers: corsHeaders });
      }

      const tokenData = await tokenResp.json();

      // Get portal ID
      const portalResp = await fetch("https://api.hubapi.com/oauth/v1/access-tokens/" + tokenData.access_token);
      const portalData = portalResp.ok ? await portalResp.json() : null;

      const supabase = getServiceClient();

      // Upsert connection
      const { error } = await supabase
        .from("hubspot_connections")
        .upsert({
          user_id: userId,
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token,
          token_expires_at: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
          hubspot_portal_id: portalData?.hub_id?.toString() || null,
          status: "active",
          sync_scope: { partners: false, contacts: false },
        }, { onConflict: "user_id" });

      if (error) {
        // If no unique constraint on user_id, just insert
        const { error: insertError } = await supabase
          .from("hubspot_connections")
          .insert({
          user_id: userId,
            access_token: tokenData.access_token,
            refresh_token: tokenData.refresh_token,
            token_expires_at: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
            hubspot_portal_id: portalData?.hub_id?.toString() || null,
            status: "active",
            sync_scope: { partners: false, contacts: false },
          });
        if (insertError) {
          console.error("Failed to store connection:", insertError);
          return new Response("Failed to store connection", { status: 500, headers: corsHeaders });
        }
      }

      // Redirect back to settings
      const appOrigin = "https://profunda.lovable.app";
      return new Response(null, {
        status: 302,
        headers: { ...corsHeaders, Location: `${appOrigin}/settings?hubspot=connected` },
      });
    }

    // --- STATUS ---
    if (action === "status") {
      const userId = await getUserFromAuth(req);
      if (!userId) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const supabase = getServiceClient();
      const { data, error } = await supabase
        .from("hubspot_connections")
        .select("id, hubspot_portal_id, status, hubspot_mode, pipeline_id, stage_mapping, sync_direction, sync_scope, created_at, updated_at")
        .eq("user_id", userId)
        .eq("status", "active")
        .maybeSingle();

      return new Response(JSON.stringify({
        isConnected: !!data && !error,
        connection: data || null,
        oauthConfigured: !!HUBSPOT_CLIENT_ID,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- DISCONNECT ---
    if (action === "disconnect") {
      const userId = await getUserFromAuth(req);
      if (!userId) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const supabase = getServiceClient();
      await supabase
        .from("hubspot_connections")
        .update({ status: "revoked", access_token: null, refresh_token: null })
        .eq("user_id", userId);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- UPDATE SETTINGS (mode, direction, scope, stage mapping) ---
    if (action === "update-settings" && req.method === "POST") {
      const userId = await getUserFromAuth(req);
      if (!userId) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const body = await req.json();
      const supabase = getServiceClient();

      const updates: Record<string, unknown> = {};
      if (body.hubspot_mode) updates.hubspot_mode = body.hubspot_mode;
      if (body.pipeline_id !== undefined) updates.pipeline_id = body.pipeline_id;
      if (body.stage_mapping !== undefined) updates.stage_mapping = body.stage_mapping;
      if (body.sync_direction) updates.sync_direction = body.sync_direction;
      if (body.sync_scope !== undefined) updates.sync_scope = body.sync_scope;

      const { error } = await supabase
        .from("hubspot_connections")
        .update(updates)
        .eq("user_id", userId)
        .eq("status", "active");

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- REFRESH TOKEN (internal use) ---
    if (action === "refresh-token") {
      const userId = await getUserFromAuth(req);
      if (!userId) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const supabase = getServiceClient();
      const { data: conn } = await supabase
        .from("hubspot_connections")
        .select("id, refresh_token")
        .eq("user_id", userId)
        .eq("status", "active")
        .maybeSingle();

      if (!conn?.refresh_token) {
        return new Response(JSON.stringify({ error: "No active connection" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const tokenData = await refreshHubSpotToken(conn.refresh_token);
      if (!tokenData) {
        await supabase
          .from("hubspot_connections")
          .update({ status: "error" })
          .eq("id", conn.id);
        return new Response(JSON.stringify({ error: "Token refresh failed" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await supabase
        .from("hubspot_connections")
        .update({
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token,
          token_expires_at: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
        })
        .eq("id", conn.id);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- PIPELINES (fetch HubSpot pipelines for deal mode setup) ---
    if (action === "pipelines") {
      const userId = await getUserFromAuth(req);
      if (!userId) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const supabase = getServiceClient();
      const { data: conn } = await supabase
        .from("hubspot_connections")
        .select("access_token, token_expires_at, refresh_token, id")
        .eq("user_id", userId)
        .eq("status", "active")
        .maybeSingle();

      if (!conn?.access_token) {
        return new Response(JSON.stringify({ error: "Not connected" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Refresh if expired
      let accessToken = conn.access_token;
      if (conn.token_expires_at && new Date(conn.token_expires_at) < new Date()) {
        const tokenData = await refreshHubSpotToken(conn.refresh_token);
        if (tokenData) {
          accessToken = tokenData.access_token;
          await supabase.from("hubspot_connections").update({
            access_token: tokenData.access_token,
            refresh_token: tokenData.refresh_token,
            token_expires_at: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
          }).eq("id", conn.id);
        }
      }

      const pipelineResp = await fetch("https://api.hubapi.com/crm/v3/pipelines/deals", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!pipelineResp.ok) {
        return new Response(JSON.stringify({ error: "Failed to fetch pipelines" }), {
          status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const pipelines = await pipelineResp.json();
      return new Response(JSON.stringify({ pipelines: pipelines.results || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[hubspot-connect] Error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
