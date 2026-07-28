/**
 * public-communio-signals — Anonymized communio activity for public SEO surfaces.
 *
 * WHAT: Returns aggregated activity themes and collaboration patterns.
 * WHERE: Called by marketing pages for civic ecosystem signals.
 * WHY: Public narrative gravity without exposing tenant data.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { guardPublicEndpoint } from '../_shared/rateLimitPublic.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Rate limit: 20 requests per minute per IP
  const blocked = guardPublicEndpoint(req, 'public-communio-signals', { maxRequests: 20 });
  if (blocked) return blocked;

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Aggregate shared signals from the last 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: signals } = await supabase
      .from('communio_shared_signals')
      .select('signal_type, metro_id, created_at')
      .gte('created_at', thirtyDaysAgo)
      .limit(500);

    if (!signals || signals.length === 0) {
      return new Response(JSON.stringify({
        themes: [],
        patterns: [],
        signal_count: 0,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Aggregate by signal type (anonymized — no tenant data exposed)
    const typeCounts: Record<string, number> = {};
    const metroCounts: Record<string, number> = {};
    for (const s of signals) {
      typeCounts[s.signal_type] = (typeCounts[s.signal_type] || 0) + 1;
      if (s.metro_id) {
        metroCounts[s.metro_id] = (metroCounts[s.metro_id] || 0) + 1;
      }
    }

    // Build anonymized themes
    const themes = Object.entries(typeCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([type, count]) => ({
        theme: type.replace(/_/g, ' '),
        intensity: count >= 10 ? 'strong' : count >= 5 ? 'growing' : 'emerging',
      }));

    // Build anonymized collaboration patterns
    const activeMetros = Object.keys(metroCounts).length;
    const patterns: string[] = [];
    if (activeMetros >= 3) patterns.push('Cross-metro collaboration is active across the network.');
    if (signals.length >= 20) patterns.push('Community organizations are sharing patterns more frequently.');
    if (themes.some((t) => t.intensity === 'strong')) patterns.push('Strong thematic alignment is emerging in shared signals.');

    return new Response(JSON.stringify({
      themes,
      patterns,
      signal_count: signals.length,
      active_metros: activeMetros,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
