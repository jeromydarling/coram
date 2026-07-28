/**
 * Public Metro Builder — Civitas aggregator for public metro pages.
 *
 * WHAT: Pulls anonymized, aggregated signals from momentum + narratives.
 * WHERE: Used by Operator Nexus Civitas workflow and public metro pages.
 * WHY: Surfaces civic patterns without exposing tenant data.
 */

import { supabase } from '@/integrations/supabase/client';

export interface PublicMetroSummary {
  metroId: string;
  metroSlug: string;
  metroName: string;
  archetypesActive: string[];
  narrativePatterns: string[];
  momentumScore: number;
  momentumStatus: string;
  anchors90d: number;
  eventsThisQuarter: number;
  readiness: 'not_ready' | 'draft_ready' | 'published';
}

/**
 * Build anonymized metro summaries from aggregated signals.
 * Rule-based only — no AI text generation.
 */
export async function buildPublicMetroSummaries(): Promise<PublicMetroSummary[]> {
  const summaries: PublicMetroSummary[] = [];

  // Fetch momentum signals
  const { data: momentum } = await supabase
    .from('metro_momentum_signals')
    .select('metro_id, metro_name, momentum_status, normalized_momentum, anchors_90d, events_this_quarter')
    .order('normalized_momentum', { ascending: false });

  if (!momentum) return [];

  // Fetch existing public pages to determine readiness
  const { data: existingPages } = await supabase
    .from('public_metro_pages')
    .select('metro_id, slug, status');

  const pageMap = new Map<string, { slug: string; status: string }>();
  if (existingPages) {
    for (const p of existingPages) {
      pageMap.set(p.metro_id, { slug: p.slug, status: p.status });
    }
  }

  for (const m of momentum) {
    const existing = pageMap.get(m.metro_id);
    const slug = existing?.slug || slugify(m.metro_name);

    // Determine narrative patterns from momentum
    const patterns: string[] = [];
    if (m.anchors_90d >= 3) patterns.push('Growing partnership network');
    if (m.events_this_quarter >= 5) patterns.push('Active community presence');
    if (m.normalized_momentum >= 0.7) patterns.push('Strong forward momentum');
    if (m.normalized_momentum >= 0.4 && m.normalized_momentum < 0.7) patterns.push('Steady community rhythm');

    // Determine readiness
    let readiness: PublicMetroSummary['readiness'] = 'not_ready';
    if (existing?.status === 'published') readiness = 'published';
    else if (m.normalized_momentum >= 0.3 || m.anchors_90d >= 2) readiness = 'draft_ready';

    summaries.push({
      metroId: m.metro_id,
      metroSlug: slug,
      metroName: m.metro_name,
      archetypesActive: [], // populated from archetype metrics when available
      narrativePatterns: patterns,
      momentumScore: Number(m.normalized_momentum) || 0,
      momentumStatus: m.momentum_status || 'Resting',
      anchors90d: m.anchors_90d || 0,
      eventsThisQuarter: m.events_this_quarter || 0,
      readiness,
    });
  }

  return summaries;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
}
