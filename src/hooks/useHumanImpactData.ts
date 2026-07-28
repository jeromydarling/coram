import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOpportunities } from './useOpportunities';
import { useAnchors } from './useAnchors';
import { useEvents } from './useEvents';
import { useMetros } from './useMetros';
import { useRegions } from './useRegions';
import { useAnchorPipeline } from './useAnchorPipeline';
import { useProvisions } from './useProvisions';
import { CHAPTER_COLORS } from '@/lib/journeyChapters';
import { toChapterLabel, JOURNEY_KANBAN_CHAPTERS, type Chapter } from '@/lib/journeyChapters';
import { subDays, parseISO, isAfter, format } from 'date-fns';

// ── Types ──

export interface ExecSummaryData {
  partnersActive: number;
  careProvided: number;
  eventsAttended: number;
  newRelationships: number;
  territoriesActivated: number;
  momentumTrend: 'rising' | 'steady' | 'declining';
  narrativeSummary: string;
}

export interface CommunityImpactData {
  themes: string[];
  signalCount: number;
  eventsParticipated: number;
  localPulseCount: number;
  narrativeSnippets: string[]; // safe headline-level only
}

export interface JourneyGrowthData {
  chapters: { chapter: Chapter; count: number; color: string }[];
  totalActive: number;
}

export interface SupportDeliveredData {
  totalUnits: number;
  totalProvisions: number;
  byStatus: Record<string, number>;
  avgUnitsPerPartner: number;
}

export interface MomentumSignalData {
  risingCount: number;
  fallingCount: number;
  stableCount: number;
  topSignals: { orgName: string; trend: string; score: number }[];
}

export interface HumanImpactReport {
  execSummary: ExecSummaryData;
  communityImpact: CommunityImpactData;
  journeyGrowth: JourneyGrowthData;
  supportDelivered: SupportDeliveredData;
  momentumSignals: MomentumSignalData;
}

// ── Deterministic narrative builder ──

function buildExecNarrative(d: {
  partnersActive: number;
  eventsAttended: number;
  careProvided: number;
  newRelationships: number;
  trend: string;
}): string {
  const parts: string[] = [];

  if (d.partnersActive > 0) {
    parts.push(`We are actively walking alongside ${d.partnersActive} partner organizations`);
  }

  if (d.newRelationships > 0) {
    parts.push(`welcoming ${d.newRelationships} new relationships this month`);
  }

  if (d.eventsAttended > 0) {
    parts.push(`and were present at ${d.eventsAttended} community events`);
  }

  if (d.careProvided > 0) {
    parts.push(`recording ${d.careProvided.toLocaleString()} moments of care`);
  }

  const trendText = d.trend === 'rising'
    ? 'Momentum continues to build across our territories.'
    : d.trend === 'declining'
      ? 'Some territories are quieter this period — a natural rhythm in relationship work.'
      : 'Activity is holding steady across our communities.';

  return parts.length > 0
    ? `${parts.join(', ')}. ${trendText}`
    : trendText || 'Your movement story is just beginning.';
}

// ── Hook ──

interface UseHumanImpactOptions {
  regionId?: string;
  metroId?: string;
}

export function useHumanImpactData(opts?: UseHumanImpactOptions) {
  const { data: opportunities } = useOpportunities();
  const { data: anchors } = useAnchors();
  const { data: events } = useEvents();
  const { data: metros } = useMetros();
  const { data: regions } = useRegions();
  const { data: pipeline } = useAnchorPipeline();
  const { data: provisions } = useProvisions();

  // Momentum data (lightweight — counts only)
  const { data: momentumRows } = useQuery({
    queryKey: ['report-momentum'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('relationship_momentum')
        .select('opportunity_id, score, trend')
        .limit(500);
      if (error) throw error;
      return (data || []) as unknown as { opportunity_id: string; score: number; trend: string }[];
    },
  });

  // Narrative headlines (safe — no raw text)
  const { data: narrativeRows } = useQuery({
    queryKey: ['report-narratives', opts?.metroId, opts?.regionId],
    queryFn: async () => {
      let q = supabase
        .from('metro_narratives')
        .select('metro_id, narrative_json')
        .order('created_at', { ascending: false })
        .limit(50);
      if (opts?.metroId) q = q.eq('metro_id', opts.metroId);
      const { data, error } = await q;
      if (error) throw error;
      return data as { metro_id: string; narrative_json: any }[];
    },
  });

  // Local Pulse events count
  const { data: pulseCount } = useQuery({
    queryKey: ['report-pulse-count', opts?.metroId],
    queryFn: async () => {
      let q = supabase
        .from('events')
        .select('id', { count: 'exact', head: true })
        .eq('is_local_pulse', true);
      if (opts?.metroId) q = q.eq('metro_id', opts.metroId);
      const { count, error } = await q;
      if (error) throw error;
      return count ?? 0;
    },
  });

  const isLoading = !opportunities || !events || !metros || !pipeline;

  const report = useMemo((): HumanImpactReport | null => {
    if (isLoading) return null;

    const today = new Date();
    const thirtyAgo = subDays(today, 30);

    // Filter by region/metro
    let filteredMetroIds: string[] | null = null;
    if (opts?.metroId) {
      filteredMetroIds = [opts.metroId];
    } else if (opts?.regionId && metros) {
      filteredMetroIds = metros.filter(m => m.region_id === opts.regionId).map(m => m.id);
    }

    const filterByMetro = <T extends { metro_id?: string | null }>(items: T[]): T[] => {
      if (!filteredMetroIds) return items;
      return items.filter(i => i.metro_id && filteredMetroIds!.includes(i.metro_id));
    };

    const filteredOpps = filterByMetro(opportunities || []);
    const filteredEvents = filterByMetro(events || []);
    const filteredPipeline = filterByMetro(pipeline || []);
    const filteredProvisions = filterByMetro(provisions || []);

    // ── Exec Summary ──
    const activeOpps = filteredOpps.filter(o => o.status === 'Active');
    const attendedEvents = filteredEvents.filter(e => e.attended);
    const newRelationships = filteredOpps.filter(o => {
      if (!o.created_at) return false;
      return isAfter(parseISO(o.created_at), thirtyAgo);
    }).length;

    const totalCare = filteredProvisions.reduce((sum, p) => sum + (p.total_quantity || 0), 0);

    // Momentum trend — simple majority
    const rising = (momentumRows || []).filter(m => m.trend === 'rising').length;
    const falling = (momentumRows || []).filter(m => m.trend === 'falling').length;
    const trend: 'rising' | 'steady' | 'declining' =
      rising > falling * 2 ? 'rising' : falling > rising * 2 ? 'declining' : 'steady';

    const execSummary: ExecSummaryData = {
      partnersActive: activeOpps.length,
      careProvided: totalCare,
      eventsAttended: attendedEvents.length,
      newRelationships,
      territoriesActivated: 0, // filled from territories hook if available
      momentumTrend: trend,
      narrativeSummary: buildExecNarrative({
        partnersActive: activeOpps.length,
        eventsAttended: attendedEvents.length,
        careProvided: totalCare,
        newRelationships,
        trend,
      }),
    };

    // ── Community Impact ──
    // PRIVACY: Only extract headline + community_story fields — no raw text
    const themes: string[] = [];
    const snippets: string[] = [];
    (narrativeRows || []).forEach(n => {
      try {
        const json = typeof n.narrative_json === 'string' ? JSON.parse(n.narrative_json) : n.narrative_json;
        if (json?.headline && typeof json.headline === 'string') {
          snippets.push(json.headline);
        }
        if (Array.isArray(json?.emerging_patterns)) {
          themes.push(...json.emerging_patterns.slice(0, 3));
        }
      } catch { /* skip malformed */ }
    });

    const communityImpact: CommunityImpactData = {
      themes: [...new Set(themes)].slice(0, 8),
      signalCount: themes.length,
      eventsParticipated: attendedEvents.length,
      localPulseCount: pulseCount ?? 0,
      narrativeSnippets: snippets.slice(0, 5),
    };

    // ── Journey Growth ──
    const allItems = [
      ...filteredOpps.filter(o => o.status === 'Active').map(o => ({ stage: o.stage })),
      ...filteredPipeline.map(p => ({ stage: p.stage })),
    ];

    const chapterColors = CHAPTER_COLORS;
    const chapters = JOURNEY_KANBAN_CHAPTERS.map(ch => ({
      chapter: ch,
      count: allItems.filter(i => toChapterLabel(i.stage) === ch).length,
      color: chapterColors[ch] || 'hsl(0,0%,50%)',
    }));

    const journeyGrowth: JourneyGrowthData = {
      chapters,
      totalActive: allItems.length,
    };

    // ── Support Delivered ──
    const byStatus: Record<string, number> = {};
    (filteredProvisions || []).forEach(p => {
      byStatus[p.status] = (byStatus[p.status] || 0) + 1;
    });

    const supportDelivered: SupportDeliveredData = {
      totalUnits: totalCare,
      totalProvisions: (filteredProvisions || []).length,
      byStatus,
      avgUnitsPerPartner: activeOpps.length > 0 ? Math.round(totalCare / activeOpps.length) : 0,
    };

    // ── Momentum Signals ──
    const oppMap = new Map((filteredOpps || []).map(o => [o.id, o.organization]));
    const topSignals = (momentumRows || [])
      .filter(m => oppMap.has(m.opportunity_id))
      .sort((a, b) => b.score - a.score)
      .slice(0, 6)
      .map(m => ({
        orgName: oppMap.get(m.opportunity_id) || 'Unknown',
        trend: m.trend,
        score: m.score,
      }));

    const momentumSignals: MomentumSignalData = {
      risingCount: rising,
      fallingCount: falling,
      stableCount: (momentumRows || []).filter(m => m.trend === 'stable').length,
      topSignals,
    };

    return { execSummary, communityImpact, journeyGrowth, supportDelivered, momentumSignals };
  }, [opportunities, anchors, events, metros, pipeline, provisions, momentumRows, narrativeRows, pulseCount, opts?.regionId, opts?.metroId, isLoading]);

  return { isLoading, report, regions, metros };
}
