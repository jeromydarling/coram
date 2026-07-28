/**
 * migration-gardener-notify — Sends a calm alert to Gardener@thecros.app
 * when a migration run encounters trouble. Called internally by other
 * relatio-* functions; not user-facing.
 *
 * WHAT: Pastoral failure notification + AI rescue summary.
 * WHERE: Invoked by migration-ai-repair and relatio-import-start on failure.
 * WHY: Gardener stewardship — the user shouldn't be alone when imports stumble.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-internal-key",
};

const GARDENER_EMAIL = "Gardener@thecros.app";

interface NotifyBody {
  migration_id: string;
  tenant_id: string;
  integration_key: string;
  reason: string;
  failed_count?: number;
  rescued_count?: number;
  unrescuable_count?: number;
  sample_errors?: string[];
}

function buildHtml(b: NotifyBody, tenantName: string, baseUrl: string): string {
  const rescued = b.rescued_count ?? 0;
  const failed = b.failed_count ?? 0;
  const unrescuable = b.unrescuable_count ?? 0;
  const samples = (b.sample_errors ?? []).slice(0, 5)
    .map((e) => `<li style="margin:4px 0;color:#7a5a3a;font-size:13px"><code>${escapeHtml(e.slice(0, 240))}</code></li>`)
    .join("");
  const reviewUrl = `${baseUrl}/operator/migration-review?migration_id=${b.migration_id}`;

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:hsl(30,20%,96%);font-family:-apple-system,'Source Serif 4',Georgia,serif;color:#3a2f24">
  <div style="max-width:600px;margin:0 auto;padding:32px 24px">
    <p style="font-family:'Playfair Display',Georgia,serif;font-size:22px;margin:0 0 16px;font-weight:500">A migration paused for your attention</p>

    <p style="line-height:1.6;margin:0 0 16px">
      A migration run for <strong>${escapeHtml(tenantName)}</strong>
      (<code>${escapeHtml(b.integration_key)}</code>) encountered trouble.
      Their data is safe — nothing was overwritten.
    </p>

    <p style="line-height:1.6;margin:0 0 16px;color:#5a4a3a">
      ${escapeHtml(b.reason)}
    </p>

    <table style="width:100%;border-collapse:collapse;margin:20px 0;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #e8dfd2">
      <tr><td style="padding:14px 18px;border-bottom:1px solid #f0e8da">Rows that failed</td><td style="padding:14px 18px;text-align:right;border-bottom:1px solid #f0e8da"><strong>${failed}</strong></td></tr>
      <tr><td style="padding:14px 18px;border-bottom:1px solid #f0e8da">AI proposed a repair</td><td style="padding:14px 18px;text-align:right;border-bottom:1px solid #f0e8da"><strong>${rescued}</strong></td></tr>
      <tr><td style="padding:14px 18px">Needs human eyes</td><td style="padding:14px 18px;text-align:right"><strong>${unrescuable}</strong></td></tr>
    </table>

    ${samples ? `<p style="margin:16px 0 6px;font-weight:600">A few examples</p><ul style="margin:0 0 16px;padding-left:20px">${samples}</ul>` : ""}

    <p style="margin:24px 0">
      <a href="${reviewUrl}" style="display:inline-block;background:#3a2f24;color:#faf6ef;padding:12px 22px;border-radius:6px;text-decoration:none;font-family:-apple-system,'Inter',sans-serif;font-size:14px">Review the proposals</a>
    </p>

    <p style="margin:24px 0 0;color:#8a7a68;font-size:13px;line-height:1.6;font-style:italic">
      You'll see each proposed repair with the AI's confidence and reasoning.
      Nothing touches the live records until you approve.
    </p>
  </div>
</body></html>`;
}

function escapeHtml(s: string): string {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  } as Record<string, string>)[c]);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Internal key gate — only callable by other edge functions / cron.
  const expected = Deno.env.get("INTERNAL_NOTIFY_KEY");
  const provided = req.headers.get("x-internal-key");
  if (!expected || provided !== expected) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json() as NotifyBody;
    if (!body.migration_id || !body.tenant_id || !body.integration_key || !body.reason) {
      return new Response(JSON.stringify({ error: "missing required fields" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) {
      console.error("[migration-gardener-notify] RESEND_API_KEY missing");
      return new Response(JSON.stringify({ error: "RESEND_API_KEY not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: tenant } = await supabase
      .from("tenants").select("name").eq("id", body.tenant_id).maybeSingle();
    const tenantName = tenant?.name || "a tenant";

    const baseUrl = Deno.env.get("APP_BASE_URL") || "https://thecros.app";
    const html = buildHtml(body, tenantName, baseUrl);

    const subject = `A migration paused — ${tenantName} (${body.integration_key})`;

    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "CROS Gardener <Gardener@thecros.app>",
        to: [GARDENER_EMAIL],
        subject,
        html,
      }),
    });

    const text = await resp.text();
    if (!resp.ok) {
      console.error(`[migration-gardener-notify] Resend ${resp.status}: ${text}`);
      return new Response(JSON.stringify({ error: "send failed", detail: text }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await supabase
      .from("migration_review_queue")
      .update({ notification_sent_at: new Date().toISOString() })
      .eq("migration_id", body.migration_id)
      .is("notification_sent_at", null);

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[migration-gardener-notify] error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
