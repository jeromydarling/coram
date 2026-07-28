/**
 * qa-watchdog — Auto-fails stuck QA runs that never received a callback.
 *
 * WHAT: Calls mark_stuck_qa_runs_failed() to timeout hanging test runs.
 * WHERE: Called on a schedule (e.g., every 10 minutes) or manually.
 * WHY: Prevents QA runs from staying in "running" state forever when
 *       GitHub Actions dispatch fails silently or the callback never arrives.
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
    // Auth: accept either internal key or admin bearer token
    const internalKey = req.headers.get('x-internal-key');
    const qaSecret = Deno.env.get('QA_CALLBACK_SECRET');
    const workerSecret = Deno.env.get('SEARCH_WORKER_SECRET');
    const validKeys = [qaSecret, workerSecret].filter(Boolean);

    let authorized = internalKey && validKeys.some(k => k === internalKey);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const serviceClient = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    if (!authorized) {
      // Fall back to bearer token admin check
      const authHeader = req.headers.get('Authorization');
      if (authHeader?.startsWith('Bearer ')) {
        const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
        const userClient = createClient(supabaseUrl, anonKey, {
          global: { headers: { Authorization: authHeader } },
        });
        const { data: { user } } = await userClient.auth.getUser();
        if (user) {
          const { data: roles } = await serviceClient
            .from('user_roles').select('role').eq('user_id', user.id);
          authorized = roles?.some(r => r.role === 'admin') || false;
        }
      }
    }

    if (!authorized) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    // Parse optional threshold (default 20 minutes)
    let thresholdMinutes = 20;
    try {
      const body = await req.json();
      if (body?.threshold_minutes && typeof body.threshold_minutes === 'number') {
        thresholdMinutes = Math.max(5, Math.min(120, body.threshold_minutes));
      }
    } catch {
      // No body or invalid JSON — use default
    }

    // Call the DB function
    const { data: stuckRuns, error } = await serviceClient.rpc('mark_stuck_qa_runs_failed', {
      p_threshold_minutes: thresholdMinutes,
    });

    if (error) {
      console.error('[qa-watchdog] RPC error:', error.message);
      return new Response(JSON.stringify({ ok: false, error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const count = Array.isArray(stuckRuns) ? stuckRuns.length : 0;
    console.log(`[qa-watchdog] Cleaned up ${count} stuck run(s)`);

    return new Response(JSON.stringify({
      ok: true,
      cleaned: count,
      stuck_runs: stuckRuns || [],
      threshold_minutes: thresholdMinutes,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[qa-watchdog] Error:', String(err));
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
