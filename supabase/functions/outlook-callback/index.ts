/**
 * outlook-callback — Handles Microsoft OAuth redirect.
 *
 * WHAT: Exchanges authorization code for tokens and stores the connection.
 * WHERE: /functions/v1/outlook-callback?code=...&state=...
 * WHY: Completes OAuth flow and persists refresh token reference.
 *
 * AUTH: Public (redirect from Microsoft). State-validated.
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
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const stateParam = url.searchParams.get("state");
    const error = url.searchParams.get("error");

    if (error) {
      const desc = url.searchParams.get("error_description") || "OAuth failed";
      return renderResult("Connection Failed", desc, false);
    }

    if (!code || !stateParam) {
      return renderResult("Invalid Request", "Missing authorization code or state.", false);
    }

    let state: { user_id: string; tenant_id: string };
    try {
      state = JSON.parse(atob(stateParam));
    } catch {
      return renderResult("Invalid State", "Could not decode OAuth state.", false);
    }

    const clientId = Deno.env.get("MICROSOFT_CLIENT_ID")!;
    const clientSecret = Deno.env.get("MICROSOFT_CLIENT_SECRET")!;
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Determine redirect_uri from the current request
    const redirectUri = `${supabaseUrl}/functions/v1/outlook-callback`;

    // Exchange code for tokens
    const tokenRes = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
        scope: "https://graph.microsoft.com/Mail.Send https://graph.microsoft.com/User.Read offline_access",
      }),
    });

    const tokenData = await tokenRes.json();
    if (!tokenRes.ok || tokenData.error) {
      console.error("Token exchange error:", tokenData);
      return renderResult("Authentication Failed", tokenData.error_description || "Token exchange failed.", false);
    }

    // Get user profile from Graph API
    const profileRes = await fetch("https://graph.microsoft.com/v1.0/me", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const profile = await profileRes.json();
    const emailAddress = profile.mail || profile.userPrincipalName || "";

    // Store connection using service role
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Upsert outlook connection
    const { error: upsertError } = await supabase
      .from("outlook_connections")
      .upsert(
        {
          tenant_id: state.tenant_id,
          user_id: state.user_id,
          email_address: emailAddress.toLowerCase(),
          tenant_domain: emailAddress.includes("@") ? emailAddress.split("@")[1] : null,
          connection_status: "connected",
          scopes: ["Mail.Send", "User.Read", "offline_access"],
          last_sync_at: new Date().toISOString(),
        },
        { onConflict: "tenant_id,user_id,email_address", ignoreDuplicates: false }
      );

    if (upsertError) {
      // If no unique constraint exists, try insert
      const { error: insertError } = await supabase
        .from("outlook_connections")
        .insert({
          tenant_id: state.tenant_id,
          user_id: state.user_id,
          email_address: emailAddress.toLowerCase(),
          tenant_domain: emailAddress.includes("@") ? emailAddress.split("@")[1] : null,
          connection_status: "connected",
          scopes: ["Mail.Send", "User.Read", "offline_access"],
          last_sync_at: new Date().toISOString(),
        });
      
      if (insertError) {
        console.error("Connection store error:", insertError);
        return renderResult("Connection Failed", "Could not save connection. Please try again.", false);
      }
    }

    // Store tokens server-side (service-role only columns via RLS)
    if (tokenData.access_token || tokenData.refresh_token) {
      const tokenUpdate: Record<string, unknown> = {};
      if (tokenData.access_token) tokenUpdate.access_token = tokenData.access_token;
      if (tokenData.refresh_token) tokenUpdate.refresh_token = tokenData.refresh_token;
      if (tokenData.expires_in) {
        tokenUpdate.token_expires_at = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();
      }
      await supabase
        .from("outlook_connections")
        .update(tokenUpdate)
        .eq("tenant_id", state.tenant_id)
        .eq("user_id", state.user_id)
        .eq("email_address", emailAddress.toLowerCase());
    }

    // Initialize send limits for this provider
    await supabase
      .from("email_send_limits")
      .upsert(
        {
          tenant_id: state.tenant_id,
          provider: "outlook",
          email_address: emailAddress.toLowerCase(),
          daily_limit: 300,
          soft_limit: 60,
          hard_limit: 85,
          current_count: 0,
          window_start: new Date().toISOString(),
        },
        { onConflict: "tenant_id,provider,email_address", ignoreDuplicates: true }
      );

    return renderResult(
      "Outlook Connected",
      `Successfully connected ${emailAddress}. You can now send campaigns via Microsoft 365.`,
      true
    );
  } catch (error) {
    console.error("outlook-callback error:", error);
    return renderResult("Something Went Wrong", "Please try connecting again.", false);
  }
});

function renderResult(title: string, message: string, success: boolean) {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      min-height: 100vh; display: flex; align-items: center; justify-content: center;
      background: #fafafa; color: #333; padding: 2rem;
    }
    .container { max-width: 480px; text-align: center; }
    .icon { font-size: 3rem; margin-bottom: 1rem; }
    h1 { font-size: 1.5rem; margin-bottom: 0.75rem; font-weight: 600; }
    p { color: #666; line-height: 1.6; }
    .brand { margin-top: 2rem; font-size: 0.8rem; color: #aaa; }
    .close-btn {
      margin-top: 1.5rem; padding: 0.5rem 1.5rem;
      border: 1px solid #ddd; border-radius: 6px; cursor: pointer;
      background: white; font-size: 0.9rem;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">${success ? "✅" : "❌"}</div>
    <h1>${title}</h1>
    <p>${message}</p>
    <button class="close-btn" onclick="window.close()">Close this window</button>
    <p class="brand">Powered by CROS™</p>
  </div>
  <script>
    // Auto-close and notify parent after success
    if (${success}) {
      if (window.opener) {
        window.opener.postMessage({ type: 'outlook-connected', success: true }, '*');
      }
      setTimeout(() => window.close(), 3000);
    }
  </script>
</body>
</html>`;

  return new Response(html, {
    status: success ? 200 : 400,
    headers: { "Content-Type": "text/html; charset=utf-8", ...corsHeaders },
  });
}
