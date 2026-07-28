import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { computeInputsHash } from "../_shared/campaignRiskEval.ts";
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

// SHA-256 for token hashing
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

// Build URL-safe base64 MIME email with optional extra headers
function buildMimeEmail(
  from: string,
  to: string,
  subject: string,
  htmlBody: string,
  replyTo?: string,
  extraHeaders?: Record<string, string>
): string {
  const headers = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    replyTo ? `Reply-To: ${replyTo}` : null,
    ...Object.entries(extraHeaders || {}).map(([k, v]) => `${k}: ${v}`),
    "Content-Type: text/html; charset=utf-8",
    "MIME-Version: 1.0",
  ]
    .filter(Boolean)
    .join("\r\n");

  const message = `${headers}\r\n\r\n${htmlBody}`;

  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const base64 = btoa(String.fromCharCode(...data));

  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// Replace merge tags with recipient data
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

// Mint access token from refresh token (memory only - never stored)
async function getGmailAccessToken(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  userId: string,
  campaignId: string
): Promise<{ accessToken: string; senderEmail: string }> {
  const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID");
  const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET");

  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    throw new Error("Google OAuth not configured");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("google_refresh_token, gmail_email_address")
    .eq("user_id", userId)
    .single();

  if (profileError || !profile?.google_refresh_token) {
    throw new Error("Gmail not connected. Please connect your Gmail in Settings.");
  }

  const refreshRes = await fetch("https://oauth2.googleapis.com/token", {
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

    await supabase.from("email_campaign_events").insert({
      campaign_id: campaignId,
      event_type: "auth_failed",
      message: "Gmail authorization expired or revoked",
    });

    if (err.error === "invalid_grant") {
      throw new Error("Gmail authorization expired. Please reconnect in Settings.");
    }
    throw new Error("Failed to authenticate with Gmail");
  }

  const tokens = await refreshRes.json();

  let senderEmail = profile.gmail_email_address;
  if (!senderEmail) {
    const gmailRes = await fetch(
      "https://gmail.googleapis.com/gmail/v1/users/me/profile",
      { headers: { Authorization: `Bearer ${tokens.access_token}` } }
    );
    if (gmailRes.ok) {
      const gmailProfile = await gmailRes.json();
      senderEmail = gmailProfile.emailAddress;

      await supabase
        .from("profiles")
        .update({ gmail_email_address: senderEmail })
        .eq("user_id", userId);
    }
  }

  if (!senderEmail) {
    throw new Error("Could not determine Gmail address");
  }

  return {
    accessToken: tokens.access_token,
    senderEmail,
  };
}

// Normalize Gmail failure into structured category
function normalizeGmailFailure(error: string): { category: string; code: string; raw: string } {
  const raw = (error || "").slice(0, 500); // truncate safely
  const lower = raw.toLowerCase();

  // Quota / rate limit
  if (lower.includes("429") || lower.includes("quota") || lower.includes("rate limit") || lower.includes("quota_exceeded")) {
    return { category: "quota", code: "429_quota", raw };
  }

  // Invalid address
  if (lower.includes("invalid to") || lower.includes("invalid email") || lower.includes("invalid recipient") || lower.includes("invalid address")) {
    return { category: "invalid_address", code: "invalid_to", raw };
  }

  // Bounce / permanent
  if (lower.includes("user not found") || lower.includes("mailbox unavailable") || lower.includes("mailbox not found") || lower.includes("no such user") || lower.includes("does not exist")) {
    return { category: "bounce", code: "mailbox_unavailable", raw };
  }
  if (lower.includes("550") || lower.includes("553") || lower.includes("554") || lower.includes("permanently rejected")) {
    return { category: "provider_perm", code: "smtp_perm", raw };
  }

  // Temporary provider errors
  if (lower.includes("5xx") || lower.includes("timeout") || lower.includes("network") || lower.includes("500") || lower.includes("502") || lower.includes("503") || lower.includes("504") || lower.includes("provider_temp") || lower.includes("connection")) {
    return { category: "provider_temp", code: "server_error", raw };
  }

  // Auth errors are permanent
  if (lower.includes("auth_expired") || lower.includes("401") || lower.includes("403")) {
    return { category: "provider_perm", code: "auth_error", raw };
  }

  return { category: "unknown", code: "unknown", raw };
}

// Send a single email via Gmail API with retry
async function sendEmailWithRetry(
  accessToken: string,
  from: string,
  to: string,
  subject: string,
  htmlBody: string,
  replyTo?: string,
  maxRetries = 1,
  extraHeaders?: Record<string, string>
): Promise<{ success: boolean; error?: string; messageId?: string }> {
  const raw = buildMimeEmail(from, to, subject, htmlBody, replyTo, extraHeaders);

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    try {
      const res = await fetch(
        "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ raw }),
          signal: controller.signal,
        }
      );

      clearTimeout(timeout);

      if (res.ok) {
        const data = await res.json();
        return { success: true, messageId: data.id };
      }

      const errBody = await res.text();
      console.error("Gmail send failed:", res.status, errBody);

      // Fatal errors - don't retry
      if (res.status === 401) {
        return { success: false, error: "auth_expired" };
      }
      if (res.status === 403) {
        return { success: false, error: "quota_exceeded:403" };
      }

      // Retryable: 429, 5xx
      if ((res.status === 429 || res.status >= 500) && attempt < maxRetries) {
        await sleep(1000 * (attempt + 1));
        continue;
      }

      return { success: false, error: `send_failed:${res.status}` };
    } catch (err) {
      clearTimeout(timeout);
      if (attempt < maxRetries) {
        await sleep(1000);
        continue;
      }
      return { success: false, error: `timeout_or_network:${err instanceof Error ? err.message : "unknown"}` };
    }
  }

  return { success: false, error: "max_retries_exceeded" };
}

// Upsert subject stats (increment only on valid transition)
// deno-lint-ignore no-explicit-any
async function upsertSubjectStats(supabase: any, userId: string, subject: string, sentDelta: number, failedDelta: number) {
  try {
    // Check if row exists
    const { data: existing } = await supabase
      .from("campaign_subject_stats")
      .select("id, sent_count, failed_count")
      .eq("created_by", userId)
      .eq("subject", subject)
      .maybeSingle();

    if (existing) {
      await supabase
        .from("campaign_subject_stats")
        .update({
          sent_count: (existing.sent_count || 0) + sentDelta,
          failed_count: (existing.failed_count || 0) + failedDelta,
          last_used_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
    } else {
      await supabase.from("campaign_subject_stats").insert({
        created_by: userId,
        subject,
        sent_count: Math.max(sentDelta, 0),
        failed_count: Math.max(failedDelta, 0),
        last_used_at: new Date().toISOString(),
      });
    }
  } catch {
    // Non-fatal
  }
}

// deno-lint-ignore no-explicit-any
async function emitUsageEvent(supabase: any, campaignId: string, eventType: string, quantity: number, unit: string) {
  try {
    await supabase.from("usage_events").insert({
      workflow_key: "gmail_campaign",
      run_id: campaignId,
      event_type: eventType,
      quantity,
      unit,
      org_id: "system",
    });
  } catch {
    // Non-fatal
  }
}

// Check daily email cap for the user. Returns { allowed, current, softCap, hardCap, isWarning }
// deno-lint-ignore no-explicit-any
async function checkDailyCap(supabase: any, _userId: string, _campaignId?: string): Promise<{
  allowed: boolean;
  current: number;
  softCap: number;
  hardCap: number;
  isWarning: boolean;
}> {
  // Default caps (configurable per-org in future via org_settings table)
  const softCap = 500;
  const hardCap = 2000;

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from("usage_events")
    .select("quantity")
    .eq("workflow_key", "gmail_campaign")
    .eq("event_type", "email_sent")
    .gte("occurred_at", todayStart.toISOString());

  if (error) {
    console.error("[cap] Failed to check daily usage:", error.message);
    // Fail open to avoid blocking legitimate sends
    return { allowed: true, current: 0, softCap, hardCap, isWarning: false };
  }

  // deno-lint-ignore no-explicit-any
  const current = (data || []).reduce((sum: number, r: any) => sum + (Number(r.quantity) || 0), 0);

  return {
    allowed: current < hardCap,
    current,
    softCap,
    hardCap,
    isWarning: current >= softCap && current < hardCap,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonError("Unauthorized", 401);
    }

    const token = authHeader.replace("Bearer ", "");

    // Verify JWT (Lovable Cloud uses ES256; validate in-code via signing keys)
    const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);
    const userId = claimsData?.claims?.sub;
    if (claimsError || !userId) {
      return jsonError("Invalid token", 401);
    }

    // Service role client for DB access
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Check if warehouse_manager (blocked)
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);

    // deno-lint-ignore no-explicit-any
    const isWarehouseManager = (roles || []).some((r: any) => r.role === "warehouse_manager");
    if (isWarehouseManager) {
      return jsonError("Access denied", 403);
    }

    // ── Campaigns add-on entitlement check ──────────────────
    const body = await req.json();
    const { action, campaign_id, to_email } = body;

    if (campaign_id) {
      // Get tenant_id from the campaign
      const { data: campaignCheck } = await supabase
        .from("email_campaigns")
        .select("tenant_id")
        .eq("id", campaign_id)
        .maybeSingle();

      if (campaignCheck?.tenant_id) {
        const { data: entRow } = await supabase
          .from("tenant_entitlements")
          .select("campaigns_enabled")
          .eq("tenant_id", campaignCheck.tenant_id)
          .maybeSingle();

        if (!entRow?.campaigns_enabled) {
          return jsonError("Campaigns add-on required", 403);
        }
      }
    }

    if (!campaign_id) {
      return jsonError("campaign_id required");
    }

    // Verify campaign ownership
    const { data: campaign } = await supabase
      .from("email_campaigns")
      .select("id, name, created_by, status, subject, html_body, reply_to, audience_count, from_name, sent_count, failed_count, tenant_id, metadata")
      .eq("id", campaign_id)
      .single();

    if (!campaign) {
      return jsonError("Campaign not found", 404);
    }

    if (campaign.created_by !== userId) {
      return jsonError("Access denied", 403);
    }

    // Rate limit
    const { data: withinLimit } = await supabase.rpc("check_and_increment_rate_limit", {
      p_user_id: userId,
      p_function_name: "gmail-campaign-send",
      p_window_minutes: 1,
      p_max_requests: 10,
    });

    if (!withinLimit) {
      return jsonError("Rate limit exceeded", 429);
    }

    // Validate html_body exists
    if (!campaign.html_body?.trim()) {
      return jsonError("Campaign has no email content");
    }

    // Get Gmail access token
    let gmailAuth: { accessToken: string; senderEmail: string };
    try {
      gmailAuth = await getGmailAccessToken(supabase, userId, campaign_id);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Gmail auth failed";
      return jsonError(message);
    }

    const { accessToken, senderEmail } = gmailAuth;

    const fromAddress = campaign.from_name
      ? `${campaign.from_name} <${senderEmail}>`
      : senderEmail;

    // ── SEND TEST ──────────────────────────────────
    if (action === "send_test") {
      if (!to_email) {
        return jsonError("to_email required for test send");
      }

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
        accessToken,
        fromAddress,
        to_email,
        testSubject,
        testHtml,
        campaign.reply_to || undefined
      );

      if (!result.success) {
        return jsonError(`Test send failed: ${result.error}`);
      }

      await supabase.from("email_campaign_events").insert({
        campaign_id,
        event_type: "test_sent",
        message: `Test email sent to ${to_email}`,
        meta: { message_id: result.messageId },
      });

      return jsonResponse({ sent: true, to: to_email });
    }

    // ── SEND CAMPAIGN ──────────────────────────────
    if (action === "send_campaign") {
      // Idempotent: allow draft, audience_ready, or re-trigger paused
      if (!["draft", "audience_ready", "paused"].includes(campaign.status)) {
        return jsonError(`Cannot send campaign in status: ${campaign.status}`);
      }

      if (!campaign.audience_count || campaign.audience_count === 0) {
        return jsonError("No recipients in audience");
      }

      // ── SEND INTENT VALIDATION (F5) ──────────────────
      const { data: activeIntent } = await supabase
        .from("email_campaign_send_intents")
        .select("*")
        .eq("campaign_id", campaign_id)
        .in("intent_status", ["proposed", "acknowledged", "consumed"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!activeIntent) {
        return jsonResponse(
          { error: "SEND_INTENT_REQUIRED", message: "A send intent is required before sending. Create one via the Review step." },
          409
        );
      }

      // Already consumed = idempotent resume (only if campaign is paused/sending)
      if (activeIntent.intent_status === "consumed") {
        if (!["paused", "sending"].includes(campaign.status)) {
          return jsonResponse(
            { error: "ALREADY_CONSUMED", message: "This send intent was already used." },
            409
          );
        }
        // Allow resume to proceed — don't block
      } else {
        // Check expiry
        if (new Date(activeIntent.expires_at) < new Date()) {
          await supabase
            .from("email_campaign_send_intents")
            .update({ intent_status: "expired" })
            .eq("id", activeIntent.id);
          return jsonResponse(
            { error: "INTENT_EXPIRED", message: "Send intent has expired. Please create a new one." },
            409
          );
        }

        // Check acknowledgement
        if (activeIntent.requires_ack && activeIntent.intent_status !== "acknowledged") {
          return jsonResponse(
            { error: "ACK_REQUIRED", message: "This send requires acknowledgement before proceeding.", risk_level: activeIntent.risk_level, risk_reasons: activeIntent.risk_reasons },
            409
          );
        }

        // Validate inputs_hash hasn't changed (content/audience unchanged)
        const currentHash = computeInputsHash(
          campaign.subject || "",
          campaign.html_body || "",
          campaign.audience_count || 0
        );
        // Get cached risk eval hash
        const { data: riskEval } = await supabase
          .from("email_campaign_risk_eval")
          .select("inputs_hash")
          .eq("campaign_id", campaign_id)
          .maybeSingle();

        if (riskEval && riskEval.inputs_hash !== currentHash) {
          // Invalidate intent
          await supabase
            .from("email_campaign_send_intents")
            .update({ intent_status: "expired" })
            .eq("id", activeIntent.id);
          return jsonResponse(
            { error: "CONTENT_CHANGED", message: "Campaign content or audience changed since intent was created. Please create a new send intent." },
            409
          );
        }

        // Consume the intent
        await supabase
          .from("email_campaign_send_intents")
          .update({ intent_status: "consumed", consumed_at: new Date().toISOString() })
          .eq("id", activeIntent.id);
      }

      // ── CAP ENFORCEMENT (server-side) ──
      const capCheck = await checkDailyCap(supabase, userId, campaign_id);
      if (!capCheck.allowed) {
        await supabase.from("email_campaign_events").insert({
          campaign_id,
          event_type: "cap_blocked",
          message: `Daily hard cap reached (${capCheck.current}/${capCheck.hardCap})`,
          meta: { current: capCheck.current, hard_cap: capCheck.hardCap },
        });
        return jsonError(
          `Daily sending limit reached (${capCheck.current}/${capCheck.hardCap} emails today). Try again tomorrow.`,
          429
        );
      }
      if (capCheck.isWarning) {
        await supabase.from("email_campaign_events").insert({
          campaign_id,
          event_type: "cap_warning",
          message: `Approaching daily cap (${capCheck.current}/${capCheck.softCap} soft cap)`,
          meta: { current: capCheck.current, soft_cap: capCheck.softCap },
        });
      }

      // Transition to sending (idempotent)
      await supabase
        .from("email_campaigns")
        .update({ status: "sending", updated_at: new Date().toISOString() })
        .eq("id", campaign_id);

      await supabase.from("email_campaign_events").insert({
        campaign_id,
        event_type: "send_started",
        meta: { audience_count: campaign.audience_count },
      });

      // ── SUPPRESSION FILTERING ──────────────────────
      // Load suppressed emails for this tenant
      const suppressedEmails = new Set<string>();
      if (campaign.tenant_id) {
        const { data: suppressions } = await supabase
          .from("email_suppressions")
          .select("email")
          .eq("tenant_id", campaign.tenant_id);
        for (const s of suppressions || []) {
          suppressedEmails.add(s.email.toLowerCase());
        }
      }

      // Load queued audience only (supports resume from paused)
      const { data: rawAudience } = await supabase
        .from("email_campaign_audience")
        .select("id, email, name, status, opportunity_id")
        .eq("campaign_id", campaign_id)
        .eq("status", "queued")
        .order("created_at", { ascending: true });

      // Bulk-resolve organization names for audience members
      const orgIds = [...new Set((rawAudience || []).map((r: { opportunity_id?: string }) => r.opportunity_id).filter(Boolean))] as string[];
      const orgNameMap = new Map<string, string>();
      if (orgIds.length > 0) {
        const { data: orgs } = await supabase
          .from("opportunities")
          .select("id, name")
          .in("id", orgIds);
        for (const o of orgs || []) {
          if (o.name) orgNameMap.set(o.id, o.name);
        }
      }

      // Filter out suppressed recipients and mark them skipped
      const audience = [];
      let suppressedCount = 0;
      for (const r of rawAudience || []) {
        if (suppressedEmails.has(r.email.toLowerCase())) {
          suppressedCount++;
          await supabase.from("email_campaign_audience").update({ status: "skipped", error_message: "suppressed" }).eq("id", r.id);
        } else {
          audience.push(r);
        }
      }
      if (suppressedCount > 0) {
        await supabase.from("email_campaign_events").insert({
          campaign_id,
          event_type: "suppression_filtered",
          meta: { suppressed_count: suppressedCount },
        });
      }

      if (!audience || audience.length === 0) {
        // If no queued, check if all are already sent
        const { count: sentCount } = await supabase
          .from("email_campaign_audience")
          .select("id", { count: "exact", head: true })
          .eq("campaign_id", campaign_id)
          .eq("status", "sent");

        await supabase
          .from("email_campaigns")
          .update({
            status: "sent",
            sent_count: sentCount ?? 0,
            last_sent_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", campaign_id);

        return jsonResponse({
          sent: true,
          success_count: sentCount ?? 0,
          fail_count: 0,
          message: "All recipients already processed",
        });
      }

      let successCount = campaign.sent_count || 0;
      let failCount = campaign.failed_count || 0;
      let fatalError = false;

      const batchSize = 25;
      const interBatchDelayMs = 300;
      const interEmailDelayMs = 200; // ~5 req/s rate limit

      for (let i = 0; i < audience.length; i += batchSize) {
        // Check if campaign was paused
        const { data: currentCampaign } = await supabase
          .from("email_campaigns")
          .select("status")
          .eq("id", campaign_id)
          .single();

        if (currentCampaign?.status === "paused") {
          await supabase.from("email_campaign_events").insert({
            campaign_id,
            event_type: "paused",
            meta: { sent_so_far: successCount, failed_so_far: failCount },
          });
          break;
        }

        const batch = audience.slice(i, i + batchSize);

        for (const recipient of batch) {
          // Skip already-sent (idempotency guard)
          if (recipient.status !== "queued") continue;

          // Generate unsubscribe link for this recipient
          let unsubscribeUrl = "";
          const unsubHeaders: Record<string, string> = {};
          if (campaign.tenant_id) {
            try {
              const rawToken = generateUnsubToken();
              const tokenHash = await sha256(rawToken);
              const expiresAt = new Date();
              expiresAt.setDate(expiresAt.getDate() + 180);
              await supabase.from("email_unsubscribe_tokens").insert({
                tenant_id: campaign.tenant_id,
                email: recipient.email.toLowerCase(),
                campaign_id,
                token_hash: tokenHash,
                expires_at: expiresAt.toISOString(),
              });
              const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
              unsubscribeUrl = `${supabaseUrl}/functions/v1/unsubscribe?token=${rawToken}`;
              unsubHeaders["List-Unsubscribe"] = `<${unsubscribeUrl}>`;
              unsubHeaders["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click";
            } catch (e) {
              console.error("Unsub token generation failed:", e);
            }
          }

          const recipientOrg = recipient.opportunity_id ? orgNameMap.get(recipient.opportunity_id) : undefined;

          let personalizedHtml = replaceMergeTags(campaign.html_body, {
            email: recipient.email,
            name: recipient.name,
            organization: recipientOrg,
          });

          // Also personalize the subject line
          const personalizedSubject = replaceMergeTags(campaign.subject, {
            email: recipient.email,
            name: recipient.name,
            organization: recipientOrg,
          });

          // UTM link rewriting for GA4 attribution.
          // Per-campaign override lives in email_campaigns.metadata.utm.source (default "cros").
          const utmMeta = ((campaign.metadata as Record<string, unknown> | null)?.utm as Record<string, string> | undefined) || {};
          const utmSource = utmMeta.source || "cros";
          const utmCampaign = slugify(campaign.name || campaign.subject || campaign.id);
          const utmContent = await recipientHash(recipient.email, campaign.id);
          personalizedHtml = rewriteLinksWithUtm(
            personalizedHtml,
            { source: utmSource, medium: "email", campaign: utmCampaign, content: utmContent },
            unsubscribeUrl ? [unsubscribeUrl] : [],
          );

          // Append CAN-SPAM compliance footer (postal address + unsubscribe link)
          personalizedHtml += renderComplianceFooterHtml(unsubscribeUrl || null);

          const result = await sendEmailWithRetry(
            accessToken,
            fromAddress,
            recipient.email,
            personalizedSubject,
            personalizedHtml,
            campaign.reply_to || undefined,
            1,
            unsubHeaders
          );

          if (result.success) {
            successCount++;
            await supabase
              .from("email_campaign_audience")
              .update({
                status: "sent",
                sent_at: new Date().toISOString(),
                provider_message_id: result.messageId || null,
              })
              .eq("id", recipient.id);

            await supabase.from("email_campaign_events").insert({
              campaign_id,
              audience_id: recipient.id,
              event_type: "recipient_sent",
              message: recipient.email,
              meta: { message_id: result.messageId },
            });

            await emitUsageEvent(supabase, campaign_id, "email_sent", 1, "emails_sent");
          } else {
            failCount++;
            const failure = normalizeGmailFailure(result.error || "Unknown error");
            await supabase
              .from("email_campaign_audience")
              .update({
                status: "failed",
                error_message: result.error || "Unknown error",
                failure_category: failure.category,
                failure_code: failure.code,
                failure_raw: failure.raw,
              })
              .eq("id", recipient.id);

            await supabase.from("email_campaign_events").insert({
              campaign_id,
              audience_id: recipient.id,
              event_type: "recipient_failed",
              message: recipient.email,
              meta: { error: result.error, failure_category: failure.category, failure_code: failure.code },
            });

            await emitUsageEvent(supabase, campaign_id, "email_failed", 1, "emails_failed");

            // Fatal errors
            if (
              result.error?.includes("quota_exceeded") ||
              result.error === "auth_expired"
            ) {
              fatalError = true;
              break;
            }
          }

          // Rate limit between individual sends
          await sleep(interEmailDelayMs);
        }

        if (fatalError) break;

        // Update progress after each batch
        await supabase
          .from("email_campaigns")
          .update({
            sent_count: successCount,
            failed_count: failCount,
            last_sent_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", campaign_id);

        // Delay between batches
        if (i + batchSize < audience.length) {
          await sleep(interBatchDelayMs);
        }
      }

      // Final status update
      const finalStatus = fatalError ? "failed" : "sent";

      // Re-check if paused during execution
      const { data: finalCampaign } = await supabase
        .from("email_campaigns")
        .select("status")
        .eq("id", campaign_id)
        .single();

      if (finalCampaign?.status !== "paused") {
        await supabase
          .from("email_campaigns")
          .update({
            status: finalStatus,
            sent_count: successCount,
            failed_count: failCount,
            last_sent_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", campaign_id);
      }

      await supabase.from("email_campaign_events").insert({
        campaign_id,
        event_type: fatalError ? "send_failed" : "send_finished",
        meta: { success_count: successCount, fail_count: failCount },
      });

      // B1: Upsert subject stats
      await upsertSubjectStats(supabase, userId, campaign.subject, successCount - (campaign.sent_count || 0), failCount - (campaign.failed_count || 0));

      return jsonResponse({
        sent: !fatalError,
        success_count: successCount,
        fail_count: failCount,
      });
    }

    // ── PAUSE CAMPAIGN ──────────────────────────────
    if (action === "pause") {
      if (campaign.status !== "sending") {
        return jsonError("Can only pause a sending campaign");
      }

      await supabase
        .from("email_campaigns")
        .update({ status: "paused", updated_at: new Date().toISOString() })
        .eq("id", campaign_id);

      await supabase.from("email_campaign_events").insert({
        campaign_id,
        event_type: "paused",
        meta: { sent_count: campaign.sent_count, failed_count: campaign.failed_count },
      });

      return jsonResponse({ paused: true });
    }

    // ── RESUME CAMPAIGN ─────────────────────────────
    if (action === "resume") {
      if (campaign.status !== "paused") {
        return jsonError("Can only resume a paused campaign");
      }

      await supabase
        .from("email_campaigns")
        .update({ status: "sending", updated_at: new Date().toISOString() })
        .eq("id", campaign_id);

      await supabase.from("email_campaign_events").insert({
        campaign_id,
        event_type: "resumed",
      });

      return jsonResponse({ resumed: true, message: "Campaign resumed. Trigger send_campaign to continue." });
    }

    // ── RETRY FAILED RECIPIENTS ─────────────────────
    if (action === "retry_failed") {
      // Reset failed audience rows back to queued
      const { data: failedRows, error: resetError } = await supabase
        .from("email_campaign_audience")
        .update({
          status: "queued",
          error_message: null,
          sent_at: null,
          failure_category: null,
          failure_code: null,
          failure_raw: null,
        })
        .eq("campaign_id", campaign_id)
        .eq("status", "failed")
        .select("id");

      if (resetError) throw resetError;

      const resetCount = failedRows?.length ?? 0;

      if (resetCount > 0) {
        // Reset campaign status to allow re-send
        await supabase
          .from("email_campaigns")
          .update({
            status: "audience_ready",
            failed_count: 0,
            updated_at: new Date().toISOString(),
          })
          .eq("id", campaign_id);
      }

      return jsonResponse({ reset_count: resetCount });
    }

    return jsonError("Invalid action. Supported: send_test, send_campaign, pause, resume, retry_failed");
  } catch (error) {
    console.error("gmail-campaign-send error:", error);
    const message = error instanceof Error ? error.message : "Internal error";
    return jsonError(message, 500);
  }
});
