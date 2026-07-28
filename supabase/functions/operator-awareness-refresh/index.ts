/**
 * operator-awareness-refresh — Lightweight aggregation of existing signals into awareness events.
 *
 * WHAT: Reads from testimonium_rollups, lumen_signals, operator_tenant_stats, migration_runs,
 *       activation_sessions, and testimonium_events to generate high-signal awareness events.
 * WHERE: Called on-demand or via cron from Operator Nexus.
 * WHY: Surfaces ecosystem movement without requiring the operator to read multiple dashboards.
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
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }

    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const sc = createClient(supabaseUrl, serviceKey);

    // Verify admin
    const { data: roleData } = await sc
      .from('user_roles').select('role')
      .eq('user_id', user.id).eq('role', 'admin')
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: 'Admin access required' }), { status: 403, headers: corsHeaders });
    }

    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString();
    const weekKey = `${now.getFullYear()}-W${String(Math.ceil((now.getTime() - new Date(now.getFullYear(), 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000))).padStart(2, '0')}`;

    const events: Array<{
      category: string;
      title: string;
      summary: string;
      tenant_id?: string;
      metro_id?: string;
      signal_strength: number;
      source: string;
      metadata: Record<string, unknown>;
      dedupe_key: string;
    }> = [];

    // ── 1. Narrative drift: testimonium rollups showing reflection drops ──
    const { data: rollups } = await sc
      .from('testimonium_rollups')
      .select('tenant_id, reflection_count, week_start')
      .gte('week_start', twoWeeksAgo)
      .order('week_start', { ascending: false });

    if (rollups && rollups.length > 0) {
      // Group by tenant, compare this week vs last week
      const byTenant: Record<string, { current: number; previous: number }> = {};
      for (const r of rollups) {
        const tid = r.tenant_id;
        if (!byTenant[tid]) byTenant[tid] = { current: 0, previous: 0 };
        if (r.week_start >= weekAgo) {
          byTenant[tid].current += r.reflection_count || 0;
        } else {
          byTenant[tid].previous += r.reflection_count || 0;
        }
      }
      for (const [tid, counts] of Object.entries(byTenant)) {
        if (counts.previous > 2 && counts.current < counts.previous * 0.5) {
          events.push({
            category: 'narrative',
            title: 'Reflection momentum slowing',
            summary: `Reflections dropped from ${counts.previous} to ${counts.current} this week. A gentle follow-up may be welcomed.`,
            tenant_id: tid,
            signal_strength: Math.min(3, Math.ceil((counts.previous - counts.current) / counts.previous * 3)),
            source: 'testimonium_rollups',
            metadata: { previous: counts.previous, current: counts.current },
            dedupe_key: `${tid}:narrative:${weekKey}`,
          });
        }
      }
    }

    // ── 2. Friction spikes from lumen_signals ──
    const { data: frictionSignals } = await sc
      .from('lumen_signals')
      .select('id, tenant_id, metro_id, signal_type, severity, source_summary')
      .eq('resolved', false)
      .gte('first_detected_at', weekAgo);

    if (frictionSignals) {
      // Group by tenant
      const frictionByTenant: Record<string, typeof frictionSignals> = {};
      for (const s of frictionSignals) {
        const tid = s.tenant_id;
        if (!frictionByTenant[tid]) frictionByTenant[tid] = [];
        frictionByTenant[tid].push(s);
      }
      for (const [tid, signals] of Object.entries(frictionByTenant)) {
        if (signals.length >= 2) {
          const types = [...new Set(signals.map(s => s.signal_type))];
          events.push({
            category: 'friction',
            title: 'Friction signals emerging',
            summary: `${signals.length} unresolved signals detected (${types.join(', ')}). Worth a quiet look.`,
            tenant_id: tid,
            metro_id: signals[0].metro_id || undefined,
            signal_strength: Math.min(3, signals.length),
            source: 'lumen_signals',
            metadata: { signal_count: signals.length, types },
            dedupe_key: `${tid}:friction:${weekKey}`,
          });
        }
      }
    }

    // ── 3. Expansion: detect tenants with new metros added recently ──
    // Look at tenant_metros join or metros assigned in the last 2 weeks
    const { data: recentMetroAssigns } = await sc
      .from('metros')
      .select('id, metro, tenant_id')
      .gte('created_at', twoWeeksAgo);

    // Also pull from operator_tenant_stats as a fallback signal
    const { data: tenantStats } = await sc
      .from('operator_tenant_stats')
      .select('tenant_id, expansion_count')
      .gt('expansion_count', 0);

    // Collect expansion entries for operator_expansion_watch
    const expansionWatchRows: Array<{
      tenant_id: string;
      metro_id: string;
      phase: string;
      risk_level: string;
      notes: string;
    }> = [];

    if (recentMetroAssigns && recentMetroAssigns.length > 0) {
      // Group new metros by tenant
      const byTenant: Record<string, typeof recentMetroAssigns> = {};
      for (const m of recentMetroAssigns) {
        if (!m.tenant_id) continue;
        if (!byTenant[m.tenant_id]) byTenant[m.tenant_id] = [];
        byTenant[m.tenant_id].push(m);
      }
      for (const [tid, metros] of Object.entries(byTenant)) {
        events.push({
          category: 'expansion',
          title: 'Community expanding into new areas',
          summary: `${metros.length} new ${metros.length === 1 ? 'metro' : 'metros'} added recently. Growth is happening.`,
          tenant_id: tid,
          signal_strength: Math.min(3, metros.length),
          source: 'metros',
          metadata: { metro_names: metros.map(m => m.metro), count: metros.length },
          dedupe_key: `${tid}:expansion:${weekKey}`,
        });
        // Populate expansion watch
        for (const m of metros) {
          expansionWatchRows.push({
            tenant_id: tid,
            metro_id: m.id,
            phase: 'new',
            risk_level: 'low',
            notes: `Auto-detected: ${m.metro} added during ${weekKey}`,
          });
        }
      }
    } else if (tenantStats) {
      // Fallback to operator_tenant_stats counts
      for (const ts of tenantStats) {
        if ((ts.expansion_count || 0) > 0) {
          events.push({
            category: 'expansion',
            title: 'Community expanding into new areas',
            summary: `${ts.expansion_count} expansion ${ts.expansion_count === 1 ? 'area' : 'areas'} active. Growth is happening.`,
            tenant_id: ts.tenant_id,
            signal_strength: Math.min(3, ts.expansion_count || 1),
            source: 'operator_tenant_stats',
            metadata: { expansion_count: ts.expansion_count },
            dedupe_key: `${ts.tenant_id}:expansion:${weekKey}`,
          });
        }
      }
    }

    // Upsert expansion watch rows (dedupe by tenant+metro)
    if (expansionWatchRows.length > 0) {
      for (const row of expansionWatchRows) {
        await sc
          .from('operator_expansion_watch')
          .upsert(row, { onConflict: 'tenant_id,metro_id', ignoreDuplicates: true });
      }
    }

    // ── 4. Migration patterns ──
    const { data: recentMigrations } = await sc
      .from('migration_runs')
      .select('id, connector_key, tenant_id, status')
      .gte('created_at', weekAgo);

    if (recentMigrations && recentMigrations.length > 0) {
      const byConnector: Record<string, number> = {};
      for (const m of recentMigrations) {
        byConnector[m.connector_key] = (byConnector[m.connector_key] || 0) + 1;
      }
      for (const [connector, count] of Object.entries(byConnector)) {
        if (count >= 2) {
          events.push({
            category: 'migration',
            title: `${connector} migrations active`,
            summary: `${count} migrations from ${connector} this week. Consider updating the onboarding guide.`,
            signal_strength: Math.min(3, count),
            source: 'migration_runs',
            metadata: { connector, count },
            dedupe_key: `global:migration:${connector}:${weekKey}`,
          });
        }
      }
    }

    // ── 5. Activation sessions ──
    const { data: activationSessions } = await sc
      .from('activation_sessions')
      .select('id, tenant_id, status, session_type')
      .eq('status', 'scheduled');

    if (activationSessions && activationSessions.length > 0) {
      events.push({
        category: 'activation',
        title: `${activationSessions.length} activation ${activationSessions.length === 1 ? 'session' : 'sessions'} upcoming`,
        summary: 'Communities are preparing to come alive. Your guidance makes a difference.',
        signal_strength: Math.min(3, activationSessions.length),
        source: 'activation_sessions',
        metadata: { count: activationSessions.length },
        dedupe_key: `global:activation:${weekKey}`,
      });
    }

    // ── 6. Growth signals from testimonium ──
    const { data: growthSignals } = await sc
      .from('testimonium_rollups')
      .select('tenant_id, reflection_count, visit_note_count, week_start')
      .gte('week_start', weekAgo);

    if (growthSignals) {
      for (const g of growthSignals) {
        const total = (g.reflection_count || 0) + (g.visit_note_count || 0);
        if (total >= 10) {
          events.push({
            category: 'growth',
            title: 'Strong engagement momentum',
            summary: `${total} reflections and visit notes this week. This community is thriving.`,
            tenant_id: g.tenant_id,
            signal_strength: Math.min(3, Math.floor(total / 10)),
            source: 'testimonium_rollups',
            metadata: { reflections: g.reflection_count, visit_notes: g.visit_note_count },
            dedupe_key: `${g.tenant_id}:growth:${weekKey}`,
          });
        }
      }
    }

    // ── Upsert events (deduplicated) ──
    let inserted = 0;
    for (const evt of events) {
      const { error } = await sc
        .from('operator_awareness_events')
        .upsert(evt, { onConflict: 'dedupe_key', ignoreDuplicates: true });
      if (!error) inserted++;
    }

    return new Response(JSON.stringify({
      ok: true,
      generated: events.length,
      inserted,
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
