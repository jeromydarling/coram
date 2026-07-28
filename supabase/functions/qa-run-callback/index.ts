/**
 * qa-run-callback — Receives QA test results from GitHub Actions runner.
 *
 * WHAT: Updates qa_test_runs, inserts steps, auto-generates failure records + fix prompts.
 * WHERE: Called by GitHub Actions workflow after Playwright execution completes.
 * WHY: Separates browser execution (GitHub) from data storage (Supabase) and enables
 *       self-healing prompts visible in Operator Console.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-internal-key',
};

// ── Redaction helpers ────────────────────────────────────────
const REDACT_PATTERNS: Array<{ pattern: RegExp; label: string; replacement: string }> = [
  { pattern: /Bearer\s+[A-Za-z0-9\-_.~+/]+=*/g, label: 'auth_token', replacement: 'Bearer [REDACTED]' },
  { pattern: /eyJ[A-Za-z0-9\-_]+\.eyJ[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_.+/=]*/g, label: 'jwt', replacement: '[JWT_REDACTED]' },
  { pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, label: 'email', replacement: '[EMAIL_REDACTED]' },
  { pattern: /cookie:\s*[^\n]+/gi, label: 'cookie', replacement: 'cookie: [REDACTED]' },
  { pattern: /password['":\s]*[^\s,}'"]+/gi, label: 'password', replacement: 'password: [REDACTED]' },
];

function redactStr(text: string): { cleaned: string; labels: string[] } {
  const found: string[] = [];
  let cleaned = text;
  for (const { pattern, label, replacement } of REDACT_PATTERNS) {
    if (pattern.test(cleaned)) {
      found.push(label);
      cleaned = cleaned.replace(pattern, replacement);
    }
  }
  return { cleaned, labels: found };
}

// ── Failure classification ───────────────────────────────────
function classifyFailure(allText: string): string {
  const t = allText.toLowerCase();
  if (t.includes('timeout') || t.includes('waiting for') || t.includes('locator')) return 'timeout';
  if (t.includes('401') || t.includes('403') || t.includes('unauthorized')) return 'auth';
  if (t.includes('500') || t.includes('internal server')) return 'server_error';
  if (t.includes('404') || t.includes('not found')) return 'network';
  if (t.includes('assert') || t.includes('expect')) return 'assertion';
  if (t.includes('cannot read') || t.includes('undefined')) return 'ui_mismatch';
  return 'unknown';
}

// ── File suggestions ─────────────────────────────────────────
const ROUTE_MAP: Record<string, string[]> = {
  '/login': ['src/pages/LoginPage.tsx'],
  '/dashboard': ['src/pages/DashboardPage.tsx'],
  '/opportunities': ['src/pages/OpportunitiesPage.tsx'],
  '/events': ['src/pages/EventsPage.tsx'],
  '/provisions': ['src/pages/ProvisionsPage.tsx'],
  '/operator': ['src/pages/operator/'],
  '/settings': ['src/pages/SettingsPage.tsx'],
};

function suggestFiles(url: string | null, failType: string): string[] {
  const files = new Set<string>();
  if (url) {
    try {
      const p = new URL(url).pathname;
      for (const [route, rf] of Object.entries(ROUTE_MAP)) {
        if (p.includes(route)) rf.forEach(f => files.add(f));
      }
    } catch { /* ignore */ }
  }
  if (failType === 'auth') files.add('src/contexts/AuthContext.tsx');
  if (failType === 'server_error' || failType === 'network') files.add('supabase/functions/');
  return Array.from(files).slice(0, 8);
}

// ── Root cause hypotheses ────────────────────────────────────
const HYPOTHESES: Record<string, string[]> = {
  timeout: ['Element selector changed or component not rendering', 'Data query slow or empty', 'Loading state blocks visibility'],
  auth: ['QA user credentials expired', 'Auth redirect loop', 'RLS policy rejects QA role'],
  server_error: ['Edge function unhandled exception', 'Schema changed but code stale', 'CORS headers missing'],
  network: ['Route missing in AppRouter.tsx', 'Edge function not deployed', 'API endpoint returns 404'],
  assertion: ['UI text/structure changed', 'Feature flag disabled', 'Seed data incomplete'],
  ui_mismatch: ['Undefined prop or missing context', 'Null data before load', 'Import path changed'],
  unknown: ['Review console errors and screenshots', 'Check recent deployments'],
};

// ── Fix prompt builder ───────────────────────────────────────
function buildFixPrompt(
  runId: string, suiteKey: string, failType: string,
  failedSteps: Array<Record<string, unknown>>,
  allSteps: Array<Record<string, unknown>>,
): { title: string; prompt_text: string; hypotheses: string[]; files: string[]; redactions: string[] } {
  const lastFailed = failedSteps[failedSteps.length - 1] || {};
  const allRedactions: string[] = [];

  const timeline = allSteps.map((s: any) => {
    const icon = s.status === 'passed' ? '✅' : s.status === 'failed' ? '❌' : '⏭️';
    return `${icon} ${s.label || s.step_key} — ${s.url || 'no URL'}`;
  }).join('\n');

  const consoleLines = failedSteps.flatMap((s: any) =>
    (s.console_errors || []).map(String)
  ).slice(0, 10).map(e => {
    const r = redactStr(e);
    allRedactions.push(...r.labels);
    return `- ${r.cleaned}`;
  }).join('\n');

  const networkLines = failedSteps.flatMap((s: any) =>
    (s.network_failures || []).map(String)
  ).slice(0, 10).map(e => {
    const r = redactStr(e);
    allRedactions.push(...r.labels);
    return `- ${r.cleaned}`;
  }).join('\n');

  const hypotheses = (HYPOTHESES[failType] || HYPOTHESES.unknown).slice(0, 5);
  const files = suggestFiles(lastFailed.url as string | null, failType);

  const { cleaned: cleanedNotes } = redactStr(String(lastFailed.notes || ''));
  const title = `QA FIX: ${suiteKey} — ${lastFailed.label || 'unknown'} (${failType})`;

  const prompt_text = `# ${title}

## Context
QA suite \`${suiteKey}\` failed during step **"${lastFailed.label || 'unknown'}"** (${lastFailed.step_key || '?'}).
Run ID: \`${runId}\`
Failure type: **${failType}**

## Steps Timeline
${timeline}

## Evidence

### Last Failing Step
- **Step:** ${lastFailed.label || 'unknown'} (${lastFailed.step_key || '?'})
- **URL:** ${lastFailed.url || 'unknown'}
- **Error:** ${cleanedNotes || '(no details)'}

${consoleLines ? `### Console Errors\n${consoleLines}` : ''}
${networkLines ? `### Network Failures\n${networkLines}` : ''}

## Root Cause Hypotheses
${hypotheses.map((h, i) => `${i + 1}. ${h}`).join('\n')}

## Likely Files
${files.map(f => `- \`${f}\``).join('\n')}

## Required Fixes
1. Fix root cause so step "${lastFailed.label || 'unknown'}" passes
2. No regressions in other QA steps
3. Add \`data-testid\` if selectors were unstable
4. Mobile-first: verify at 320px

## Done When
- [ ] Suite \`${suiteKey}\` passes end-to-end
- [ ] No console errors on failing page
- [ ] No RLS regressions
`;

  return { title, prompt_text, hypotheses, files, redactions: [...new Set(allRedactions)] };
}

// ── Fingerprint for known issue matching ─────────────────────
function computeFingerprint(failType: string, message: string, url: string | null): string {
  const normalized = [
    failType,
    (message || '').replace(/[0-9a-f-]{36}/g, 'UUID').replace(/\d+/g, 'N').slice(0, 200),
    url ? new URL(url).pathname : '',
  ].join('|');
  // Simple hash
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    hash = ((hash << 5) - hash + normalized.charCodeAt(i)) | 0;
  }
  return `qaf_${Math.abs(hash).toString(36)}`;
}

// ── Main handler ─────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const internalKey = req.headers.get('x-internal-key');
    const qaSecret = Deno.env.get('QA_CALLBACK_SECRET');
    const workerSecret = Deno.env.get('SEARCH_WORKER_SECRET');
    const validKeys = [qaSecret, workerSecret].filter(Boolean);
    if (!internalKey || !validKeys.some(k => k === internalKey)) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const client = createClient(supabaseUrl, serviceKey);

    const body = await req.json();

    // ── Screenshot upload action ──
    if (body.action === 'upload_screenshot') {
      const { run_id: ssRunId, step_key, screenshot_base64 } = body;
      if (!ssRunId || !step_key || !screenshot_base64) {
        return new Response(JSON.stringify({ error: 'run_id, step_key, screenshot_base64 required' }), {
          status: 400, headers: corsHeaders,
        });
      }
      const buffer = Uint8Array.from(atob(screenshot_base64), c => c.charCodeAt(0));
      const storagePath = `${ssRunId}/${step_key}.png`;
      const { error: uploadErr } = await client.storage
        .from('qa_screenshots')
        .upload(storagePath, buffer, { contentType: 'image/png', upsert: true });
      if (uploadErr) {
        return new Response(JSON.stringify({ error: uploadErr.message }), {
          status: 500, headers: corsHeaders,
        });
      }
      return new Response(JSON.stringify({ ok: true, path: storagePath }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { run_id, status, summary, steps, browserbase_session_id, error: runError, github_run_id } = body;

    if (!run_id) {
      return new Response(JSON.stringify({ error: 'run_id required' }), { status: 400, headers: corsHeaders });
    }

    // Verify run exists
    const { data: existingRun } = await client.from('qa_test_runs').select('id, suite_key, triggered_by, batch_id').eq('id', run_id).maybeSingle();
    if (!existingRun) {
      return new Response(JSON.stringify({ error: 'Run not found' }), { status: 404, headers: corsHeaders });
    }

    // Update run
    const runUpdate: Record<string, unknown> = {
      status: status || 'failed',
      completed_at: new Date().toISOString(),
    };
    if (summary) runUpdate.summary = summary;
    if (browserbase_session_id) runUpdate.browserbase_session_id = browserbase_session_id;
    if (runError) runUpdate.error = runError;
    if (github_run_id) runUpdate.github_run_id = github_run_id;

    await client.from('qa_test_runs').update(runUpdate).eq('id', run_id);

    // Insert steps
    if (Array.isArray(steps) && steps.length > 0) {
      const stepRows = steps.map((s: Record<string, unknown>, i: number) => ({
        run_id,
        step_index: s.step_index ?? i,
        step_key: s.step_key || `step_${i}`,
        label: s.label || `Step ${i}`,
        status: s.status || 'skipped',
        started_at: s.started_at || null,
        completed_at: s.completed_at || null,
        url: s.url || null,
        screenshot_path: s.screenshot_path || null,
        console_errors: s.console_errors || [],
        page_errors: s.page_errors || [],
        network_failures: s.network_failures || [],
        notes: s.notes || null,
      }));

      const { error: stepsError } = await client.from('qa_test_run_steps').insert(stepRows);
      if (stepsError) console.error('Failed to insert steps:', stepsError);
    }

    // ── Self-healing: auto-generate failure record + fix prompt ──
    const effectiveStatus = status || 'failed';
    if (effectiveStatus === 'failed' || effectiveStatus === 'partial') {
      const failedSteps = (steps || []).filter((s: Record<string, unknown>) => s.status === 'failed');

      if (failedSteps.length > 0) {
        // Collect all error text for classification
        const allErrorText = failedSteps.flatMap((s: any) => [
          ...(s.console_errors || []).map(String),
          ...(s.page_errors || []).map(String),
          ...(s.network_failures || []).map(String),
          s.notes || '',
        ]).join(' ');

        const failType = classifyFailure(allErrorText);
        const lastFailed = failedSteps[failedSteps.length - 1] as Record<string, unknown>;
        const { cleaned: primaryMsg } = redactStr(String(lastFailed.notes || allErrorText.slice(0, 500)));

        // Insert qa_run_failures
        const artifactRefs = failedSteps
          .filter((s: any) => s.screenshot_path)
          .map((s: any) => ({ bucket: 'qa_screenshots', path: s.screenshot_path, kind: 'screenshot' }));

        await client.from('qa_run_failures').insert({
          run_id,
          suite_key: existingRun.suite_key,
          failure_type: failType,
          primary_message: primaryMsg.slice(0, 2000),
          stack_trace: String(lastFailed.notes || '').slice(0, 5000) || null,
          console_errors: failedSteps.flatMap((s: any) => (s.console_errors || []).slice(0, 20)),
          network_errors: failedSteps.flatMap((s: any) => (s.network_failures || []).slice(0, 20)),
          last_step: {
            name: lastFailed.label,
            url: lastFailed.url,
            step_key: lastFailed.step_key,
          },
          artifact_refs: artifactRefs,
        });

        // Generate fix prompt
        const prompt = buildFixPrompt(run_id, existingRun.suite_key, failType, failedSteps, steps || []);

        await client.from('qa_fix_prompts').insert({
          run_id,
          suite_key: existingRun.suite_key,
          title: prompt.title,
          prompt_text: prompt.prompt_text,
          root_cause_hypotheses: prompt.hypotheses,
          suggested_files: prompt.files,
          redactions: prompt.redactions,
          created_by: existingRun.triggered_by,
        });

        // Check known issues
        const fingerprint = computeFingerprint(failType, primaryMsg, lastFailed.url as string | null);
        const { data: knownIssue } = await client.from('qa_known_issues')
          .select('id, title')
          .eq('fingerprint', fingerprint)
          .maybeSingle();

        // Return known issue info if matched
        if (knownIssue) {
          console.log(`Known issue matched: ${knownIssue.title} (${fingerprint})`);
        }

        // ── Email notification (fire-and-forget) — skip if part of batch ──
        if (!existingRun.batch_id) {
          try {
            const notifyUrl = `${supabaseUrl}/functions/v1/qa-failure-notify`;
            const notifyKey = Deno.env.get('QA_CALLBACK_SECRET') || '';
            fetch(notifyUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-internal-key': notifyKey,
              },
              body: JSON.stringify({
                run_id,
                suite_key: existingRun.suite_key,
                triggered_by: existingRun.triggered_by,
                steps: steps || [],
                prompt_text: prompt.prompt_text,
                summary: summary || {},
              }),
            }).catch(e => console.error('[qa-run-callback] notify fire-and-forget error:', e));
          } catch (notifyErr) {
            console.error('[qa-run-callback] Failed to dispatch email notification:', notifyErr);
          }
        }
      }
    }

    // ── Batch chaining ──────────────────────────────────────────
    if (existingRun.batch_id) {
      try {
        await handleBatchChain(client, supabaseUrl, existingRun.batch_id, run_id, existingRun.suite_key, effectiveStatus, summary, steps);
      } catch (batchErr) {
        console.error('[qa-run-callback] Batch chain error:', batchErr);
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// ── Batch chain handler ──────────────────────────────────────
async function handleBatchChain(
  client: ReturnType<typeof createClient>,
  supabaseUrl: string,
  batchId: string,
  runId: string,
  suiteKey: string,
  status: string,
  summary: Record<string, unknown> | null,
  steps: Array<Record<string, unknown>> | null,
) {
  // Fetch batch
  const { data: batch } = await client.from('qa_batch_runs')
    .select('*')
    .eq('id', batchId)
    .single();

  if (!batch || batch.status === 'completed' || batch.status === 'failed') return;

  // Record this suite's result
  const failedSteps = (steps || []).filter((s: any) => s.status === 'failed');
  const passedSteps = (steps || []).filter((s: any) => s.status === 'passed');
  const totalSteps = (steps || []).length;

  const result = {
    suite_key: suiteKey,
    run_id: runId,
    status,
    passed: passedSteps.length,
    failed: failedSteps.length,
    total: totalSteps,
    summary: summary || {},
  };

  const updatedResults = [...(batch.results as any[] || []), result];
  const nextIndex = batch.current_index + 1;

  if (nextIndex < batch.suite_keys.length) {
    // ── More suites to run → dispatch next after delay ──
    await client.from('qa_batch_runs').update({
      current_index: nextIndex,
      results: updatedResults,
    }).eq('id', batchId);

    // Delay before dispatching next suite
    const delaySec = Math.min(batch.delay_seconds || 30, 120);
    await new Promise(resolve => setTimeout(resolve, delaySec * 1000));

    const nextSuiteKey = batch.suite_keys[nextIndex];
    console.log(`[qa-batch] Dispatching suite ${nextIndex + 1}/${batch.suite_keys.length}: ${nextSuiteKey}`);

    // Dispatch next suite
    const { data: nextSuite } = await client
      .from('qa_test_suites')
      .select('key, spec_path')
      .eq('key', nextSuiteKey)
      .eq('enabled', true)
      .maybeSingle();

    if (!nextSuite) {
      // Skip disabled suite, chain to next
      const skipResult = { suite_key: nextSuiteKey, run_id: null, status: 'skipped', passed: 0, failed: 0, total: 0, summary: {} };
      const skipResults = [...updatedResults, skipResult];
      await client.from('qa_batch_runs').update({ current_index: nextIndex + 1, results: skipResults }).eq('id', batchId);
      // Recurse to check if there's another suite
      if (nextIndex + 1 >= batch.suite_keys.length) {
        await completeBatch(client, supabaseUrl, batchId, skipResults, batch);
      }
      return;
    }

    // Create run row
    const { data: nextRun } = await client.from('qa_test_runs').insert({
      tenant_id: batch.tenant_id,
      suite_key: nextSuiteKey,
      triggered_by: batch.triggered_by,
      status: 'running',
      summary: { step_count: 0, passed: 0, failed: 0, spec_path: nextSuite.spec_path || '' },
      environment: 'github_actions',
      batch_id: batchId,
    }).select('id').single();

    if (!nextRun) {
      console.error(`[qa-batch] Failed to create run for suite ${nextSuiteKey}`);
      return;
    }

    // Update batch run_ids
    const updatedRunIds = [...(batch.run_ids || []), nextRun.id];
    await client.from('qa_batch_runs').update({ run_ids: updatedRunIds }).eq('id', batchId);

    // Dispatch GitHub Actions
    const githubPat = Deno.env.get('GITHUB_QA_PAT');
    if (!githubPat) {
      console.error('[qa-batch] GITHUB_QA_PAT missing');
      return;
    }

    const repoOwner = Deno.env.get('GITHUB_REPO_OWNER') || 'cros-platform';
    const repoName = Deno.env.get('GITHUB_REPO_NAME') || 'cros';
    const defaultBaseUrl = Deno.env.get('QA_DEFAULT_BASE_URL') || 'https://thecros.lovable.app';

    const dispatchResp = await fetch(
      `https://api.github.com/repos/${repoOwner}/${repoName}/actions/workflows/qa.yml/dispatches`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${githubPat}`,
          Accept: 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ref: 'main',
          inputs: {
            run_id: nextRun.id,
            suite_key: nextSuiteKey,
            base_url: defaultBaseUrl,
            tenant_id: batch.tenant_id,
            qa_email: 'qa-demo@thecros.app',
            qa_password: Deno.env.get('QA_PASSWORD') || '',
            supabase_url: supabaseUrl,
            callback_url: `${supabaseUrl}/functions/v1/qa-run-callback`,
            config_url: `${supabaseUrl}/functions/v1/qa-suite-config`,
          },
        }),
      },
    );

    if (!dispatchResp.ok) {
      const errText = await dispatchResp.text();
      console.error(`[qa-batch] Dispatch failed for ${nextSuiteKey}:`, errText);
    }
  } else {
    // ── All suites done → complete batch and send summary email ──
    await completeBatch(client, supabaseUrl, batchId, updatedResults, batch);
  }
}

// ── Complete batch and send summary email ────────────────────
async function completeBatch(
  client: ReturnType<typeof createClient>,
  supabaseUrl: string,
  batchId: string,
  results: any[],
  batch: any,
) {
  await client.from('qa_batch_runs').update({
    status: 'completed',
    completed_at: new Date().toISOString(),
    results,
  }).eq('id', batchId);

  // Build summary email
  const totalSuites = results.length;
  const passedSuites = results.filter(r => r.status === 'passed' || r.status === 'completed').length;
  const failedSuites = results.filter(r => r.status === 'failed' || r.status === 'partial').length;
  const skippedSuites = results.filter(r => r.status === 'skipped').length;

  const totalSteps = results.reduce((acc: number, r: any) => acc + (r.total || 0), 0);
  const totalPassed = results.reduce((acc: number, r: any) => acc + (r.passed || 0), 0);
  const totalFailed = results.reduce((acc: number, r: any) => acc + (r.failed || 0), 0);

  // Fetch fix prompts for failed suites
  const failedRunIds = results.filter((r: any) => r.status === 'failed' || r.status === 'partial').map((r: any) => r.run_id).filter(Boolean);
  let promptsHtml = '';
  if (failedRunIds.length > 0) {
    const { data: prompts } = await client.from('qa_fix_prompts')
      .select('suite_key, title, prompt_text')
      .in('run_id', failedRunIds)
      .order('created_at', { ascending: true });

    if (prompts && prompts.length > 0) {
      promptsHtml = prompts.map((p: any) => `
        <div style="margin-bottom:24px">
          <h4 style="margin:0 0 8px;color:#991b1b">🔧 ${escapeHtml(p.title)}</h4>
          <div style="background:#f8fafc;border:1px solid #cbd5e1;border-radius:8px;padding:16px;overflow-x:auto">
            <pre style="margin:0;font-size:11px;line-height:1.5;white-space:pre-wrap;word-break:break-word;font-family:'SF Mono',Monaco,Consolas,monospace">${escapeHtml(p.prompt_text)}</pre>
          </div>
        </div>
      `).join('');
    }
  }

  const suiteRowsHtml = results.map((r: any) => {
    const icon = r.status === 'passed' || r.status === 'completed' ? '✅' : r.status === 'failed' || r.status === 'partial' ? '❌' : '⏭️';
    const bg = (r.status === 'failed' || r.status === 'partial') ? '#fef2f2' : (r.status === 'passed' || r.status === 'completed') ? '#f0fdf4' : '#fafafa';
    return `<tr style="background:${bg}">
      <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;font-weight:500">${icon} ${escapeHtml(r.suite_key)}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;text-align:center;color:#15803d">${r.passed}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;text-align:center;color:#dc2626">${r.failed}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;text-align:center;color:#6b7280">${r.total}</td>
    </tr>`;
  }).join('');

  const overallStatus = failedSuites === 0 ? '✅ All Suites Passed' : `⚠️ ${failedSuites} Suite${failedSuites > 1 ? 's' : ''} Need Attention`;
  const baseUrl = Deno.env.get('QA_DEFAULT_BASE_URL') || 'https://thecros.lovable.app';

  const emailHtml = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<div style="max-width:680px;margin:0 auto;padding:24px">

  <div style="background:linear-gradient(135deg,#1e293b,#334155);border-radius:12px 12px 0 0;padding:28px 32px;color:#fff">
    <h1 style="margin:0;font-size:22px;font-weight:600">CROS™ QA Batch Report</h1>
    <p style="margin:8px 0 0;opacity:0.8;font-size:14px">${overallStatus}</p>
  </div>

  <div style="background:#fff;padding:28px 32px;border-left:1px solid #e5e7eb;border-right:1px solid #e5e7eb">

    <!-- Overview stats -->
    <div style="display:flex;gap:12px;margin-bottom:24px;flex-wrap:wrap">
      <div style="flex:1;min-width:100px;text-align:center;padding:14px;background:#f0fdf4;border-radius:8px">
        <div style="font-size:28px;font-weight:700;color:#15803d">${passedSuites}</div>
        <div style="font-size:11px;color:#6b7280;margin-top:2px">suites passed</div>
      </div>
      <div style="flex:1;min-width:100px;text-align:center;padding:14px;background:${failedSuites > 0 ? '#fef2f2' : '#f8fafc'};border-radius:8px">
        <div style="font-size:28px;font-weight:700;color:${failedSuites > 0 ? '#dc2626' : '#6b7280'}">${failedSuites}</div>
        <div style="font-size:11px;color:#6b7280;margin-top:2px">suites failed</div>
      </div>
      <div style="flex:1;min-width:100px;text-align:center;padding:14px;background:#f8fafc;border-radius:8px">
        <div style="font-size:28px;font-weight:700;color:#475569">${totalPassed}/${totalSteps}</div>
        <div style="font-size:11px;color:#6b7280;margin-top:2px">steps passed</div>
      </div>
    </div>

    <!-- Suite breakdown -->
    <h3 style="margin:0 0 12px;font-size:16px;color:#1e293b">Suite Results</h3>
    <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:24px">
      <thead><tr style="background:#f1f5f9">
        <th style="padding:10px 14px;text-align:left;font-weight:600;border-bottom:2px solid #e2e8f0">Suite</th>
        <th style="padding:10px 14px;text-align:center;font-weight:600;border-bottom:2px solid #e2e8f0">Passed</th>
        <th style="padding:10px 14px;text-align:center;font-weight:600;border-bottom:2px solid #e2e8f0">Failed</th>
        <th style="padding:10px 14px;text-align:center;font-weight:600;border-bottom:2px solid #e2e8f0">Total</th>
      </tr></thead>
      <tbody>${suiteRowsHtml}</tbody>
    </table>

    ${promptsHtml ? `
    <h3 style="margin:24px 0 12px;font-size:16px;color:#1e293b">📋 Repair Prompts — Copy & Paste into Lovable</h3>
    ${promptsHtml}
    ` : ''}

  </div>

  <div style="background:#f1f5f9;border-radius:0 0 12px 12px;padding:16px 32px;text-align:center;border:1px solid #e5e7eb;border-top:0">
    <a href="${baseUrl}/operator/qa" style="display:inline-block;padding:10px 24px;background:#1e293b;color:#fff;text-decoration:none;border-radius:6px;font-size:14px;font-weight:500">View in Operator Console</a>
    <p style="margin:12px 0 0;font-size:11px;color:#94a3b8">Batch ID: ${batchId} · ${totalSuites} suites · ${totalSteps} steps</p>
  </div>

</div>
</body>
</html>`;

  // Send via Resend
  const resendKey = Deno.env.get('RESEND_API_KEY');
  if (!resendKey) {
    console.error('[qa-batch] RESEND_API_KEY not configured, skipping email');
    return;
  }

  // Look up recipient
  const { data: userData } = await client.auth.admin.getUserById(batch.triggered_by);
  const recipientEmail = userData?.user?.email;
  if (!recipientEmail) {
    console.error(`[qa-batch] No email for user ${batch.triggered_by}`);
    return;
  }

  const subject = failedSuites > 0
    ? `⚠️ QA Batch: ${failedSuites}/${totalSuites} suites failed — ${totalFailed} steps need attention`
    : `✅ QA Batch: All ${totalSuites} suites passed (${totalPassed} steps)`;

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
    console.error(`[qa-batch] Resend error: ${resendResp.status} ${resendBody}`);
  } else {
    console.log(`[qa-batch] Summary email sent to ${recipientEmail}`);
  }
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
