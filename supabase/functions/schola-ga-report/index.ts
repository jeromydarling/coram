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
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const clientId = Deno.env.get('GOOGLE_CLIENT_ID')!;
    const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET')!;

    // Auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ ok: false, error: 'Missing auth' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const supabase = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsErr } = await supabase.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ ok: false, error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const userId = claimsData.claims.sub as string;

    // Get connection
    const adminClient = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: conn } = await adminClient
      .from('gardener_ga_connections')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!conn) {
      return new Response(JSON.stringify({ ok: false, error: 'No GA connection found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let accessToken = conn.access_token;

    // Refresh if expired
    if (conn.token_expires_at && new Date(conn.token_expires_at) < new Date()) {
      if (!conn.refresh_token) {
        return new Response(JSON.stringify({ ok: false, error: 'Token expired and no refresh token. Please reconnect.' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      try {
        const refreshRes = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            refresh_token: conn.refresh_token,
            grant_type: 'refresh_token',
          }),
          signal: controller.signal,
        });
        const refreshData = await refreshRes.json();
        if (refreshData.access_token) {
          accessToken = refreshData.access_token;
          const newExpiry = new Date(Date.now() + (refreshData.expires_in || 3600) * 1000).toISOString();
          await adminClient.from('gardener_ga_connections')
            .update({ access_token: accessToken, token_expires_at: newExpiry })
            .eq('id', conn.id);
        } else {
          return new Response(JSON.stringify({ ok: false, error: 'Token refresh failed. Please reconnect.' }), {
            status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      } finally {
        clearTimeout(timeout);
      }
    }

    const propertyId = conn.property_id;

    // Helper to run a GA4 report
    async function runReport(body: any) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20000);
      try {
        const res = await fetch(
          `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
            signal: controller.signal,
          }
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.error?.message || 'GA API error');
        return data;
      } finally {
        clearTimeout(timeout);
      }
    }

    // 7-day summary
    const summaryData = await runReport({
      dateRanges: [
        { startDate: '7daysAgo', endDate: 'today' },
        { startDate: '28daysAgo', endDate: 'today' },
      ],
      metrics: [
        { name: 'sessions' },
        { name: 'totalUsers' },
        { name: 'screenPageViews' },
        { name: 'averageSessionDuration' },
        { name: 'bounceRate' },
      ],
    });

    // Sessions over time (7 days)
    const timeSeriesData = await runReport({
      dateRanges: [{ startDate: '7daysAgo', endDate: 'today' }],
      dimensions: [{ name: 'date' }],
      metrics: [{ name: 'sessions' }, { name: 'totalUsers' }],
      orderBys: [{ dimension: { dimensionName: 'date' } }],
    });

    // Traffic sources
    const trafficData = await runReport({
      dateRanges: [{ startDate: '7daysAgo', endDate: 'today' }],
      dimensions: [{ name: 'sessionDefaultChannelGroup' }],
      metrics: [{ name: 'sessions' }],
      orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
      limit: 8,
    });

    // Top pages
    const pagesData = await runReport({
      dateRanges: [{ startDate: '7daysAgo', endDate: 'today' }],
      dimensions: [{ name: 'pagePath' }],
      metrics: [{ name: 'screenPageViews' }, { name: 'totalUsers' }],
      orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
      limit: 10,
    });

    // Parse summary
    const parseMetrics = (rows: any[], rangeIndex: number) => {
      if (!rows?.length) return { sessions: 0, users: 0, pageviews: 0, avgDuration: 0, bounceRate: 0 };
      const vals = rows[0].metricValues;
      const offset = rangeIndex * 5;
      return {
        sessions: parseInt(vals[offset]?.value || '0'),
        users: parseInt(vals[offset + 1]?.value || '0'),
        pageviews: parseInt(vals[offset + 2]?.value || '0'),
        avgDuration: parseFloat(vals[offset + 3]?.value || '0'),
        bounceRate: parseFloat(vals[offset + 4]?.value || '0'),
      };
    };

    const summary7d = parseMetrics(summaryData.rows, 0);
    const summary28d = parseMetrics(summaryData.rows, 1);

    // Parse time series
    const timeSeries = (timeSeriesData.rows || []).map((r: any) => ({
      date: r.dimensionValues[0].value,
      sessions: parseInt(r.metricValues[0].value || '0'),
      users: parseInt(r.metricValues[1].value || '0'),
    }));

    // Parse traffic
    const trafficSources = (trafficData.rows || []).map((r: any) => ({
      channel: r.dimensionValues[0].value,
      sessions: parseInt(r.metricValues[0].value || '0'),
    }));

    // Parse pages
    const topPages = (pagesData.rows || []).map((r: any) => ({
      path: r.dimensionValues[0].value,
      views: parseInt(r.metricValues[0].value || '0'),
      users: parseInt(r.metricValues[1].value || '0'),
    }));

    return new Response(JSON.stringify({
      ok: true,
      summary7d,
      summary28d,
      timeSeries,
      trafficSources,
      topPages,
      propertyId,
      connectedEmail: conn.connected_email,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('schola-ga-report error:', err);
    return new Response(JSON.stringify({ ok: false, error: err.message || 'Internal error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
