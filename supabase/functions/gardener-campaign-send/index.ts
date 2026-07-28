/**
 * gardener-campaign-send — Sends a Gardener-tracked federation campaign via Gmail.
 *
 * WHAT: For a given email_campaigns row with an attached gardener_tracked_campaigns
 *       entry, sends the campaign body to every queued row in gardener_tracked_sends,
 *       rewriting links through /track-click and injecting a /track-open pixel. Any
 *       link pointing at the target federation app also gets UTM + cros_sid params.
 * WHERE: Called from the Operator SCIENTIA composer's "Send tracked campaign" button.
 *        Runs entirely off `gardener_tracked_sends`, not `email_campaign_audience`.
 * WHY: Keeps the mission-critical tenant send path untouched while giving operators
 *      full-fidelity per-recipient tracking for CROS Federation outreach.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { rewriteHtmlForTracking } from "../_shared/federationTracking.ts";
import { captureEdgeException } from "../_shared/sentryCapture.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

function buildMimeEmail(from: string, to: string, subject: string, htmlBody: string, replyTo?: string): string {
  const headers = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    replyTo ? `Reply-To: ${replyTo}` : null,
    "Content-Type: text/html; charset=utf-8",
    "MIME-Version: 1.0",
  ].filter(Boolean).join("\r\n");
  const message = `${headers}\r\n\r\n${htmlBody}`;
  const bytes = new TextEncoder().encode(message);
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function replaceMergeTags(text: string, r: { email: string; name: string | null; metadata: Record<string, string> }): string {
  const nameParts = (r.name || "").trim().split(/\s+/);
  const firstName = nameParts[0] || "";
  const lastName = nameParts.slice(1).join(" ") || "";
  return text
    .replace(/\{\{\s*email\s*\}\}/gi, r.email)
    .replace(/\{\{\s*name\s*\}\}/gi, r.name || "")
    .replace(/\{\{\s*first_name\s*\}\}/gi, r.metadata.first_name || firstName)
    .replace(/\{\{\s*last_name\s*\}\}/gi, r.metadata.last_name || lastName)
    .replace(/\{\{\s*organization\s*\}\}/gi, r.metadata.organization || "")
    .replace(/\{\{\s*role\s*\}\}/gi, r.metadata.role || "")
    .replace(/\{\{\s*city\s*\}\}/gi, r.metadata.city || "")
    .replace(/\{\{\s*state\s*\}\}/gi, r.metadata.state || "");
}

async function getGmailToken(admin: any, userId: string): Promise<{ accessToken: string; senderEmail: string }> {
  const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
  if (!clientId || !clientSecret) throw new Error("Google OAuth not configured");
  const { data: profile } = await admin
    .from("profiles")
    .select("google_refresh_token, gmail_email_address")
    .eq("user_id", userId)
    .maybeSingle();
  if (!profile?.google_refresh_token) throw new Error("Gmail not connected. Connect it in Settings.");
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId, client_secret: clientSecret,
      refresh_token: profile.google_refresh_token, grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error("Failed to refresh Gmail token");
  const j = await res.json();
  let email = profile.gmail_email_address;
  if (!email) {
    const p = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/profile", {
      headers: { Authorization: `Bearer ${j.access_token}` },
    });
    if (p.ok) { email = (await p.json()).emailAddress; }
  }
  if (!email) throw new Error("Could not determine Gmail sender address");
  return { accessToken: j.access_token, senderEmail: email };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claims } = await userClient.auth.getClaims(token);
    const userId = claims?.claims?.sub as string | undefined;
    if (!userId) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: roleRow } = await admin
      .from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
    if (!roleRow) return json({ error: "Forbidden" }, 403);

    const body = await req.json().catch(() => null);
    const campaignId = String(body?.campaign_id || "");
    if (!/^[0-9a-f-]{36}$/i.test(campaignId)) return json({ error: "campaign_id is required" }, 400);

    const { data: tc } = await admin
      .from("gardener_tracked_campaigns")
      .select("id, federation_app_slug, disclose_pixel")
      .eq("campaign_id", campaignId)
      .maybeSingle();
    if (!tc) return json({ error: "No Gardener-tracked campaign for this campaign_id. Import a CSV first." }, 404);

    const { data: campaign } = await admin
      .from("email_campaigns")
      .select("id, subject, html_body, from_name, reply_to")
      .eq("id", campaignId)
      .maybeSingle();
    if (!campaign || !campaign.html_body?.trim()) return json({ error: "Campaign has no content" }, 400);

    const { data: queued } = await admin
      .from("gardener_tracked_sends")
      .select("id, recipient_email, recipient_name, recipient_metadata")
      .eq("tracked_campaign_id", tc.id)
      .is("sent_at", null)
      .limit(500);

    if (!queued || queued.length === 0) return json({ ok: true, sent: 0, message: "Nothing queued" });

    const { accessToken, senderEmail } = await getGmailToken(admin, userId);
    const fromAddress = campaign.from_name ? `${campaign.from_name} <${senderEmail}>` : senderEmail;
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;

    let sent = 0, failed = 0;
    const errors: string[] = [];

    for (const r of queued) {
      const meta = (r.recipient_metadata as Record<string, string>) || {};
      const subject = replaceMergeTags(campaign.subject || "", { email: r.recipient_email, name: r.recipient_name, metadata: meta });
      const personalized = replaceMergeTags(campaign.html_body, { email: r.recipient_email, name: r.recipient_name, metadata: meta });
      const trackedHtml = rewriteHtmlForTracking({
        html: personalized,
        sendId: r.id,
        campaignId,
        federationAppSlug: tc.federation_app_slug,
        supabaseUrl,
        disclosePixel: tc.disclose_pixel !== false,
      });

      const raw = buildMimeEmail(fromAddress, r.recipient_email, subject, trackedHtml, campaign.reply_to || undefined);
      try {
        const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({ raw }),
        });
        if (!res.ok) {
          failed++;
          const errBody = await res.text();
          errors.push(`${r.recipient_email}: ${res.status} ${errBody.slice(0, 120)}`);
          if (res.status === 401 || res.status === 403) break;
        } else {
          const data = await res.json();
          await admin.from("gardener_tracked_sends").update({
            gmail_message_id: data.id,
            gmail_thread_id: data.threadId,
            subject,
            sent_at: new Date().toISOString(),
          }).eq("id", r.id);
          sent++;
        }
      } catch (e) {
        failed++;
        errors.push(`${r.recipient_email}: ${String(e).slice(0, 120)}`);
      }
      await sleep(200); // ~5 req/s
    }

    return json({ ok: true, sent, failed, errors: errors.slice(0, 20) });
  } catch (e) {
    console.error("gardener-campaign-send error:", e);
    await captureEdgeException(e, "gardener-campaign-send");
    return json({ error: "Server error", details: String(e) }, 500);
  }
});
