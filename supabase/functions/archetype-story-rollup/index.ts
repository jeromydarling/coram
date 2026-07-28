/**
 * archetype-story-rollup — Nightly aggregation of anonymized narrative signals by archetype.
 *
 * WHAT: Aggregates testimonium_rollups by archetype, generates deterministic narrative text.
 * WHERE: Runs nightly after testimonium-public-rollup.
 * WHY: Powers the Living Signals section on public archetype pages without exposing tenant data.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MIN_TENANT_SAMPLE = 5;

/** Deterministic narrative generator — no AI, just templates. */
function generateStory(
  archKey: string,
  metrics: { reflections: number; visits: number; events: number; momentum: number },
): string {
  const parts: string[] = [];

  // Archetype-aware opening
  const labels: Record<string, string> = {
    church: 'faith communities',
    digital_inclusion: 'digital inclusion programs',
    social_enterprise: 'social enterprises',
    workforce: 'workforce development teams',
    refugee_support: 'refugee support organizations',
    education_access: 'education access programs',
    library_system: 'library systems',
  };
  const label = labels[archKey] || 'organizations';

  if (metrics.reflections > 0 && metrics.visits > 0) {
    parts.push(
      `This week, ${label} focused on presence — reflections and visit notes continued to flow across the ecosystem.`,
    );
  } else if (metrics.reflections > 0) {
    parts.push(`Reflection activity among ${label} remained steady this week.`);
  } else if (metrics.visits > 0) {
    parts.push(`Visit activity among ${label} continued this week.`);
  }

  if (metrics.events > 0) {
    parts.push('Community events were part of the rhythm.');
  }

  if (metrics.momentum > 0) {
    parts.push('Gentle momentum is building in several areas.');
  }

  if (parts.length === 0) {
    parts.push(`${label.charAt(0).toUpperCase() + label.slice(1)} are quietly present across the ecosystem.`);
  }

  return parts.join(' ');
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Period: last 7 days
    const periodEnd = new Date();
    const periodStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // Get all testimonium rollups for this period, joined with tenant archetype
    const { data: rollups, error: rollErr } = await admin
      .from('testimonium_rollups')
      .select('tenant_id, reflection_count, event_presence_count, volunteer_activity, journey_moves, email_touch_count')
      .gte('week_start', periodStart.toISOString())
      .lte('week_start', periodEnd.toISOString());

    if (rollErr) throw rollErr;

    // Get tenant archetypes
    const tenantIds = [...new Set((rollups || []).map((r: any) => r.tenant_id))];
    if (tenantIds.length === 0) {
      return new Response(JSON.stringify({ ok: true, count: 0, reason: 'no_rollup_data' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: tenants, error: tErr } = await admin
      .from('tenants')
      .select('id, archetype')
      .in('id', tenantIds);

    if (tErr) throw tErr;

    const tenantArchMap: Record<string, string> = {};
    for (const t of tenants || []) {
      if (t.archetype) tenantArchMap[t.id] = t.archetype;
    }

    // Aggregate by archetype
    const byArch: Record<string, {
      tenantIds: Set<string>;
      reflections: number;
      visits: number;
      events: number;
      momentum: number;
    }> = {};

    for (const r of rollups || []) {
      const arch = tenantArchMap[r.tenant_id];
      if (!arch) continue;
      if (!byArch[arch]) {
        byArch[arch] = { tenantIds: new Set(), reflections: 0, visits: 0, events: 0, momentum: 0 };
      }
      const b = byArch[arch];
      b.tenantIds.add(r.tenant_id);
      b.reflections += r.reflection_count || 0;
      b.events += r.event_presence_count || 0;
      b.visits += r.volunteer_activity || 0; // visit-like activity
      b.momentum += r.journey_moves || 0;
    }

    let upserted = 0;
    let suppressed = 0;

    for (const [archKey, agg] of Object.entries(byArch)) {
      const sampleSize = agg.tenantIds.size;

      // Privacy threshold
      if (sampleSize < MIN_TENANT_SAMPLE) {
        suppressed++;
        continue;
      }

      const story = generateStory(archKey, {
        reflections: agg.reflections,
        visits: agg.visits,
        events: agg.events,
        momentum: agg.momentum,
      });

      const { error: uErr } = await admin
        .from('archetype_signal_rollups')
        .upsert(
          {
            archetype_key: archKey,
            period_start: periodStart.toISOString(),
            period_end: periodEnd.toISOString(),
            reflection_volume: agg.reflections,
            visit_activity: agg.visits,
            event_presence: agg.events,
            momentum_growth: agg.momentum,
            tenant_sample_size: sampleSize,
            generated_story: story,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'archetype_key,period_start' },
        );

      if (uErr) throw uErr;
      upserted++;
    }

    return new Response(
      JSON.stringify({ ok: true, upserted, suppressed }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ ok: false, error: err.message, code: 'ROLLUP_FAILED' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
