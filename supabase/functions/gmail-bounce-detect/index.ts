import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

/** Time-bounded fetch — prevents hanging on external API calls */
async function timedFetch(url: string, opts: RequestInit = {}, timeoutMs = 15000): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...opts, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

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

/** Mint a fresh Gmail access token from the user's stored refresh token */
async function getGmailAccessToken(
  supabase: ReturnType<typeof createClient>,
  userId: string
): Promise<string> {
  const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID");
  const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET");
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    throw new Error("Google OAuth not configured");
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("google_refresh_token")
    .eq("user_id", userId)
    .single();

  if (error || !profile?.google_refresh_token) {
    throw new Error("Gmail not connected. Please connect your Gmail in Settings.");
  }

  const refreshRes = await timedFetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: profile.google_refresh_token,
      grant_type: "refresh_token",
    }),
  });

  if (!refreshRes.ok) {
    const err = await refreshRes.json();
    console.error("Token refresh failed:", err);
    throw new Error(
      err.error === "invalid_grant"
        ? "Gmail authorization expired. Please reconnect in Settings."
        : "Failed to authenticate with Gmail"
    );
  }

  const tokens = await refreshRes.json();
  return tokens.access_token;
}

/** Extract email addresses from text, ignoring mailer-daemon/postmaster */
function extractBouncedEmails(text: string): string[] {
  const emailRegex = /[\w.+-]+@[\w.-]+\.\w{2,}/gi;
  const matches = text.match(emailRegex) || [];
  const ignorePrefixes = ["mailer-daemon", "postmaster"];
  return [
    ...new Set(
      matches
        .map((e) => e.toLowerCase())
        .filter((e) => !ignorePrefixes.some((p) => e.startsWith(p)))
    ),
  ];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Auth — extract user from JWT
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) return jsonError("Missing auth token", 401);

    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: userData, error: userError } = await anonClient.auth.getUser(token);
    if (userError || !userData?.user) return jsonError("Unauthorized", 401);
    const userId = userData.user.id;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { campaign_id } = await req.json();
    if (!campaign_id) return jsonError("campaign_id required");

    // Verify ownership — include sent_count and failed_count
    const { data: campaign, error: campaignError } = await supabase
      .from("email_campaigns")
      .select("id, created_by, last_sent_at, created_at, sent_count, failed_count")
      .eq("id", campaign_id)
      .single();

    if (campaignError || !campaign) return jsonError("Campaign not found", 404);
    if (campaign.created_by !== userId) return jsonError("Not your campaign", 403);

    // Fetch sent audience
    const { data: sentAudience, error: audError } = await supabase
      .from("email_campaign_audience")
      .select("id, email")
      .eq("campaign_id", campaign_id)
      .eq("status", "sent");

    if (audError) throw audError;
    if (!sentAudience || sentAudience.length === 0) {
      return jsonResponse({ bounced_count: 0, bounced_emails: [], total_scanned: 0 });
    }

    // Build email→audience lookup
    const emailToAudience = new Map<string, { id: string; email: string }>();
    for (const row of sentAudience) {
      emailToAudience.set(row.email.toLowerCase(), row);
    }

    // Get Gmail token
    const accessToken = await getGmailAccessToken(supabase, userId);

    // Determine search epoch — 1hr before the campaign's first send
    const sendDate = campaign.last_sent_at || campaign.created_at;
    const searchAfter = Math.floor(new Date(sendDate).getTime() / 1000) - 3600;

    // Search Gmail for bounce messages
    const query = encodeURIComponent(
      `from:(mailer-daemon@googlemail.com OR mailer-daemon@google.com OR postmaster) after:${searchAfter} is:anywhere`
    );
    const searchUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${query}&includeSpamTrash=true&maxResults=100`;

    const searchRes = await timedFetch(searchUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    }, 20000);
    if (!searchRes.ok) {
      const errText = await searchRes.text();
      console.error("Gmail search failed:", errText);
      throw new Error("Gmail search failed");
    }

    const searchData = await searchRes.json();
    const messageIds: string[] = (searchData.messages || []).map(
      (m: { id: string }) => m.id
    );

    if (messageIds.length === 0) {
      return jsonResponse({ bounced_count: 0, bounced_emails: [], total_scanned: 0 });
    }

    // Process each message — continue on fail
    const bouncedEmails: string[] = [];
    const bouncedAudienceIds: string[] = [];

    for (const msgId of messageIds) {
      try {
        const msgRes = await timedFetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msgId}?format=full`,
          { headers: { Authorization: `Bearer ${accessToken}` } },
          10000
        );
        if (!msgRes.ok) {
          await msgRes.text();
          continue;
        }

        const msg = await msgRes.json();
        const snippet = msg.snippet || "";

        // Extract body text
        let bodyText = "";
        const payload = msg.payload;
        if (payload?.body?.data) {
          bodyText = atob(payload.body.data.replace(/-/g, "+").replace(/_/g, "/"));
        } else if (payload?.parts) {
          for (const part of payload.parts) {
            if (part.body?.data && part.mimeType?.startsWith("text/")) {
              bodyText += atob(part.body.data.replace(/-/g, "+").replace(/_/g, "/"));
            }
          }
        }

        const extracted = extractBouncedEmails(`${snippet} ${bodyText}`);
        for (const email of extracted) {
          const match = emailToAudience.get(email);
          if (match && !bouncedAudienceIds.includes(match.id)) {
            bouncedEmails.push(email);
            bouncedAudienceIds.push(match.id);
          }
        }
      } catch (err) {
        console.error(`Error processing message ${msgId}:`, err);
        // continue-on-fail
      }
    }

    // Update audience rows
    if (bouncedAudienceIds.length > 0) {
      const { error: updateError } = await supabase
        .from("email_campaign_audience")
        .update({
          status: "failed",
          failure_category: "bounce",
          failure_code: "post_delivery_bounce",
          error_message: "Bounce detected from Gmail mailer-daemon",
        })
        .in("id", bouncedAudienceIds);

      if (updateError) {
        console.error("Failed to update audience:", updateError);
        throw updateError;
      }

      // Update campaign counts using actual values
      const currentSent = campaign.sent_count ?? 0;
      const currentFailed = campaign.failed_count ?? 0;

      await supabase
        .from("email_campaigns")
        .update({
          failed_count: currentFailed + bouncedAudienceIds.length,
          sent_count: Math.max(0, currentSent - bouncedAudienceIds.length),
        })
        .eq("id", campaign_id);
    }

    return jsonResponse({
      bounced_count: bouncedAudienceIds.length,
      bounced_emails: bouncedEmails,
      total_scanned: messageIds.length,
    });
  } catch (err) {
    console.error("gmail-bounce-detect error:", err);
    return jsonError(err.message || "Internal error", 500);
  }
});
