/**
 * unsubscribe — Public endpoint for one-click email unsubscribe.
 *
 * WHAT: Validates token, inserts suppression, renders confirmation page.
 * WHERE: /functions/v1/unsubscribe?token=...
 * WHY: RFC-compliant unsubscribe that works without login.
 *
 * AUTH: Public (no JWT required). Token-validated.
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

function hashWithPepper(value: string): string {
  // Simple hash for privacy — not cryptographic, just for audit
  let h = 0;
  const pepper = "cros_unsub_2024";
  const input = pepper + value;
  for (let i = 0; i < input.length; i++) {
    h = ((h << 5) - h + input.charCodeAt(i)) | 0;
  }
  return Math.abs(h).toString(36);
}

function renderHtml(title: string, message: string, status: number) {
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
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #fafafa;
      color: #333;
      padding: 2rem;
    }
    .container {
      max-width: 480px;
      text-align: center;
    }
    .icon { font-size: 3rem; margin-bottom: 1rem; }
    h1 { font-size: 1.5rem; margin-bottom: 0.75rem; font-weight: 600; }
    p { color: #666; line-height: 1.6; }
    .brand { margin-top: 2rem; font-size: 0.8rem; color: #aaa; }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">${status === 200 ? "✅" : status === 410 ? "⏰" : "🔗"}</div>
    <h1>${title}</h1>
    <p>${message}</p>
    <p class="brand">Powered by CROS™</p>
  </div>
</body>
</html>`;

  return new Response(html, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8", ...corsHeaders },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const rawToken = url.searchParams.get("token");

    // Support both GET (link click) and POST (List-Unsubscribe-Post)
    let postToken: string | null = null;
    if (req.method === "POST") {
      try {
        const formData = await req.text();
        // RFC 8058: List-Unsubscribe=One-Click
        if (formData.includes("List-Unsubscribe=One-Click")) {
          postToken = rawToken; // Token comes from URL in POST too
        }
      } catch {
        // Ignore parse errors
      }
    }

    const token = rawToken || postToken;

    if (!token) {
      return renderHtml(
        "Invalid Link",
        "This unsubscribe link appears to be invalid. Please contact the sender directly.",
        404
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const tokenHash = await sha256(token);

    // Look up token
    const { data: tokenRecord, error: lookupError } = await supabase
      .from("email_unsubscribe_tokens")
      .select("id, tenant_id, email, campaign_id, expires_at, used_at")
      .eq("token_hash", tokenHash)
      .maybeSingle();

    if (lookupError || !tokenRecord) {
      return renderHtml(
        "Link Not Found",
        "This unsubscribe link is not valid. It may have already been used or does not exist.",
        404
      );
    }

    // Check expiry
    if (tokenRecord.expires_at && new Date(tokenRecord.expires_at) < new Date()) {
      return renderHtml(
        "Link Expired",
        "This unsubscribe link has expired. Please contact the sender directly to be removed from their mailing list.",
        410
      );
    }

    // Get tenant name for confirmation
    const { data: tenant } = await supabase
      .from("tenants")
      .select("name")
      .eq("id", tokenRecord.tenant_id)
      .maybeSingle();

    const tenantName = tenant?.name || "this organization";

    // Hash IP + UA for audit (privacy-safe)
    const ip = req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || "unknown";
    const ua = req.headers.get("user-agent") || "unknown";
    const ipHash = hashWithPepper(ip);
    const uaHash = hashWithPepper(ua);

    // Insert suppression (idempotent via UNIQUE constraint)
    const { error: suppressError } = await supabase
      .from("email_suppressions")
      .upsert(
        {
          tenant_id: tokenRecord.tenant_id,
          email: tokenRecord.email.toLowerCase(),
          reason: "unsubscribed",
          source: "self_service",
          metadata: {
            campaign_id: tokenRecord.campaign_id,
            token_id: tokenRecord.id,
            ip_hash: ipHash,
            ua_hash: uaHash,
          },
        },
        { onConflict: "tenant_id,email", ignoreDuplicates: false }
      );

    if (suppressError) {
      // If it's a unique violation, that's fine — idempotent
      if (!suppressError.message?.includes("duplicate") && !suppressError.code?.includes("23505")) {
        console.error("Suppression insert error:", suppressError);
      }
    }

    // Mark token as used
    await supabase
      .from("email_unsubscribe_tokens")
      .update({ used_at: new Date().toISOString() })
      .eq("id", tokenRecord.id);

    return renderHtml(
      "You're Unsubscribed",
      `You've been unsubscribed from emails from <strong>${tenantName}</strong>. You will no longer receive campaign emails from them.`,
      200
    );
  } catch (error) {
    console.error("unsubscribe error:", error);
    return renderHtml(
      "Something Went Wrong",
      "We couldn't process your unsubscribe request. Please try again or contact the sender directly.",
      500
    );
  }
});
