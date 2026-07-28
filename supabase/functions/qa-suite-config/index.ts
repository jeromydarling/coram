/**
 * qa-suite-config — Returns test suite configuration to the GitHub Actions runner.
 *
 * WHAT: Serves suite step definitions so the runner doesn't need SUPABASE_SERVICE_ROLE_KEY.
 * WHERE: Called by GitHub Actions runner before executing Playwright tests.
 * WHY: Eliminates the need to share service-role credentials with external systems.
 *       All privileged DB access stays inside edge functions.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-internal-key',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate via shared secret (same as qa-run-callback)
    const internalKey = req.headers.get('x-internal-key');
    const qaSecret = Deno.env.get('QA_CALLBACK_SECRET');
    const workerSecret = Deno.env.get('SEARCH_WORKER_SECRET');
    const validKeys = [qaSecret, workerSecret].filter(Boolean);

    if (!internalKey || !validKeys.some(k => k === internalKey)) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const client = createClient(supabaseUrl, serviceKey);

    const url = new URL(req.url);
    const suiteKey = url.searchParams.get('suite_key');

    if (!suiteKey) {
      return new Response(JSON.stringify({ error: 'suite_key query parameter required' }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    // Fetch suite definition
    const { data: suite, error: suiteError } = await client
      .from('qa_test_suites')
      .select('*')
      .eq('key', suiteKey)
      .eq('enabled', true)
      .maybeSingle();

    if (suiteError || !suite) {
      return new Response(JSON.stringify({ error: `Suite '${suiteKey}' not found or disabled` }), {
        status: 404,
        headers: corsHeaders,
      });
    }

    // Fetch known issues for fingerprint matching
    const { data: knownIssues } = await client
      .from('qa_known_issues')
      .select('fingerprint, title, status')
      .eq('status', 'open');

    return new Response(JSON.stringify({
      ok: true,
      suite,
      known_issues: knownIssues || [],
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
