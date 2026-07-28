// console-apps — Federation Apps Registry read API
// WHAT: Returns federation_apps rows for the Gardener Console.
// WHERE: GET /functions/v1/console-apps?tier=&seo_active=&status=
// WHY:  Single read endpoint behind the /operator/console/apps page.
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const url = new URL(req.url);
    const tier = url.searchParams.get('tier');
    const seoActive = url.searchParams.get('seo_active');
    const status = url.searchParams.get('status') ?? 'active';

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    let q = supabase.from('federation_apps').select('*').order('display_name');
    if (tier) q = q.eq('tier', tier);
    if (status && status !== 'all') q = q.eq('status', status);
    if (seoActive === 'true') q = q.eq('seo_active', true);

    const { data, error } = await q;
    if (error) throw error;

    // Alias slug -> source_app to match spec API
    const apps = (data ?? []).map((row: any) => ({ ...row, source_app: row.slug }));

    return new Response(JSON.stringify({ apps, count: apps.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
