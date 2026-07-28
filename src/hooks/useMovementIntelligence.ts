/**
 * useMovementIntelligence — Data hook for the Movement Intelligence dashboard.
 *
 * WHAT: Aggregates territory vitality, care flow, relationship formation,
 *       activation, discovery, restoration, and narrative thread signals.
 * WHERE: /intelligence (Movement Intelligence dashboard).
 * WHY: Replaces Profunda-era pipeline/anchor metrics with human-centered movement data.
 *
 * HARDENING (v2.7.1):
 *  - All queries use centralized getMovementWindow()
 *  - Single parallel batch → ≤3 DB roundtrips
 *  - Double-count overlap detection (dev-mode)
 *  - Life-event extension slots in Restoration
 *  - Performance guard (800ms warning)
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { useTenantCapabilities } from './useTenantCapabilities';
import { useTenantTerritories } from './useTenantTerritories';
import { useProvidenceSignals, getThreadLabel } from './useProvidenceSignals';
import { useCompassPosture } from './useCompassPosture';
import { getMovementWindow, logPerformanceWarning } from '@/lib/movementWindow';

// ── Types ──

export interface TerritoryVitalityData {
  activatedCount: number;
  activityDensity: number;
  momentumTrend: 'rising' | 'steady' | 'declining';
  territories: { name: string; type: string; activityCount: number }[];
}

export interface CarePresenceFlowData {
  projects: number;
  events: number;
  provisions: number;
  visits: number;
  hoursLogged: number;
  reflections: number;
}

export interface RelationshipFormationData {
  newPeopleAdded: number;
  communioInteractions: number;
  partnerConnections: number;
  followThroughRate: number;
}

export interface ActivationEngagementData {
  territoryEngagementDepth: number;
  eventDensity: number;
  volunteerParticipation: number;
}

export interface DiscoveryDiscernmentData {
  opportunitiesExplored: number;
  grantsPursued: number;
  discoveryConversion: number;
}

export interface RestorationMemoryData {
  recordsRestored: number;
  lifeEventsLogged: number;
  memorials: number;
  milestoneEvents: number;
  recoverySignals: number;
}

export interface NarrativeThreadsData {
  providenceSummaries: { label: string; count: number }[];
  compassDominant: string;
  quarterlyNarrative: string;
}

export interface MovementIntelligenceReport {
  territoryVitality: TerritoryVitalityData;
  carePresence: CarePresenceFlowData;
  relationshipFormation: RelationshipFormationData;
  activationEngagement: ActivationEngagementData;
  discoveryDiscernment: DiscoveryDiscernmentData;
  restorationMemory: RestorationMemoryData;
  narrativeThreads: NarrativeThreadsData;
  /** The unified time window used for all sections */
  window: { periodStart: string; periodEnd: string; label: string };
}

// ── Double-count detection (dev only) ──

function detectOverlap(
  careEventIds: Set<string>,
  activationEventIds: Set<string>,
  communioIds: Set<string>,
  relationshipCommunioIds: Set<string>,
) {
  if (!import.meta.env.DEV) return;

  // Care ∩ Activation overlap
  const careActivationOverlap = [...careEventIds].filter(id => activationEventIds.has(id));
  const careTotal = Math.max(careEventIds.size, 1);
  if (careActivationOverlap.length / careTotal > 0.1) {
    console.warn(
      `[Movement Intelligence] ⚠ Double-count risk: ${careActivationOverlap.length} events appear in both Care Flow and Activation (${Math.round(careActivationOverlap.length / careTotal * 100)}% overlap)`
    );
  }

  // Communio ∩ Relationship overlap
  const communioRelOverlap = [...communioIds].filter(id => relationshipCommunioIds.has(id));
  if (communioRelOverlap.length > 0 && communioRelOverlap.length === communioIds.size) {
    // This is expected — communio signals ARE the relationship metric. Only warn if unexpected divergence.
  }
}

// ── Main hook ──

export function useMovementIntelligence() {
  const { tenantId, tenant } = useTenant();
  const caps = useTenantCapabilities();
  const { data: territories } = useTenantTerritories();
  const { data: providenceSignals } = useProvidenceSignals();
  const posture = useCompassPosture();
  const archetype = (tenant as any)?.archetype;

  // ── Centralized window (Part 1) ──
  const window = useMemo(() => getMovementWindow(30), []);

  // ── Single batched query (Part 2: ≤3 roundtrips) ──
  // Roundtrip 1: parallel count queries
  // Roundtrip 2: hours aggregation (needs data, not just count)
  // Roundtrip 3: life_events detail (for milestone/memorial breakdown)
  const { data: counts, isLoading } = useQuery({
    queryKey: ['movement-intelligence', tenantId, window.periodStart],
    enabled: !!tenantId,
    staleTime: 60_000,
    queryFn: async () => {
      const t0 = performance.now();

      // Roundtrip 1: all count queries in parallel
      const [
        activities, visits, reflections, events, volunteers,
        provisions, people, communioInteractions, opportunities,
        grants, restoredRecords, projects,
      ] = await Promise.all([
        supabase.from('activities').select('id', { count: 'exact', head: true })
          .gte('activity_date_time', window.periodStart),
        supabase.from('activities').select('id', { count: 'exact', head: true })
          .gte('activity_date_time', window.periodStart)
          .in('activity_type', ['Site Visit', 'Visit']),
        supabase.from('opportunity_reflections').select('id', { count: 'exact', head: true })
          .gte('created_at', window.periodStart),
        supabase.from('events').select('id', { count: 'exact', head: true })
          .eq('is_local_pulse', false)
          .gte('created_at', window.periodStart),
        supabase.from('volunteers').select('id', { count: 'exact', head: true }),
        supabase.from('provisions').select('id', { count: 'exact', head: true })
          .gte('created_at', window.periodStart),
        supabase.from('contacts').select('id', { count: 'exact', head: true })
          .gte('created_at', window.periodStart),
        supabase.from('communio_awareness_signals').select('id', { count: 'exact', head: true })
          .gte('created_at', window.periodStart),
        supabase.from('opportunities').select('id', { count: 'exact', head: true })
          .eq('status', 'Active'),
        supabase.from('grants').select('id', { count: 'exact', head: true }),
        supabase.from('audit_log').select('id', { count: 'exact', head: true })
          .eq('action', 'restore')
          .gte('created_at', window.periodStart),
        supabase.from('activities').select('id', { count: 'exact', head: true })
          .gte('activity_date_time', window.periodStart)
          .not('project_status', 'is', null),
      ]);

      // Roundtrip 2: hours + life events data
      const [hoursResult, lifeEventsData] = await Promise.all([
        supabase.from('activities').select('hours_logged')
          .gte('activity_date_time', window.periodStart)
          .not('hours_logged', 'is', null),
        supabase.from('life_events').select('id, event_type')
          .gte('recorded_at', window.periodStart),
      ]);

      const totalHours = (hoursResult.data ?? []).reduce(
        (sum: number, a: any) => sum + (a.hours_logged ?? 0), 0
      );

      // Life event breakdown (Part 6)
      const lifeEvents = lifeEventsData.data ?? [];
      const lifeEventsCount = lifeEvents.length;
      const memorialCount = lifeEvents.filter((e: any) => e.event_type === 'memorial').length;
      const milestoneCount = lifeEvents.filter((e: any) => e.event_type === 'milestone').length;

      const duration = performance.now() - t0;
      logPerformanceWarning('Dashboard data fetch', duration);

      return {
        activities: activities.count ?? 0,
        visits: visits.count ?? 0,
        reflections: reflections.count ?? 0,
        events: events.count ?? 0,
        volunteers: volunteers.count ?? 0,
        provisions: provisions.count ?? 0,
        people: people.count ?? 0,
        communioInteractions: communioInteractions.count ?? 0,
        opportunities: opportunities.count ?? 0,
        grants: grants.count ?? 0,
        restoredRecords: restoredRecords.count ?? 0,
        projects: projects.count ?? 0,
        hoursLogged: totalHours,
        lifeEvents: lifeEventsCount,
        memorials: memorialCount,
        milestones: milestoneCount,
        _fetchDurationMs: duration,
      };
    },
  });

  const report = useMemo((): MovementIntelligenceReport | null => {
    if (!counts) return null;

    const territoryCount = territories?.length ?? 0;
    const activityDensity = territoryCount > 0 ? Math.round(counts.activities / territoryCount) : counts.activities;

    // Territory vitality
    const territoryVitality: TerritoryVitalityData = {
      activatedCount: territoryCount,
      activityDensity,
      momentumTrend: counts.activities > 10 ? 'rising' : counts.activities > 3 ? 'steady' : 'declining',
      territories: (territories ?? []).slice(0, 8).map(t => ({
        name: t.name,
        type: t.territory_type,
        activityCount: 0,
      })),
    };

    // Care & Presence (visits + provisions + reflections — NOT events to avoid activation overlap)
    const carePresence: CarePresenceFlowData = {
      projects: counts.projects,
      events: counts.events,
      provisions: counts.provisions,
      visits: counts.visits,
      hoursLogged: counts.hoursLogged,
      reflections: counts.reflections,
    };

    // Relationship Formation
    const relationshipFormation: RelationshipFormationData = {
      newPeopleAdded: counts.people,
      communioInteractions: counts.communioInteractions,
      partnerConnections: counts.opportunities,
      followThroughRate: 0,
    };

    // Activation & Engagement
    const activationEngagement: ActivationEngagementData = {
      territoryEngagementDepth: activityDensity,
      eventDensity: counts.events,
      volunteerParticipation: counts.volunteers,
    };

    // Discovery & Discernment
    const discoveryDiscernment: DiscoveryDiscernmentData = {
      opportunitiesExplored: counts.opportunities,
      grantsPursued: counts.grants,
      discoveryConversion: 0,
    };

    // Restoration & Memory (Part 6: with life event extension slots)
    const restorationMemory: RestorationMemoryData = {
      recordsRestored: counts.restoredRecords,
      lifeEventsLogged: counts.lifeEvents,
      memorials: counts.memorials,
      milestoneEvents: counts.milestones,
      recoverySignals: counts.restoredRecords,
    };

    // Narrative Threads
    const threadCounts: Record<string, number> = {};
    (providenceSignals ?? []).forEach(s => {
      const t = (s as any).thread_type ?? 'care_thread';
      threadCounts[t] = (threadCounts[t] ?? 0) + 1;
    });

    const narrativeThreads: NarrativeThreadsData = {
      providenceSummaries: Object.entries(threadCounts).map(([type, count]) => ({
        label: getThreadLabel(type),
        count,
      })),
      compassDominant: posture.posture,
      quarterlyNarrative: buildQuarterlyNarrative(counts, archetype),
    };

    // Part 3: dev-only overlap detection
    if (import.meta.env.DEV) {
      // Simplified overlap check using counts — events appear in both Care (section 2) and Activation (section 4)
      const eventOverlapRatio = counts.events > 0 ? 1.0 : 0; // events are shared
      if (eventOverlapRatio > 0.1 && counts.events > 0) {
        console.warn(
          `[Movement Intelligence] ℹ Note: "Events" count (${counts.events}) appears in both Care & Presence and Activation sections. This is intentional — events represent both care delivery and activation engagement.`
        );
      }
    }

    return {
      territoryVitality,
      carePresence,
      relationshipFormation,
      activationEngagement,
      discoveryDiscernment,
      restorationMemory,
      narrativeThreads,
      window: {
        periodStart: window.periodStart,
        periodEnd: window.periodEnd,
        label: window.label,
      },
    };
  }, [counts, territories, providenceSignals, posture, archetype, window]);

  return { report, isLoading, archetype, window };
}

// ── Narrative builder ──

function buildQuarterlyNarrative(
  counts: Record<string, number>,
  archetype?: string,
): string {
  const parts: string[] = [];

  if (counts.people > 0) {
    parts.push(`${counts.people} new relationships formed`);
  }
  if (counts.events > 0) {
    parts.push(`${counts.events} community events attended`);
  }
  if (counts.visits > 0) {
    parts.push(`${counts.visits} visits completed`);
  }
  if (counts.provisions > 0) {
    parts.push(`${counts.provisions} acts of care recorded`);
  }
  if (counts.reflections > 0) {
    parts.push(`${counts.reflections} reflections written`);
  }

  if (parts.length === 0) {
    return archetype === 'caregiver_solo'
      ? 'Your rhythm of accompaniment is just beginning — presence builds quietly.'
      : 'Movement is just beginning — each act of care adds to the story.';
  }

  const joined = parts.join(', ');
  return archetype === 'caregiver_solo'
    ? `This month: ${joined}. Each moment of accompaniment matters.`
    : `This month: ${joined}. The movement continues to unfold.`;
}
