/**
 * qa-run-batch — Runs all enabled QA suites sequentially with delay.
 *
 * WHAT: Creates a batch record, then dispatches the first suite.
 *       qa-run-callback chains subsequent suites as each completes.
 * WHERE: Operator Console → QA Employee → "Run All Suites" button.
 * WHY: Enables safe, sequential full-suite execution with a consolidated email report.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ── Auth ──
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const client = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await client.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }

    // ── Admin check ──
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const serviceClient = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: roles } = await serviceClient
      .from('user_roles').select('role').eq('user_id', user.id);
    const isAdmin = roles?.some(r => r.role === 'admin');

    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Admin access required' }), { status: 403, headers: corsHeaders });
    }

    // ── Cleanup stuck runs before starting a new batch ──
    const { data: stuckRuns } = await serviceClient.rpc('mark_stuck_qa_runs_failed', {
      p_threshold_minutes: 20,
    });
    if (Array.isArray(stuckRuns) && stuckRuns.length > 0) {
      console.log(`[qa-run-batch] Auto-failed ${stuckRuns.length} stuck run(s) before new batch`);
    }

    // ── Parse input ──
    const body = await req.json();
    const { tenant_id, base_url, delay_seconds = 30, credentials, suite_keys: requestedKeys } = body;

    if (!tenant_id) {
      return new Response(JSON.stringify({ error: 'tenant_id required' }), { status: 400, headers: corsHeaders });
    }

    // ── Resolve suite keys: use provided list or fall back to all enabled ──
    let suiteKeys: string[];

    if (Array.isArray(requestedKeys) && requestedKeys.length > 0) {
      // Validate that all requested keys exist and are enabled
      const { data: validSuites, error: validErr } = await serviceClient
        .from('qa_test_suites')
        .select('key')
        .eq('enabled', true)
        .in('key', requestedKeys)
        .order('key', { ascending: true });

      if (validErr || !validSuites || validSuites.length === 0) {
        return new Response(JSON.stringify({ error: 'No valid enabled suites found from provided keys' }), { status: 404, headers: corsHeaders });
      }
      suiteKeys = validSuites.map(s => s.key);
    } else {
      const { data: suites, error: suitesErr } = await serviceClient
        .from('qa_test_suites')
        .select('key')
        .eq('enabled', true)
        .order('key', { ascending: true });

      if (suitesErr || !suites || suites.length === 0) {
        return new Response(JSON.stringify({ error: 'No enabled suites found' }), { status: 404, headers: corsHeaders });
      }
      suiteKeys = suites.map(s => s.key);
    }

    // ── Create batch ──
    const { data: batch, error: batchErr } = await serviceClient
      .from('qa_batch_runs')
      .insert({
        tenant_id,
        triggered_by: user.id,
        status: 'running',
        suite_keys: suiteKeys,
        current_index: 0,
        delay_seconds: Math.max(10, Math.min(120, delay_seconds)),
      })
      .select('id')
      .single();

    if (batchErr || !batch) {
      return new Response(JSON.stringify({ error: 'Failed to create batch', detail: batchErr?.message }), {
        status: 500, headers: corsHeaders,
      });
    }

    // ── Dispatch first suite ──
    const firstSuiteKey = suiteKeys[0];
    const dispatchResult = await dispatchSuite(serviceClient, {
      supabaseUrl,
      tenant_id,
      suite_key: firstSuiteKey,
      triggered_by: user.id,
      batch_id: batch.id,
      base_url,
      credentials,
    });

    if (!dispatchResult.ok) {
      await serviceClient.from('qa_batch_runs').update({
        status: 'failed',
        completed_at: new Date().toISOString(),
        results: [{ suite_key: firstSuiteKey, error: dispatchResult.error }],
      }).eq('id', batch.id);
    }

    return new Response(JSON.stringify({
      ok: true,
      batch_id: batch.id,
      total_suites: suiteKeys.length,
      first_suite: firstSuiteKey,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// ── Dispatch a single suite (reuses qa-run-suite logic) ──
async function dispatchSuite(
  serviceClient: ReturnType<typeof createClient>,
  opts: {
    supabaseUrl: string;
    tenant_id: string;
    suite_key: string;
    triggered_by: string;
    batch_id: string;
    base_url?: string;
    credentials?: { email?: string; password?: string };
  },
): Promise<{ ok: boolean; run_id?: string; error?: string }> {
  const { supabaseUrl, tenant_id, suite_key, triggered_by, batch_id, base_url, credentials } = opts;

  // Verify suite
  const { data: suite } = await serviceClient
    .from('qa_test_suites')
    .select('key, spec_path')
    .eq('key', suite_key)
    .eq('enabled', true)
    .maybeSingle();

  if (!suite) {
    return { ok: false, error: `Suite '${suite_key}' not found or disabled` };
  }

  // Create run row with batch_id
  const { data: run, error: runError } = await serviceClient
    .from('qa_test_runs')
    .insert({
      tenant_id,
      suite_key,
      triggered_by,
      status: 'running',
      summary: { step_count: 0, passed: 0, failed: 0, spec_path: suite.spec_path || '' },
      environment: 'github_actions',
      batch_id,
    })
    .select('id')
    .single();

  if (runError || !run) {
    return { ok: false, error: runError?.message || 'Failed to create run' };
  }

  // Update batch with this run_id
  const { data: currentBatch } = await serviceClient
    .from('qa_batch_runs')
    .select('run_ids')
    .eq('id', batch_id)
    .single();

  const updatedRunIds = [...(currentBatch?.run_ids || []), run.id];
  await serviceClient.from('qa_batch_runs').update({ run_ids: updatedRunIds }).eq('id', batch_id);

  // Dispatch to GitHub Actions
  const githubPat = Deno.env.get('GITHUB_QA_PAT');
  const defaultBaseUrl = Deno.env.get('QA_DEFAULT_BASE_URL') || 'https://thecros.lovable.app';
  const effectiveBaseUrl = base_url || defaultBaseUrl;

  if (!githubPat) {
    await serviceClient.from('qa_test_runs').update({
      status: 'failed',
      completed_at: new Date().toISOString(),
      error: { message: 'GITHUB_QA_PAT not configured' },
    }).eq('id', run.id);
    return { ok: false, run_id: run.id, error: 'GITHUB_QA_PAT not configured' };
  }

  try {
    const repoOwner = Deno.env.get('GITHUB_REPO_OWNER') || 'jeromydarling';
    const repoName = Deno.env.get('GITHUB_REPO_NAME') || 'thecros';
    const dispatchUrl = `https://api.github.com/repos/${repoOwner}/${repoName}/actions/workflows/qa.yml/dispatches`;

    const dispatchResp = await fetch(dispatchUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${githubPat}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ref: 'main',
        inputs: {
          run_id: run.id,
          suite_key,
          base_url: effectiveBaseUrl,
          tenant_id,
          qa_email: credentials?.email || 'qa-demo@thecros.app',
          qa_password: credentials?.password || Deno.env.get('QA_PASSWORD') || '',
          supabase_url: supabaseUrl,
          callback_url: `${supabaseUrl}/functions/v1/qa-run-callback`,
          config_url: `${supabaseUrl}/functions/v1/qa-suite-config`,
        },
      }),
    });

    if (!dispatchResp.ok) {
      const errText = await dispatchResp.text();
      await serviceClient.from('qa_test_runs').update({
        error: { dispatch_failed: true, status: dispatchResp.status, body: errText },
      }).eq('id', run.id);
      return { ok: false, run_id: run.id, error: errText };
    }
  } catch (e) {
    await serviceClient.from('qa_test_runs').update({
      error: { dispatch_failed: true, message: String(e) },
    }).eq('id', run.id);
    return { ok: false, run_id: run.id, error: String(e) };
  }

  return { ok: true, run_id: run.id };
}

// Export for use by qa-run-callback chaining
export { dispatchSuite };
