/**
 * federation-ga-report — federation-wide GA4 aggregator for the Gardener Console.
 *
 * WHAT: Fans out a single 7d/28d summary report to every GA4 property linked
 *       in `federation_ga_properties` (federation_apps.metadata + orphan view),
 *       in parallel, and returns one consolidated payload.
 *
 * WHERE: Called from `FederationAnalyticsPanel.tsx` at /operator/federation-analytics.
 *
 * WHY:  Native GA navigation makes cross-property comparison painful. The
 *       Gardener Console needs an at-a-glance view that surfaces:
 *         - Web vitals per app (sessions, users, pageviews, avg duration)
 *         - Silent vs firing audit (zero-event detection)
 *         - Combined federation totals for the macro pulse
 *
 * AUTH: Reuses the user's stored Google OAuth from gardener_ga_connections
 *       (same table the schola-ga-report uses). Caller must have a row there.
 *
 * NOTE on revenue tab: Stripe data is sourced separately by the dashboard
 *       component from operator_tenant_stats / Stripe live API — this function
 *       returns ONLY GA metrics. Keep responsibilities narrow.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { captureEdgeException } from "../_shared/sentryCapture.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PropertyRow {
  slug: string | null;
  display_name: string;
  primary_domain: string | null;
  ga_property_id: string;
  link_status: 'linked' | 'orphan';
  status: string | null;
}

interface PerAppMetrics {
  sessions: number;
  users: number;
  pageviews: number;
  avgDuration: number;
  bounceRate: number;
}

interface PerAppResult {
  slug: string | null;
  display_name: string;
  primary_domain: string | null;
  property_id: string;
  link_status: 'linked' | 'orphan';
  status: string | null;
  d7: PerAppMetrics;
  d28: PerAppMetrics;
  /** Health classification derived from d7 events. */
  health: 'firing' | 'silent' | 'error';
  /** GA API error if health === 'error'. */
  error?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const clientId = Deno.env.get('GOOGLE_CLIENT_ID')!;
    const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET')!;

    // ─── auth ─────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return json({ ok: false, error: 'Missing auth' }, 401);
    }
    const supabase = createClient(url, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsErr } = await supabase.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) {
      return json({ ok: false, error: 'Unauthorized' }, 401);
    }
    const userId = claimsData.claims.sub as string;

    // ─── OAuth connection ─────────────────────────────────
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
      return json({
        ok: false,
        error:
          'No GA connection found. Connect a Google account on /operator/analytics first ' +
          '— this aggregator reuses the same OAuth.',
      }, 404);
    }

    let accessToken = conn.access_token;

    // Refresh if expired (same flow as schola-ga-report).
    if (conn.token_expires_at && new Date(conn.token_expires_at) < new Date()) {
      if (!conn.refresh_token) {
        return json({ ok: false, error: 'Token expired and no refresh token. Reconnect on /operator/analytics.' }, 401);
      }
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), 15000);
      try {
        const r = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            refresh_token: conn.refresh_token,
            grant_type: 'refresh_token',
          }),
          signal: ctl.signal,
        });
        const d = await r.json();
        if (d.access_token) {
          accessToken = d.access_token;
          const newExpiry = new Date(Date.now() + (d.expires_in || 3600) * 1000).toISOString();
          await adminClient.from('gardener_ga_connections')
            .update({ access_token: accessToken, token_expires_at: newExpiry })
            .eq('id', conn.id);
        } else {
          return json({ ok: false, error: 'Token refresh failed. Reconnect on /operator/analytics.' }, 401);
        }
      } finally {
        clearTimeout(t);
      }
    }

    // ─── property registry ────────────────────────────────
    const { data: properties, error: propsErr } = await adminClient
      .from('federation_ga_properties')
      .select('*');
    if (propsErr) throw propsErr;
    const props = (properties || []) as PropertyRow[];

    // ─── parallel GA calls (capped at 8 concurrent) ───────
    const CONCURRENCY = 8;
    const results: PerAppResult[] = [];

    async function runReport(propertyId: string) {
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), 20000);
      try {
        const res = await fetch(
          `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
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
            }),
            signal: ctl.signal,
          }
        );
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error?.message || `GA API error (HTTP ${res.status})`);
        }
        return data;
      } finally {
        clearTimeout(t);
      }
    }

    function parseMetrics(rows: any[], offset: number): PerAppMetrics {
      if (!rows?.length) {
        return { sessions: 0, users: 0, pageviews: 0, avgDuration: 0, bounceRate: 0 };
      }
      const v = rows[0].metricValues;
      return {
        sessions: parseInt(v[offset]?.value || '0'),
        users: parseInt(v[offset + 1]?.value || '0'),
        pageviews: parseInt(v[offset + 2]?.value || '0'),
        avgDuration: parseFloat(v[offset + 3]?.value || '0'),
        bounceRate: parseFloat(v[offset + 4]?.value || '0'),
      };
    }

    // Cap concurrency by chunking. 22 properties / 8 = 3 waves.
    for (let i = 0; i < props.length; i += CONCURRENCY) {
      const chunk = props.slice(i, i + CONCURRENCY);
      const settled = await Promise.allSettled(chunk.map((p) => runReport(p.ga_property_id)));
      settled.forEach((s, idx) => {
        const p = chunk[idx];
        if (s.status === 'fulfilled') {
          const d7 = parseMetrics(s.value.rows, 0);
          const d28 = parseMetrics(s.value.rows, 5);
          results.push({
            slug: p.slug,
            display_name: p.display_name,
            primary_domain: p.primary_domain,
            property_id: p.ga_property_id,
            link_status: p.link_status,
            status: p.status,
            d7,
            d28,
            health: d7.sessions > 0 || d28.sessions > 0 ? 'firing' : 'silent',
          });
        } else {
          results.push({
            slug: p.slug,
            display_name: p.display_name,
            primary_domain: p.primary_domain,
            property_id: p.ga_property_id,
            link_status: p.link_status,
            status: p.status,
            d7: { sessions: 0, users: 0, pageviews: 0, avgDuration: 0, bounceRate: 0 },
            d28: { sessions: 0, users: 0, pageviews: 0, avgDuration: 0, bounceRate: 0 },
            health: 'error',
            error: String((s as PromiseRejectedResult).reason?.message || s.reason),
          });
        }
      });
    }

    // ─── federation totals ────────────────────────────────
    const totals = results.reduce(
      (acc, r) => ({
        d7: {
          sessions: acc.d7.sessions + r.d7.sessions,
          users: acc.d7.users + r.d7.users,
          pageviews: acc.d7.pageviews + r.d7.pageviews,
        },
        d28: {
          sessions: acc.d28.sessions + r.d28.sessions,
          users: acc.d28.users + r.d28.users,
          pageviews: acc.d28.pageviews + r.d28.pageviews,
        },
        counts: {
          total: acc.counts.total + 1,
          firing: acc.counts.firing + (r.health === 'firing' ? 1 : 0),
          silent: acc.counts.silent + (r.health === 'silent' ? 1 : 0),
          errored: acc.counts.errored + (r.health === 'error' ? 1 : 0),
          orphans: acc.counts.orphans + (r.link_status === 'orphan' ? 1 : 0),
        },
      }),
      {
        d7: { sessions: 0, users: 0, pageviews: 0 },
        d28: { sessions: 0, users: 0, pageviews: 0 },
        counts: { total: 0, firing: 0, silent: 0, errored: 0, orphans: 0 },
      }
    );

    // Sort: firing first (by 7d sessions desc), then silent, then errored.
    results.sort((a, b) => {
      const rank = (r: PerAppResult) =>
        r.health === 'firing' ? 0 : r.health === 'silent' ? 1 : 2;
      const ra = rank(a), rb = rank(b);
      if (ra !== rb) return ra - rb;
      return b.d7.sessions - a.d7.sessions;
    });

    return json({
      ok: true,
      generated_at: new Date().toISOString(),
      totals,
      apps: results,
      connectedEmail: conn.connected_email,
    });
  } catch (err) {
    console.error('federation-ga-report error:', err);
    await captureEdgeException(err, "federation-ga-report");
    return json({ ok: false, error: (err as Error).message || 'Internal error' }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
