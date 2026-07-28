/**
 * outlook-send — Sends campaign emails via Microsoft Graph API.
 *
 * WHAT: Sends individual campaign emails through Outlook/Microsoft 365.
 * WHERE: Called from campaign composer when Outlook provider is selected.
 * WHY: Parallel provider to Gmail for tenants using Microsoft 365.
 *
 * AUTH: Authenticated users with outreach_campaigns feature enabled.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { evaluateSendLimit } from "../_shared/sendLimitGuard.ts";
import { renderComplianceFooterHtml } from "../_shared/complianceFooter.ts";
import { recipientHash, rewriteLinksWithUtm, slugify } from "../_shared/utm.ts";

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

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function sha256(message: string): Promise<string> {
  const data = new TextEncoder().encode(message);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function generateUnsubToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Time-bounded fetch with AbortController */
async function timedFetch(url: string, opts: RequestInit = {}, timeoutMs = 30000): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...opts, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

/** Replace merge tags with recipient data */
function replaceMergeTags(
  html: string,
  recipient: { email: string; name: string | null; organization?: string }
): string {
  const nameParts = (recipient.name || "").trim().split(/\s+/);
  const firstName = nameParts[0] || "";
  const lastName = nameParts.slice(1).join(" ") || "";
  const fullName = recipient.name || "";
  const organization = recipient.organization || "your organization";

  return html
    .replace(/\{\{\s*contact\.FIRSTNAME\s*\}\}/gi, firstName)
    .replace(/\{\{\s*contact\.LASTNAME\s*\}\}/gi, lastName)
    .replace(/\{\{\s*contact\.FULLNAME\s*\}\}/gi, fullName)
    .replace(/\{\{\s*contact\.EMAIL\s*\}\}/gi, recipient.email)
    .replace(/\{\{\s*contact\.ORGANIZATION\s*\}\}/gi, organization)
    .replace(/\{\{\s*unsubscribe\s*\}\}/gi, "");
}

/** Refresh Microsoft access token using stored refresh token */
async function getOutlookAccessToken(
  // deno-lint-ignore no-explicit-any
  supabaseAdmin: any,
  connection: { id: string; refresh_token: string; access_token: string | null; token_expires_at: string | null; email_address: string },
  campaignId: string | null,
): Promise<string> {
  // Check if current token is still valid (with 5 min buffer)
  if (connection.access_token && connection.token_expires_at) {
    const expiresAt = new Date(connection.token_expires_at).getTime();
    if (Date.now() < expiresAt - 5 * 60 * 1000) {
      return connection.access_token;
    }
  }

  // Need to refresh
  const clientId = Deno.env.get("MICROSOFT_CLIENT_ID");
  const clientSecret = Deno.env.get("MICROSOFT_CLIENT_SECRET");

  if (!clientId || !clientSecret) {
    throw new Error("Microsoft OAuth not configured");
  }

  if (!connection.refresh_token) {
    throw new Error("No refresh token stored. Please reconnect your Microsoft account.");
  }

  const refreshRes = await timedFetch(
    "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: connection.refresh_token,
        grant_type: "refresh_token",
        scope: "https://graph.microsoft.com/Mail.Send https://graph.microsoft.com/User.Read offline_access",
      }),
    },
    15000,
  );

  if (!refreshRes.ok) {
    const err = await refreshRes.json();
    console.error("Outlook token refresh failed:", err);

    if (campaignId) {
      await supabaseAdmin.from("email_campaign_events").insert({
        campaign_id: campaignId,
        event_type: "auth_failed",
        provider: "outlook",
        message: "Microsoft authorization expired or revoked",
      });
    }

    // Mark connection as needs_reauth
    await supabaseAdmin
      .from("outlook_connections")
      .update({ connection_status: "needs_reauth" })
      .eq("id", connection.id);

    if (err.error === "invalid_grant") {
      throw new Error("Microsoft authorization expired. Please reconnect in Settings → Email Providers.");
    }
    throw new Error("Failed to authenticate with Microsoft");
  }

  const tokens = await refreshRes.json();

  // Store new tokens
  const tokenUpdate: Record<string, unknown> = {
    access_token: tokens.access_token,
  };
  if (tokens.refresh_token) tokenUpdate.refresh_token = tokens.refresh_token;
  if (tokens.expires_in) {
    tokenUpdate.token_expires_at = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
  }

  await supabaseAdmin
    .from("outlook_connections")
    .update(tokenUpdate)
    .eq("id", connection.id);

  return tokens.access_token;
}

/** Send a single email via Microsoft Graph API with retry */
async function sendEmailWithRetry(
  accessToken: string,
  from: string,
  to: string,
  subject: string,
  htmlBody: string,
  replyTo?: string,
  unsubHeaders?: { url: string; headers: Record<string, string> },
  maxRetries = 1,
): Promise<{ success: boolean; error?: string; messageId?: string }> {
  // Build Graph API sendMail payload
  // deno-lint-ignore no-explicit-any
  const message: any = {
    subject,
    body: { contentType: "HTML", content: htmlBody },
    toRecipients: [{ emailAddress: { address: to } }],
    from: { emailAddress: { address: from } },
  };

  if (replyTo) {
    message.replyTo = [{ emailAddress: { address: replyTo } }];
  }

  // Add unsubscribe headers as internet message headers
  if (unsubHeaders?.headers) {
    message.internetMessageHeaders = Object.entries(unsubHeaders.headers).map(([name, value]) => ({
      name,
      value,
    }));
  }

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await timedFetch(
        "https://graph.microsoft.com/v1.0/me/sendMail",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ message, saveToSentItems: true }),
        },
        30000,
      );

      if (res.status === 202 || res.ok) {
        // Graph sendMail returns 202 Accepted on success (empty body)
        const text = await res.text();
        return { success: true, messageId: text || "accepted" };
      }

      const errBody = await res.text();
      console.error("Outlook send failed:", res.status, errBody);

      // Fatal errors — don't retry
      if (res.status === 401) return { success: false, error: "auth_expired" };
      if (res.status === 403) return { success: false, error: "permission_denied:403" };

      // Retryable: 429, 5xx
      if ((res.status === 429 || res.status >= 500) && attempt < maxRetries) {
        const retryAfter = res.headers.get("Retry-After");
        const waitMs = retryAfter ? parseInt(retryAfter) * 1000 : 1000 * (attempt + 1);
        await sleep(Math.min(waitMs, 10000));
        continue;
      }

      return { success: false, error: `send_failed:${res.status}` };
    } catch (err) {
      if (attempt < maxRetries) {
        await sleep(1000);
        continue;
      }
      return { success: false, error: `timeout_or_network:${err instanceof Error ? err.message : "unknown"}` };
    }
  }

  return { success: false, error: "max_retries_exceeded" };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonError("Unauthorized", 401);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return jsonError("Unauthorized", 401);
    }

    const userId = claimsData.claims.sub;
    const body = await req.json();
    const { tenant_id, campaign_id, action, to_email } = body;

    if (!tenant_id) return jsonError("tenant_id required");

    // Service-role client
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );

    // Feature flag check
    const { data: featureCheck } = await supabaseAdmin.rpc("tenant_has_feature", {
      p_tenant_id: tenant_id,
      p_feature_key: "outreach_campaigns",
    });

    if (!featureCheck) {
      return jsonError("Outreach campaigns are not enabled for this tenant. Upgrade to CROS Bridge.", 403);
    }

    // Rate limit
    const { data: withinLimit } = await supabaseAdmin.rpc("check_and_increment_rate_limit", {
      p_user_id: userId,
      p_function_name: "outlook-send",
      p_window_minutes: 1,
      p_max_requests: 10,
    });

    if (!withinLimit) {
      return jsonError("Rate limit exceeded", 429);
    }

    // Get Outlook connection with tokens
    const { data: connection } = await supabaseAdmin
      .from("outlook_connections")
      .select("id, email_address, refresh_token, access_token, token_expires_at, connection_status")
      .eq("tenant_id", tenant_id)
      .eq("user_id", userId)
      .eq("connection_status", "connected")
      .limit(1)
      .maybeSingle();

    if (!connection) {
      return jsonError("No active Outlook connection found. Please connect your Microsoft account first.", 400);
    }

    // ── CHECK LIMITS ──────────────────────────────────
    if (action === "check_limits") {
      const { data: limitRow } = await supabaseAdmin
        .from("email_send_limits")
        .select("*")
        .eq("tenant_id", tenant_id)
        .eq("provider", "outlook")
        .eq("email_address", connection.email_address)
        .maybeSingle();

      const limitResult = evaluateSendLimit(limitRow, "outlook", body.proposed_count ?? 1);
      return jsonResponse({ send_limit: limitResult });
    }

    if (action === "send_test" || action === "send_campaign") {
      if (!campaign_id) return jsonError("campaign_id required for sending");

      // Get campaign
      const { data: campaign } = await supabaseAdmin
        .from("email_campaigns")
        .select("id, name, created_by, status, subject, html_body, reply_to, audience_count, from_name, sent_count, failed_count, tenant_id, metadata")
        .eq("id", campaign_id)
        .single();

      if (!campaign) return jsonError("Campaign not found", 404);
      if (campaign.created_by !== userId) return jsonError("Access denied", 403);
      if (!campaign.html_body?.trim()) return jsonError("Campaign has no email content");

      // Get access token (refreshes if needed)
      let accessToken: string;
      try {
        accessToken = await getOutlookAccessToken(supabaseAdmin, connection as any, campaign_id);
      } catch (err) {
        return jsonError(err instanceof Error ? err.message : "Outlook auth failed");
      }

      const senderEmail = connection.email_address;
      const fromAddress = campaign.from_name
        ? `${campaign.from_name} <${senderEmail}>`
        : senderEmail;

      // Send limit check
      const { data: limitRow } = await supabaseAdmin
        .from("email_send_limits")
        .select("*")
        .eq("tenant_id", tenant_id)
        .eq("provider", "outlook")
        .eq("email_address", senderEmail)
        .maybeSingle();

      const audienceCount = body.audience_count ?? 1;
      const limitResult = evaluateSendLimit(limitRow, "outlook", audienceCount);

      if (limitResult.blocked) {
        if (campaign_id) {
          await supabaseAdmin.from("email_campaign_events").insert({
            campaign_id,
            event_type: "cap_blocked",
            provider: "outlook",
            message: limitResult.message,
            meta: { current: limitResult.currentCount, daily_limit: limitResult.dailyLimit, hard_threshold: limitResult.hardThreshold },
          });
        }
        return jsonError(limitResult.message, 429);
      }

      // Build suppression set
      const suppressedEmails = new Set<string>();
      const { data: suppressions } = await supabaseAdmin
        .from("email_suppressions")
        .select("email")
        .eq("tenant_id", tenant_id);
      for (const s of suppressions || []) {
        if (s.email) suppressedEmails.add(s.email.toLowerCase());
      }
      const { data: dneContacts } = await supabaseAdmin
        .from("contacts")
        .select("email")
        .eq("tenant_id", tenant_id)
        .eq("do_not_email", true)
        .not("email", "is", null);
      for (const c of dneContacts || []) {
        if (c.email) suppressedEmails.add(c.email.toLowerCase());
      }

      // Unsubscribe URL builder
      const generateUnsubscribeUrl = async (recipientEmail: string): Promise<{ url: string; headers: Record<string, string> }> => {
        try {
          const rawToken = generateUnsubToken();
          const tokenHash = await sha256(rawToken);
          const expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + 180);

          await supabaseAdmin.from("email_unsubscribe_tokens").insert({
            tenant_id,
            email: recipientEmail.toLowerCase(),
            campaign_id: campaign_id || null,
            token_hash: tokenHash,
            expires_at: expiresAt.toISOString(),
          });

          const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
          const url = `${supabaseUrl}/functions/v1/unsubscribe?token=${rawToken}`;
          return {
            url,
            headers: {
              "List-Unsubscribe": `<${url}>`,
              "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
            },
          };
        } catch (e) {
          console.error("Unsub token generation failed:", e);
          return { url: "", headers: {} };
        }
      };

      // ── SEND TEST ──────────────────────────────────
      if (action === "send_test") {
        if (!to_email) return jsonError("to_email required for test send");

        const testHtml = replaceMergeTags(campaign.html_body, {
          email: to_email,
          name: "Test Recipient",
          organization: "Sample Organization",
        });

        const testSubject = `[TEST] ${replaceMergeTags(campaign.subject, {
          email: to_email,
          name: "Test Recipient",
          organization: "Sample Organization",
        })}`;

        const result = await sendEmailWithRetry(
          accessToken, senderEmail, to_email, testSubject, testHtml,
          campaign.reply_to || undefined,
        );

        if (!result.success) {
          return jsonError(`Test send failed: ${result.error}`);
        }

        await supabaseAdmin.from("email_campaign_events").insert({
          campaign_id,
          event_type: "test_sent",
          provider: "outlook",
          message: to_email,
        });

        return jsonResponse({ status: "test_sent", to: to_email, provider: "outlook" });
      }

      // ── SEND CAMPAIGN ──────────────────────────────
      if (action === "send_campaign") {
        // Mark campaign as sending
        await supabaseAdmin
          .from("email_campaigns")
          .update({ status: "sending", provider: "outlook" })
          .eq("id", campaign_id);

        await supabaseAdmin.from("email_campaign_events").insert({
          campaign_id,
          event_type: "send_started",
          provider: "outlook",
        });

        // Load audience
        const { data: audience } = await supabaseAdmin
          .from("email_campaign_audience")
          .select("id, email, contact_name, status, contact_id")
          .eq("campaign_id", campaign_id)
          .eq("status", "queued");

        if (!audience?.length) {
          await supabaseAdmin.from("email_campaigns")
            .update({ status: "completed" })
            .eq("id", campaign_id);
          return jsonResponse({ status: "completed", sent: 0, failed: 0, skipped: 0 });
        }

        let sentCount = 0;
        let failedCount = 0;
        let suppressedCount = 0;

        // Get org lookup for merge tags
        const contactIds = audience.filter(a => a.contact_id).map(a => a.contact_id);
        const orgMap = new Map<string, string>();
        if (contactIds.length) {
          const { data: contactOrgs } = await supabaseAdmin
            .from("contacts")
            .select("id, opportunity_id")
            .in("id", contactIds.slice(0, 500));
          
          const oppIds = (contactOrgs || []).filter(c => c.opportunity_id).map(c => c.opportunity_id);
          if (oppIds.length) {
            const { data: orgs } = await supabaseAdmin
              .from("opportunities")
              .select("id, name")
              .in("id", [...new Set(oppIds)]);
            
            const oppNameMap = new Map((orgs || []).map(o => [o.id, o.name]));
            for (const c of contactOrgs || []) {
              if (c.opportunity_id && oppNameMap.has(c.opportunity_id)) {
                orgMap.set(c.id, oppNameMap.get(c.opportunity_id)!);
              }
            }
          }
        }

        for (const recipient of audience) {
          // Suppression check
          if (suppressedEmails.has(recipient.email.toLowerCase())) {
            suppressedCount++;
            await supabaseAdmin
              .from("email_campaign_audience")
              .update({ status: "skipped", error_message: "do_not_email" })
              .eq("id", recipient.id);

            await supabaseAdmin.from("email_campaign_events").insert({
              campaign_id,
              audience_id: recipient.id,
              event_type: "skipped_opt_out",
              provider: "outlook",
              message: recipient.email,
              meta: { reason: "global_unsubscribe" },
            });
            continue;
          }

          // Generate unsubscribe
          const unsub = await generateUnsubscribeUrl(recipient.email);

          // Resolve merge tags
          const org = recipient.contact_id ? orgMap.get(recipient.contact_id) : undefined;
          const personalizedHtml = replaceMergeTags(campaign.html_body, {
            email: recipient.email,
            name: recipient.contact_name,
            organization: org,
          });
          const personalizedSubject = replaceMergeTags(campaign.subject, {
            email: recipient.email,
            name: recipient.contact_name,
            organization: org,
          });

          // Append CAN-SPAM compliance footer (postal address + unsubscribe link).
          // Always include the postal address; include the unsubscribe link when available.
          let finalHtml = personalizedHtml;

          // UTM link rewriting for GA4 attribution.
          // Per-campaign override lives in email_campaigns.metadata.utm.source (default "cros").
          const utmMeta = ((campaign.metadata as Record<string, unknown> | null)?.utm as Record<string, string> | undefined) || {};
          const utmSource = utmMeta.source || "cros";
          const utmCampaign = slugify(campaign.name || campaign.subject || campaign.id);
          const utmContent = await recipientHash(recipient.email, campaign.id);
          finalHtml = rewriteLinksWithUtm(
            finalHtml,
            { source: utmSource, medium: "email", campaign: utmCampaign, content: utmContent },
            unsub.url ? [unsub.url] : [],
          );

          finalHtml += renderComplianceFooterHtml(unsub.url || null);

          // Send via Graph API
          const result = await sendEmailWithRetry(
            accessToken, senderEmail, recipient.email,
            personalizedSubject, finalHtml,
            campaign.reply_to || undefined,
            unsub,
          );

          if (result.success) {
            sentCount++;
            await supabaseAdmin
              .from("email_campaign_audience")
              .update({ status: "sent", sent_at: new Date().toISOString() })
              .eq("id", recipient.id);

            await supabaseAdmin.from("email_campaign_events").insert({
              campaign_id,
              audience_id: recipient.id,
              event_type: "delivered",
              provider: "outlook",
              message: recipient.email,
            });
          } else {
            failedCount++;
            await supabaseAdmin
              .from("email_campaign_audience")
              .update({ status: "failed", error_message: result.error })
              .eq("id", recipient.id);

            await supabaseAdmin.from("email_campaign_events").insert({
              campaign_id,
              audience_id: recipient.id,
              event_type: "failed",
              provider: "outlook",
              message: result.error,
              meta: { email: recipient.email },
            });

            // If auth expired mid-send, stop immediately
            if (result.error === "auth_expired") {
              await supabaseAdmin.from("email_campaigns")
                .update({ status: "paused", sent_count: (campaign.sent_count || 0) + sentCount, failed_count: (campaign.failed_count || 0) + failedCount })
                .eq("id", campaign_id);
              return jsonResponse({
                status: "auth_expired",
                sent: sentCount,
                failed: failedCount,
                suppressed: suppressedCount,
                error: "Microsoft token expired mid-send. Reconnect and resume.",
              });
            }
          }

          // Throttle: ~1 email per second for Outlook safety
          if (audience.length > 1) await sleep(1200);
        }

        // Update campaign totals
        const finalStatus = failedCount > 0 && sentCount === 0 ? "failed" : "completed";
        await supabaseAdmin
          .from("email_campaigns")
          .update({
            status: finalStatus,
            sent_count: (campaign.sent_count || 0) + sentCount,
            failed_count: (campaign.failed_count || 0) + failedCount,
          })
          .eq("id", campaign_id);

        // Update send limit counter
        await supabaseAdmin
          .from("email_send_limits")
          .upsert({
            tenant_id,
            provider: "outlook",
            email_address: senderEmail,
            current_count: limitResult.currentCount + sentCount,
            window_start: new Date().toISOString(),
            daily_limit: limitResult.dailyLimit,
            soft_limit: limitRow?.soft_limit ?? 60,
            hard_limit: limitRow?.hard_limit ?? 85,
          }, { onConflict: "tenant_id,provider,email_address" });

        await supabaseAdmin.from("email_campaign_events").insert({
          campaign_id,
          event_type: "send_completed",
          provider: "outlook",
          meta: { sent: sentCount, failed: failedCount, suppressed: suppressedCount },
        });

        if (suppressedCount > 0) {
          await supabaseAdmin.from("email_campaign_events").insert({
            campaign_id,
            event_type: "suppression_filtered",
            provider: "outlook",
            meta: { suppressed_count: suppressedCount },
          });
        }

        return jsonResponse({
          status: finalStatus,
          sent: sentCount,
          failed: failedCount,
          suppressed: suppressedCount,
          send_limit: limitResult,
          provider: "outlook",
        });
      }
    }

    return jsonError("Invalid action. Supported: check_limits, send_test, send_campaign");
  } catch (error) {
    console.error("outlook-send error:", error);
    return jsonError(error instanceof Error ? error.message : "Internal error", 500);
  }
});
