/**
 * simulation-cleanup — Removes old simulation markers and associated records.
 *
 * WHAT: Deletes simulation markers older than 30 days and their associated records.
 * WHERE: Called on-demand by operator.
 * WHY: Prevents simulation data from accumulating indefinitely.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const adminClient = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

    // Auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return new Response(JSON.stringify({ error: 'Missing auth' }), { status: 401, headers: corsHeaders });

    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const userClient = createClient(url, anonKey, { auth: { persistSession: false } });
    const { data: { user }, error: authErr } = await userClient.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authErr || !user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });

    const { data: roles } = await adminClient.from('user_roles').select('role').eq('user_id', user.id);
    if (!roles?.some((r: any) => r.role === 'admin')) {
      return new Response(JSON.stringify({ error: 'Admin only' }), { status: 403, headers: corsHeaders });
    }

    const body = await req.json().catch(() => ({}));
    const days = body.retention_days || 30;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    // Get old markers
    const { data: markers, error: markErr } = await adminClient.from('simulation_markers')
      .select('id, record_table, record_id')
      .lt('created_at', cutoff.toISOString())
      .limit(500);

    if (markErr) throw markErr;

    let cleaned = 0;
    for (const marker of markers || []) {
      // Best-effort delete associated record
      try {
        await adminClient.from(marker.record_table as any).delete().eq('id', marker.record_id);
      } catch { /* best effort */ }
      await adminClient.from('simulation_markers').delete().eq('id', marker.id);
      cleaned++;
    }

    return new Response(JSON.stringify({ ok: true, markers_cleaned: cleaned }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('simulation-cleanup error:', e);
    return new Response(JSON.stringify({ ok: false, error: e instanceof Error ? e.message : 'Unknown' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
