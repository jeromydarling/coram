/**
 * Narrative Signal Aggregator — Rule-based pattern detection for NRI.
 *
 * WHAT: Pulls from testimonium_rollups, lumen_signals, metro_momentum_signals,
 *       and narrative_value_moments to produce suggested story outlines.
 * WHERE: Used by Operator Nexus Narrative Studio.
 * WHY: Surfaces emerging narrative patterns WITHOUT AI generation.
 */

import { supabase } from '@/integrations/supabase/client';
import { untypedTable } from '@/lib/untypedTable';

export interface NarrativeSignal {
  id: string;
  role: string;
  archetype: string;
  pattern: string;
  suggested_slug: string;
  summary: string;
  source_type: 'testimonium' | 'lumen' | 'momentum' | 'moment';
  source_data: Record<string, unknown>;
  strength: 'emerging' | 'growing' | 'strong';
  detected_at: string;
}

/**
 * Aggregate signals from multiple sources and produce narrative suggestions.
 * NO AI involved — all rule-based.
 */
export async function aggregateNarrativeSignals(): Promise<NarrativeSignal[]> {
  const signals: NarrativeSignal[] = [];
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

  // TEMP TYPE ESCAPE — testimonium_rollups columns (period_start, summary, signal_count, themes) not in types.ts
  const { data: rollups } = await untypedTable('testimonium_rollups')
    .select('id, tenant_id, period_start, summary, signal_count, themes')
    .gte('period_start', weekAgo)
    .order('signal_count', { ascending: false })
    .limit(20);

  if (rollups) {
    for (const r of rollups) {
      if (r.signal_count >= 5) {
        const themes = Array.isArray(r.themes) ? r.themes : [];
        const topTheme = (themes[0] as string) || 'community activity';
        signals.push({
          id: `test-${r.id}`,
          role: 'shepherd',
          archetype: 'community',
          pattern: `Rising activity: ${topTheme}`,
          suggested_slug: slugify(`${topTheme}-${r.period_start?.slice(0, 10)}`),
          summary: r.summary || `A surge of ${r.signal_count} signals around "${topTheme}" suggests a story worth sharing.`,
          source_type: 'testimonium',
          source_data: { rollup_id: r.id, signal_count: r.signal_count, themes },
          strength: r.signal_count >= 10 ? 'strong' : 'growing',
          detected_at: r.period_start || now.toISOString(),
        });
      }
    }
  }

  // TEMP TYPE ESCAPE — lumen_signals columns (title, narrative, acknowledged) not in types.ts
  const { data: lumenSignals } = await untypedTable('lumen_signals')
    .select('id, signal_type, severity, title, narrative, tenant_id, created_at')
    .gte('created_at', weekAgo)
    .eq('acknowledged', false)
    .order('created_at', { ascending: false })
    .limit(15);

  if (lumenSignals) {
    for (const l of lumenSignals) {
      if (l.severity === 'high' || l.severity === 'medium') {
        signals.push({
          id: `lumen-${l.id}`,
          role: 'steward',
          archetype: 'platform',
          pattern: `Lumen foresight: ${l.signal_type}`,
          suggested_slug: slugify(`foresight-${l.signal_type}-${l.created_at?.slice(0, 10)}`),
          summary: l.narrative || l.title || `A ${l.severity} foresight signal of type "${l.signal_type}" has been detected.`,
          source_type: 'lumen',
          source_data: { signal_id: l.id, signal_type: l.signal_type, severity: l.severity },
          strength: l.severity === 'high' ? 'strong' : 'emerging',
          detected_at: l.created_at,
        });
      }
    }
  }

  // 3. Check metro momentum for growth stories — metro_momentum_signals is a VIEW, use as any
  const { data: momentum } = await supabase
    .from('metro_momentum_signals')
    .select('metro_id, metro_name, momentum_status, normalized_momentum, anchors_90d, events_this_quarter')
    .in('momentum_status', ['accelerating', 'steady']);

  if (momentum) {
    for (const m of momentum) {
      if (m.normalized_momentum >= 0.7) {
        signals.push({
          id: `momentum-${m.metro_id}`,
          role: 'shepherd',
          archetype: 'community',
          pattern: `Metro momentum: ${m.metro_name}`,
          suggested_slug: slugify(`momentum-${m.metro_name}`),
          summary: `${m.metro_name} is showing strong momentum — ${m.anchors_90d} new relationships and ${m.events_this_quarter} events this quarter.`,
          source_type: 'momentum',
          source_data: { metro_id: m.metro_id, momentum: m.normalized_momentum },
          strength: m.normalized_momentum >= 0.85 ? 'strong' : 'growing',
          detected_at: now.toISOString(),
        });
      }
    }
  }

  // 4. Check Projects (Good Work) for community story patterns
  const { data: projectActivity } = await supabase
    .from('activities')
    .select('id, tenant_id, title, activity_date_time')
    .eq('activity_type', 'Project' as any)
    .gte('activity_date_time', weekAgo)
    .is('parent_activity_id', null);

  if (projectActivity && projectActivity.length >= 3) {
    const projectIds = projectActivity.map(p => p.id);
    const { count: noteCount } = await supabase
      .from('activities')
      .select('*', { count: 'exact', head: true })
      .in('parent_activity_id', projectIds);

    // Get impact data
    const { data: impacts } = await supabase
      .from('activity_impact')
      .select('people_helped')
      .in('activity_id', projectIds);

    const totalHelped = (impacts || []).reduce((s: number, i) => s + (i.people_helped || 0), 0);

    const storyDensity = (noteCount || 0) / projectActivity.length;
    const strength: 'emerging' | 'growing' | 'strong' =
      projectActivity.length >= 8 ? 'strong' : projectActivity.length >= 5 ? 'growing' : 'emerging';

    signals.push({
      id: `goodwork-${weekAgo.slice(0, 10)}`,
      role: 'shepherd',
      archetype: 'community',
      pattern: 'Good work in motion',
      suggested_slug: slugify(`good-work-pulse-${weekAgo.slice(0, 10)}`),
      summary: `${projectActivity.length} projects this week${totalHelped > 0 ? `, ${totalHelped} people helped` : ''}. Story density: ${storyDensity.toFixed(1)} notes/project.${storyDensity < 1 ? ' Story capture may be dropping — encourage reflections.' : ''}`,
      source_type: 'testimonium',
      source_data: {
        project_count: projectActivity.length,
        note_count: noteCount || 0,
        people_helped: totalHelped,
        story_density: storyDensity,
      },
      strength,
      detected_at: now.toISOString(),
    });
  }

  // 5. Check value moments for concentration patterns
  const { data: moments } = await supabase
    .from('narrative_value_moments')
    .select('moment_type, source, summary')
    .gte('occurred_at', monthAgo);

  if (moments && moments.length > 0) {
    const byType = new Map<string, number>();
    for (const m of moments) {
      byType.set(m.moment_type, (byType.get(m.moment_type) || 0) + 1);
    }
    for (const [type, count] of byType) {
      if (count >= 8) {
        const typeLabels: Record<string, string> = {
          growth: 'A season of growth',
          momentum: 'Building momentum',
          community_presence: 'Community presence deepening',
          reconnection: 'Reconnections forming',
          collaboration: 'Collaboration patterns emerging',
        };
        signals.push({
          id: `moment-${type}`,
          role: 'companion',
          archetype: 'community',
          pattern: typeLabels[type] || type,
          suggested_slug: slugify(`${type}-pattern`),
          summary: `${count} "${type}" moments detected in the last 30 days — enough to tell a story.`,
          source_type: 'moment',
          source_data: { moment_type: type, count },
          strength: count >= 15 ? 'strong' : count >= 10 ? 'growing' : 'emerging',
          detected_at: now.toISOString(),
        });
      }
    }
  }

  // Sort by strength
  const strengthOrder: Record<string, number> = { strong: 0, growing: 1, emerging: 2 };
  signals.sort((a, b) => (strengthOrder[a.strength] ?? 2) - (strengthOrder[b.strength] ?? 2));

  return signals;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
}
