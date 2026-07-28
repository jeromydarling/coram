/**
 * campaign-unsubscribe-link — Generates tokenized unsubscribe URLs.
 *
 * WHAT: Creates a secure, one-time unsubscribe link for a campaign email.
 * WHERE: Called internally by gmail-campaign-send before each email.
 * WHY: Tokenized links prevent email enumeration; no email in URL.
 *
 * AUTH: Service role only (called from other edge functions).
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function sha256(message: string): Promise<string> {
  const data = new TextEncoder().encode(message);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function generateToken(): string {
  const bytes = new Uint8Array(32); // 256-bit entropy
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Service role validation
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const token = authHeader.replace("Bearer ", "");

    // Only service role can call this
    if (token !== serviceRoleKey) {
      return new Response(JSON.stringify({ error: "Forbidden: service role required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      serviceRoleKey
    );

    const body = await req.json();
    const { tenant_id, email, campaign_id } = body;

    if (!tenant_id || !email) {
      return new Response(JSON.stringify({ error: "tenant_id and email required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const rawToken = generateToken();
    const tokenHash = await sha256(rawToken);

    // 180-day expiry
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 180);

    const { error: insertError } = await supabase
      .from("email_unsubscribe_tokens")
      .insert({
        tenant_id,
        email: normalizedEmail,
        campaign_id: campaign_id || null,
        token_hash: tokenHash,
        expires_at: expiresAt.toISOString(),
      });

    if (insertError) {
      console.error("Token insert error:", insertError);
      return new Response(JSON.stringify({ error: "Failed to create unsubscribe token" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const unsubscribeUrl = `${supabaseUrl}/functions/v1/unsubscribe?token=${rawToken}`;

    return new Response(
      JSON.stringify({ unsubscribe_url: unsubscribeUrl, token: rawToken }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("campaign-unsubscribe-link error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
