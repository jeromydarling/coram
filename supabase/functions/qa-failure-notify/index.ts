/**
 * qa-failure-notify — Sends QA failure repair pack emails via Resend.
 *
 * WHAT: Generates a full repair pack from failed QA run data and emails it.
 * WHERE: Called internally by qa-run-callback when a run fails.
 * WHY: Enables operators to receive paste-ready Lovable fix prompts without
 *       opening the Operator Console.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-internal-key',
};

// ── Email HTML builder ──────────────────────────────────────
function buildEmailHtml(
  suiteKey: string,
  runId: string,
  summary: Record<string, unknown>,
  failedSteps: Array<Record<string, unknown>>,
  allSteps: Array<Record<string, unknown>>,
  promptText: string,
  baseUrl: string,
): string {
  const passedCount = allSteps.filter((s: any) => s.status === 'passed').length;
  const failedCount = failedSteps.length;
  const totalCount = allSteps.length;

  const stepsHtml = allSteps.map((s: any) => {
    const icon = s.status === 'passed' ? '✅' : s.status === 'failed' ? '❌' : '⏭️';
    const bg = s.status === 'failed' ? '#fef2f2' : s.status === 'passed' ? '#f0fdf4' : '#fafafa';
    return `<tr style="background:${bg}">
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb">${icon} ${s.label || s.step_key}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;color:#6b7280;font-size:13px">${s.url || '—'}</td>
    </tr>`;
  }).join('');

  const failureDetails = failedSteps.map((s: any) => {
    const consoleErrors = (s.console_errors || []).slice(0, 5).map((e: string) =>
      `<li style="font-size:12px;color:#991b1b;margin-bottom:4px"><code>${escapeHtml(String(e).slice(0, 200))}</code></li>`
    ).join('');
    const networkErrors = (s.network_failures || []).slice(0, 5).map((e: string) =>
      `<li style="font-size:12px;color:#92400e;margin-bottom:4px"><code>${escapeHtml(String(e).slice(0, 200))}</code></li>`
    ).join('');

    return `
    <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px;margin-bottom:12px">
      <h4 style="margin:0 0 8px;color:#991b1b">❌ ${escapeHtml(s.label || s.step_key)}</h4>
      <p style="margin:4px 0;font-size:13px;color:#6b7280">URL: ${escapeHtml(s.url || 'unknown')}</p>
      ${s.notes ? `<p style="margin:4px 0;font-size:13px"><strong>Notes:</strong> ${escapeHtml(String(s.notes).slice(0, 300))}</p>` : ''}
      ${consoleErrors ? `<p style="margin:8px 0 4px;font-size:12px;font-weight:600">Console Errors:</p><ul style="margin:0;padding-left:20px">${consoleErrors}</ul>` : ''}
      ${networkErrors ? `<p style="margin:8px 0 4px;font-size:12px;font-weight:600">Network Failures:</p><ul style="margin:0;padding-left:20px">${networkErrors}</ul>` : ''}
    </div>`;
  }).join('');

  const operatorUrl = `${baseUrl}/operator/qa`;

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<div style="max-width:640px;margin:0 auto;padding:24px">

  <!-- Header -->
  <div style="background:linear-gradient(135deg,#1e293b,#334155);border-radius:12px 12px 0 0;padding:24px 32px;color:#fff">
    <h1 style="margin:0;font-size:20px;font-weight:600">CROS™ QA Alert</h1>
    <p style="margin:8px 0 0;opacity:0.8;font-size:14px">Suite <code style="background:rgba(255,255,255,0.15);padding:2px 6px;border-radius:4px">${escapeHtml(suiteKey)}</code> needs attention</p>
  </div>

  <!-- Summary -->
  <div style="background:#fff;padding:24px 32px;border-left:1px solid #e5e7eb;border-right:1px solid #e5e7eb">
    <div style="display:flex;gap:16px;margin-bottom:20px">
      <div style="flex:1;text-align:center;padding:12px;background:#f0fdf4;border-radius:8px">
        <div style="font-size:24px;font-weight:700;color:#15803d">${passedCount}</div>
        <div style="font-size:12px;color:#6b7280">passed</div>
      </div>
      <div style="flex:1;text-align:center;padding:12px;background:#fef2f2;border-radius:8px">
        <div style="font-size:24px;font-weight:700;color:#dc2626">${failedCount}</div>
        <div style="font-size:12px;color:#6b7280">failed</div>
      </div>
      <div style="flex:1;text-align:center;padding:12px;background:#f8fafc;border-radius:8px">
        <div style="font-size:24px;font-weight:700;color:#475569">${totalCount}</div>
        <div style="font-size:12px;color:#6b7280">total</div>
      </div>
    </div>

    <!-- Steps table -->
    <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:20px">
      <thead><tr style="background:#f1f5f9">
        <th style="padding:8px 12px;text-align:left;font-weight:600;border-bottom:2px solid #e2e8f0">Step</th>
        <th style="padding:8px 12px;text-align:left;font-weight:600;border-bottom:2px solid #e2e8f0">URL</th>
      </tr></thead>
      <tbody>${stepsHtml}</tbody>
    </table>

    <!-- Failure details -->
    <h3 style="margin:24px 0 12px;font-size:16px;color:#1e293b">Failure Details</h3>
    ${failureDetails}

    <!-- Repair prompt -->
    <h3 style="margin:24px 0 12px;font-size:16px;color:#1e293b">📋 Repair Prompt — Copy & Paste into Lovable</h3>
    <div style="background:#f8fafc;border:1px solid #cbd5e1;border-radius:8px;padding:16px;overflow-x:auto">
      <pre style="margin:0;font-size:12px;line-height:1.5;white-space:pre-wrap;word-break:break-word;font-family:'SF Mono',Monaco,Consolas,monospace">${escapeHtml(promptText)}</pre>
    </div>
  </div>

  <!-- Footer -->
  <div style="background:#f1f5f9;border-radius:0 0 12px 12px;padding:16px 32px;text-align:center;border:1px solid #e5e7eb;border-top:0">
    <a href="${operatorUrl}" style="display:inline-block;padding:10px 24px;background:#1e293b;color:#fff;text-decoration:none;border-radius:6px;font-size:14px;font-weight:500">View in Operator Console</a>
    <p style="margin:12px 0 0;font-size:11px;color:#94a3b8">Run ID: ${escapeHtml(runId)}</p>
  </div>

</div>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Main handler ─────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth: internal key only
    const internalKey = req.headers.get('x-internal-key');
    const qaSecret = Deno.env.get('QA_CALLBACK_SECRET');
    const workerSecret = Deno.env.get('SEARCH_WORKER_SECRET');
    const validKeys = [qaSecret, workerSecret].filter(Boolean);
    if (!internalKey || !validKeys.some(k => k === internalKey)) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }

    const resendKey = Deno.env.get('RESEND_API_KEY');
    if (!resendKey) {
      console.error('[qa-failure-notify] RESEND_API_KEY not configured');
      return new Response(JSON.stringify({ error: 'RESEND_API_KEY not configured' }), {
        status: 500, headers: corsHeaders,
      });
    }

    const body = await req.json();
    const { run_id, suite_key, triggered_by, steps, prompt_text, summary } = body;

    if (!run_id || !suite_key || !triggered_by) {
      return new Response(JSON.stringify({ error: 'run_id, suite_key, triggered_by required' }), {
        status: 400, headers: corsHeaders,
      });
    }

    // Look up triggering admin's email
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const client = createClient(supabaseUrl, serviceKey);

    const { data: userData } = await client.auth.admin.getUserById(triggered_by);
    const recipientEmail = userData?.user?.email;

    if (!recipientEmail) {
      console.error(`[qa-failure-notify] No email for user ${triggered_by}`);
      return new Response(JSON.stringify({ error: 'Triggering user has no email' }), {
        status: 400, headers: corsHeaders,
      });
    }

    const allSteps = Array.isArray(steps) ? steps : [];
    const failedSteps = allSteps.filter((s: any) => s.status === 'failed');
    const baseUrl = Deno.env.get('QA_DEFAULT_BASE_URL') || 'https://thecros.lovable.app';

    const emailHtml = buildEmailHtml(
      suite_key,
      run_id,
      summary || {},
      failedSteps,
      allSteps,
      prompt_text || '(No repair prompt generated)',
      baseUrl,
    );

    const failedCount = failedSteps.length;
    const subject = `🔧 QA Failed: ${suite_key} — ${failedCount} step${failedCount !== 1 ? 's' : ''} need attention`;

    // Send via Resend
    const resendResp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'CROS QA <qa@thecros.app>',
        to: [recipientEmail],
        subject,
        html: emailHtml,
      }),
    });

    const resendBody = await resendResp.text();

    if (!resendResp.ok) {
      console.error(`[qa-failure-notify] Resend error ${resendResp.status}: ${resendBody}`);
      return new Response(JSON.stringify({ error: 'Email send failed', detail: resendBody }), {
        status: 500, headers: corsHeaders,
      });
    }

    console.log(`[qa-failure-notify] Email sent to ${recipientEmail} for run ${run_id}`);

    return new Response(JSON.stringify({ ok: true, sent_to: recipientEmail }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[qa-failure-notify] Error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
