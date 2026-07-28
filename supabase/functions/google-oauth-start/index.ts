import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const clientId = Deno.env.get('GOOGLE_CLIENT_ID');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (!clientId) {
      return new Response(JSON.stringify({ ok: false, error: 'GOOGLE_CLIENT_ID not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ ok: false, error: 'Missing auth' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(url, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) {
      console.error('Auth error:', userErr?.message);
      return new Response(JSON.stringify({ ok: false, error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const userId = user.id;
    const userEmail = user.email || '';

    // Role check
    const adminClient = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: roles } = await adminClient.from('user_roles').select('role').eq('user_id', userId);
    const isGardener = roles?.some((r: any) => r.role === 'admin' || r.role === 'steward');
    if (!isGardener) {
      return new Response(JSON.stringify({ ok: false, error: 'Not a gardener' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parse request
    const { property_id, redirect_uri } = await req.json();
    if (!property_id) {
      return new Response(JSON.stringify({ ok: false, error: 'property_id required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const callbackUrl = `${url}/functions/v1/google-oauth-callback`;
    const state = btoa(JSON.stringify({
      user_id: userId,
      property_id,
      integration_type: 'ga4',
      redirect_uri: redirect_uri || `${url.replace('.supabase.co', '.lovable.app')}/operator/nexus/analytics`,
    }));

    const domain = userEmail?.split('@')[1];
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: callbackUrl,
      response_type: 'code',
      scope: 'https://www.googleapis.com/auth/analytics.readonly https://www.googleapis.com/auth/userinfo.email',
      access_type: 'offline',
      prompt: 'select_account consent',
      state,
      ...(domain && domain !== 'gmail.com' ? { hd: domain } : {}),
    });

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

    return new Response(JSON.stringify({ ok: true, authUrl }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('google-oauth-start error:', err);
    return new Response(JSON.stringify({ ok: false, error: 'Internal error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
