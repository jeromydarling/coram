/**
 * error-alert-digest — Sends a Gmail digest of new unresolved Sentry issues.
 *
 * WHAT: Queries the Sentry Issues API for recently-active unresolved issues,
 *       builds Lovable fix prompts, and emails a digest to the Gardener.
 * WHERE: Called via pg_cron (every 30 min) or manually.
 * WHY: Sentry is now the source of truth for platform errors (replaces the
 *      homegrown operator_app_errors table). The Gardener still receives the
 *      same actionable digest with copy-paste Lovable fix prompts.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { buildFixPrompt, type FixPromptIssue } from "../_shared/lovableFixPrompt.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SENTRY_ORG = "cros-llc";
const SENTRY_API = "https://sentry.io/api/0";

// ── Helpers ────────────────────────────────────────────────

async function timedFetch(url: string, opts: RequestInit = {}, timeoutMs = 15000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...opts, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function buildMimeEmail(from: string, to: string, subject: string, htmlBody: string): string {
  const headers = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    "Content-Type: text/html; charset=utf-8",
    "MIME-Version: 1.0",
  ].join("\r\n");

  const message = `${headers}\r\n\r\n${htmlBody}`;
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const base64 = btoa(String.fromCharCode(...data));
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// ── Sentry issue fetch + normalization ─────────────────────

interface SentryIssue {
  id: string;
  shortId?: string;
  title?: string;
  culprit?: string;
  permalink?: string;
  count?: string | number;
  firstSeen?: string;
  lastSeen?: string;
  level?: string;
  status?: string;
  platform?: string;
  tags?: Array<{ key: string; value: string }>;
}

function mapSeverity(level?: string): string {
  switch ((level || "").toLowerCase()) {
    case "fatal":
    case "error":
      return "high";
    case "warning":
      return "medium";
    default:
      return "low";
  }
}

function tagValue(issue: SentryIssue, key: string): string | null {
  return issue.tags?.find((t) => t.key === key)?.value ?? null;
}

function normalizeIssue(issue: SentryIssue): FixPromptIssue {
  return {
    source: "sentry",
    severity: mapSeverity(issue.level),
    fingerprint: `${issue.culprit ?? ""}|${issue.shortId ?? issue.id}`,
    message: issue.title ?? "Unknown issue",
    context: {
      route: tagValue(issue, "route") ?? tagValue(issue, "transaction"),
      function_name: tagValue(issue, "function_name") ?? issue.culprit ?? null,
      app_slug: tagValue(issue, "app_slug"),
    },
    count: Number(issue.count ?? 0),
    first_seen_at: issue.firstSeen ?? null,
    last_seen_at: issue.lastSeen ?? null,
    status: issue.status ?? "unresolved",
  };
}

// ── HTML email builder ────────────────────────────────────

function buildDigestHtml(issues: Array<FixPromptIssue & { sentry_url: string | null }>): string {
  const errorBlocks = issues.map((e, i) => {
    const route = (e.context?.route as string) || "unknown";
    const severityColor = e.severity === "high" ? "#c0392b" : "#7f8c8d";
    const prompt = buildFixPrompt(e).replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const sentryLink = e.sentry_url
      ? `<a href="${e.sentry_url}" style="font-size:11px;color:#2980b9;">Open in Sentry ↗</a>`
      : "";

    return `
      <div style="margin-bottom:24px;padding:16px;border:1px solid #e0e0e0;border-radius:8px;background:#fafafa;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <span style="font-weight:600;font-size:14px;color:#2c3e50;">
            ${i + 1}. [${e.source}] ${e.message.slice(0, 80)}${e.message.length > 80 ? "…" : ""}
          </span>
          <span style="font-size:11px;padding:2px 8px;border-radius:4px;background:${severityColor};color:white;">
            ${e.severity}
          </span>
        </div>
        <div style="font-size:12px;color:#7f8c8d;margin-bottom:12px;">
          Route: <code>${route}</code> · Count: ${e.count} · Since: ${e.first_seen_at ? new Date(e.first_seen_at).toLocaleDateString() : "unknown"} · ${sentryLink}
        </div>
        <details style="margin-top:8px;">
          <summary style="cursor:pointer;font-size:12px;font-weight:600;color:#2980b9;">
            📋 Lovable Fix Prompt (copy &amp; paste)
          </summary>
          <pre style="margin-top:8px;padding:12px;background:#1e1e1e;color:#d4d4d4;border-radius:6px;font-size:11px;line-height:1.5;overflow-x:auto;white-space:pre-wrap;">${prompt}</pre>
        </details>
      </div>
    `;
  });

  return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
    <body style="margin:0;padding:0;background:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
      <div style="max-width:640px;margin:0 auto;padding:24px;">
        <div style="text-align:center;margin-bottom:24px;">
          <h1 style="font-size:20px;color:#2c3e50;margin:0;">CROS™ Error Digest</h1>
          <p style="font-size:13px;color:#7f8c8d;margin:4px 0 0;">
            ${issues.length} new issue${issues.length !== 1 ? "s" : ""} since last alert · ${new Date().toLocaleDateString()}
          </p>
        </div>

        ${errorBlocks.join("")}

        <div style="margin-top:32px;padding-top:16px;border-top:1px solid #eee;text-align:center;">
          <p style="font-size:12px;color:#95a5a6;">
            Each issue above includes a ready-to-paste Lovable fix prompt.<br>
            Open the details, copy the prompt, paste into Lovable chat.
          </p>
          <a href="https://thecros.lovable.app/operator/error-desk"
             style="display:inline-block;margin-top:8px;padding:8px 20px;background:#2c6e49;color:white;border-radius:6px;text-decoration:none;font-size:13px;">
            Open Error Desk
          </a>
        </div>
      </div>
    </body>
    </html>
  `;
}

// ── Main handler ──────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const SENTRY_AUTH_TOKEN = Deno.env.get("SENTRY_AUTH_TOKEN");
    if (!SENTRY_AUTH_TOKEN) {
      return new Response(
        JSON.stringify({ ok: false, error: "SENTRY_AUTH_TOKEN not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID");
    const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET");
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      return new Response(JSON.stringify({ error: "Google OAuth not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Fetch unresolved Sentry issues active in the last 30 minutes.
    const sentryUrl = new URL(
      `${SENTRY_API}/organizations/${SENTRY_ORG}/issues/`,
    );
    sentryUrl.searchParams.set("query", "is:unresolved age:-30m");
    sentryUrl.searchParams.set("limit", "10");
    sentryUrl.searchParams.set("statsPeriod", "24h");

    const sentryRes = await timedFetch(
      sentryUrl.toString(),
      { headers: { Authorization: `Bearer ${SENTRY_AUTH_TOKEN}` } },
      15000,
    );

    if (!sentryRes.ok) {
      const message = await sentryRes.text();
      throw new Error(`Sentry issues fetch failed [${sentryRes.status}]: ${message}`);
    }

    const rawIssues = (await sentryRes.json()) as SentryIssue[];
    if (!rawIssues || rawIssues.length === 0) {
      return new Response(JSON.stringify({ ok: true, message: "No new errors to alert" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // high severity first, then most recent
    const issues = rawIssues
      .map((i) => ({ ...normalizeIssue(i), sentry_url: i.permalink ?? null }))
      .sort((a, b) => {
        if (a.severity === b.severity) {
          return (b.last_seen_at ?? "").localeCompare(a.last_seen_at ?? "");
        }
        return a.severity === "high" ? -1 : 1;
      });

    // 2. Find the Gardener account (Gardener@thecros.app) for sending via Gmail
    const GARDENER_EMAIL = "Gardener@thecros.app";
    const { data: profile } = await supabase
      .from("profiles")
      .select("user_id, google_refresh_token, gmail_email_address")
      .eq("gmail_email_address", GARDENER_EMAIL)
      .not("google_refresh_token", "is", null)
      .limit(1)
      .maybeSingle();

    if (!profile?.google_refresh_token) {
      throw new Error(`Gardener account (${GARDENER_EMAIL}) not found or Gmail not connected`);
    }

    // 3. Get fresh Gmail access token
    const refreshRes = await timedFetch(
      "https://oauth2.googleapis.com/token",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: GOOGLE_CLIENT_ID,
          client_secret: GOOGLE_CLIENT_SECRET,
          refresh_token: profile.google_refresh_token,
          grant_type: "refresh_token",
        }),
      },
      10000
    );

    if (!refreshRes.ok) {
      const err = await refreshRes.text();
      throw new Error(`Gmail token refresh failed: ${err}`);
    }

    const tokens = await refreshRes.json();

    // 4. Build and send digest email
    const subject = `🔧 CROS Error Digest — ${issues.length} new issue${issues.length !== 1 ? "s" : ""}`;
    const html = buildDigestHtml(issues);
    const raw = buildMimeEmail(
      `CROS Alerts <${profile.gmail_email_address}>`,
      profile.gmail_email_address,
      subject,
      html
    );

    const sendRes = await timedFetch(
      "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokens.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ raw }),
      },
      15000
    );

    if (!sendRes.ok) {
      const errText = await sendRes.text();
      throw new Error(`Gmail send failed [${sendRes.status}]: ${errText}`);
    }

    await sendRes.json(); // consume body

    return new Response(
      JSON.stringify({ ok: true, alerted: issues.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("error-alert-digest:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ ok: false, error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
