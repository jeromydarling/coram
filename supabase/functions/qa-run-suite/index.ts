/**
 * qa-run-suite — Dispatches a QA smoke test to GitHub Actions.
 *
 * WHAT: Creates a qa_test_runs row, then triggers a GitHub Actions workflow.
 * WHERE: Operator Console → QA Employee → "Run QA" button.
 * WHY: Enables automated E2E testing via Browserbase + Playwright without
 *       needing Playwright binaries in the Edge Function runtime.
 * VERSION: 3 — tenant_id now optional for tenant-less tests (e.g. checkout E2E)
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
    // Auth
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
      console.error('[qa-run-suite] Auth failed:', userError?.message);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }
    const userId = user.id;

    // Check admin role
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const serviceClient = createClient(supabaseUrl, serviceKey);
    const { data: roleData } = await serviceClient.from('user_roles').select('role').eq('user_id', userId).eq('role', 'admin').maybeSingle();
    if (!roleData) {
      return new Response(JSON.stringify({ error: 'Admin access required' }), { status: 403, headers: corsHeaders });
    }

    // Parse input
    const body = await req.json();
    const { tenant_id, suite_key = '00_smoke_login_dashboard', base_url, credentials, spec_path } = body;

    // Verify suite exists and check if it requires a tenant
    const { data: suite } = await serviceClient.from('qa_test_suites').select('key, spec_path, requires_tenant').eq('key', suite_key).eq('enabled', true).maybeSingle();
    if (!suite) {
      return new Response(JSON.stringify({ error: `Suite '${suite_key}' not found or disabled` }), { status: 404, headers: corsHeaders });
    }

    // Only require tenant_id if the suite needs it
    const suiteRequiresTenant = suite.requires_tenant !== false; // default true
    if (suiteRequiresTenant && !tenant_id) {
      return new Response(JSON.stringify({ error: 'tenant_id required for this suite' }), { status: 400, headers: corsHeaders });
    }

    const resolvedSpecPath = spec_path || suite.spec_path || '';

    // Create run row — tenant_id is nullable
    const insertPayload: Record<string, unknown> = {
      suite_key,
      triggered_by: userId,
      status: 'running',
      summary: { step_count: 0, passed: 0, failed: 0, spec_path: resolvedSpecPath },
      environment: 'github_actions',
    };
    if (tenant_id) {
      insertPayload.tenant_id = tenant_id;
    }

    const { data: run, error: runError } = await serviceClient.from('qa_test_runs').insert(insertPayload).select('id').single();

    if (runError || !run) {
      return new Response(JSON.stringify({ error: 'Failed to create run', detail: runError?.message }), { status: 500, headers: corsHeaders });
    }

    // Dispatch GitHub Actions
    const githubPat = Deno.env.get('GITHUB_QA_PAT');
    const defaultBaseUrl = Deno.env.get('QA_DEFAULT_BASE_URL') || 'https://thecros.lovable.app';
    const effectiveBaseUrl = base_url || defaultBaseUrl;

    if (githubPat) {
      try {
        const repoOwner = Deno.env.get('GITHUB_REPO_OWNER') || 'jeromydarling';
        const repoName = Deno.env.get('GITHUB_REPO_NAME') || 'thecros';
        const dispatchUrl = `https://api.github.com/repos/${repoOwner}/${repoName}/actions/workflows/qa.yml/dispatches`;
        console.log(`[qa-run-suite] Dispatching to: ${dispatchUrl}`);
        
        const dispatchResp = await fetch(
          dispatchUrl,
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
                run_id: run.id,
                suite_key,
                base_url: effectiveBaseUrl,
                tenant_id: tenant_id || '__none__',
                qa_email: credentials?.email || 'qa-demo@thecros.app',
                qa_password: credentials?.password || Deno.env.get('QA_PASSWORD') || '',
                supabase_url: supabaseUrl,
                callback_url: `${supabaseUrl}/functions/v1/qa-run-callback`,
                config_url: `${supabaseUrl}/functions/v1/qa-suite-config`,
                qa_enable_stripe_tests: suite_key.includes('checkout') || suite_key.includes('stripe') ? '1' : '0',
              },
            }),
          }
        );

        if (!dispatchResp.ok) {
          const errText = await dispatchResp.text();
          // Update run with dispatch error but don't fail — operator can retry
          await serviceClient.from('qa_test_runs').update({
            error: { dispatch_failed: true, status: dispatchResp.status, body: errText, dispatch_url: dispatchUrl },
          }).eq('id', run.id);
        }
      } catch (dispatchErr) {
        await serviceClient.from('qa_test_runs').update({
          error: { dispatch_failed: true, message: String(dispatchErr) },
        }).eq('id', run.id);
      }
    } else {
      // No GitHub PAT — mark as failed with instructions
      await serviceClient.from('qa_test_runs').update({
        status: 'failed',
        completed_at: new Date().toISOString(),
        error: { message: 'GITHUB_QA_PAT secret not configured. Add it in project secrets.' },
      }).eq('id', run.id);
    }

    return new Response(JSON.stringify({ ok: true, run_id: run.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
