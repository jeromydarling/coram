/**
 * missionRhythmRegistry — Archetype-aware panel visibility for Mission Rhythm + Reports.
 *
 * WHAT: Defines which dashboard panels appear based on tenant archetype, features, and data presence.
 * WHERE: Consumed by Dashboard (Mission Rhythm), Reports, and any analytics surface.
 * WHY: CROS tenants vary wildly — a parish doesn't need pipeline metrics, a workforce org doesn't need liturgical calendars.
 */

export type MissionPanelKey =
  | 'this_week_relationships'
  | 'this_week_visits'
  | 'this_week_reflections'
  | 'this_week_events'
  | 'this_week_volunteers'
  | 'this_week_provisions'
  | 'care_presence_trend'
  | 'care_presence_geography'
  | 'momentum_adoption'
  | 'momentum_vigilia'
  | 'discovery_signals'
  | 'discovery_communio'
  | 'legacy_anchors'
  | 'legacy_pipeline'
  | 'legacy_volume'
  | 'legacy_metro_readiness'
  | 'grants_overview'
  | 'grants_pipeline';

export interface MissionPanelConfig {
  key: MissionPanelKey;
  title: string;
  description: string;
  section: 'this_week' | 'care_presence' | 'momentum' | 'discovery' | 'legacy' | 'grants';
  requires?: {
    featureFlags?: string[];
    archetypes?: string[];          // if set, only these archetypes see it
    dataPresence?: string[];        // table names — panel hidden if all are empty
  };
  fallbackCopy: string;
}

export const MISSION_PANELS: MissionPanelConfig[] = [
  // ── This Week ──
  {
    key: 'this_week_relationships',
    title: 'Relationships Touched',
    description: 'Activities logged this week across all partners.',
    section: 'this_week',
    fallbackCopy: 'No activity yet this week. That is okay -- presence takes many forms.',
  },
  {
    key: 'this_week_visits',
    title: 'Visits Completed',
    description: 'Field visits and in-person encounters.',
    section: 'this_week',
    fallbackCopy: 'No visits this week.',
  },
  {
    key: 'this_week_reflections',
    title: 'Reflections Added',
    description: 'Personal reflections and journal entries.',
    section: 'this_week',
    fallbackCopy: 'No reflections yet. The quiet moments matter too.',
  },
  {
    key: 'this_week_events',
    title: 'Events',
    description: 'Community events hosted or attended.',
    section: 'this_week',
    fallbackCopy: 'No events this week.',
  },
  {
    key: 'this_week_volunteers',
    title: 'Volunteers Engaged',
    description: 'Volunteer hours and shifts logged.',
    section: 'this_week',
    requires: { featureFlags: ['voluntarium_basic'] },
    fallbackCopy: 'Volunteer tracking is available when you are ready.',
  },
  {
    key: 'this_week_provisions',
    title: 'Support Recorded',
    description: 'Care and support actions logged through Prōvīsiō.',
    section: 'this_week',
    requires: { featureFlags: ['provisio'] },
    fallbackCopy: 'No provisions this week.',
  },

  // ── Care & Presence ──
  {
    key: 'care_presence_trend',
    title: 'Presence',
    description: 'How your care rhythm is unfolding over time.',
    section: 'care_presence',
    fallbackCopy: 'Not enough data yet to show a trend. Keep going.',
  },
  {
    key: 'care_presence_geography',
    title: 'Where Care Happened',
    description: 'Geographic distribution of your presence.',
    section: 'care_presence',
    requires: { featureFlags: ['signum_baseline'] },
    fallbackCopy: 'Location data will appear as you log activities and events.',
  },

  // ── Momentum ──
  {
    key: 'momentum_adoption',
    title: 'Team Activity',
    description: 'How your team is engaging with the system.',
    section: 'momentum',
    fallbackCopy: 'Activity will appear as your team begins using CROS.',
  },
  {
    key: 'momentum_vigilia',
    title: 'Gentle Signals',
    description: 'Quiet patterns that may deserve attention.',
    section: 'momentum',
    requires: { featureFlags: ['drift_detection'] },
    fallbackCopy: 'No signals right now. Everything is at rest.',
  },

  // ── Discovery ──
  {
    key: 'discovery_signals',
    title: 'Discoveries This Week',
    description: 'New opportunities and signals from Signum.',
    section: 'discovery',
    requires: { featureFlags: ['signum_baseline'] },
    fallbackCopy: 'Discovery runs quietly in the background.',
  },
  {
    key: 'discovery_communio',
    title: 'Ecosystem Awareness',
    description: 'Signals stirring across your Communio network.',
    section: 'discovery',
    requires: { featureFlags: ['communio_opt_in'] },
    fallbackCopy: 'What is stirring across your Communio network.',
  },

  // ── Legacy (Profunda-specific) ──
  {
    key: 'legacy_anchors',
    title: 'Sustained Partners',
    description: 'Long-term producing relationships.',
    section: 'legacy',
    requires: { dataPresence: ['anchors'] },
    fallbackCopy: 'Not applicable for your organization type.',
  },
  {
    key: 'legacy_pipeline',
    title: 'Journey Pipeline',
    description: 'Opportunities moving through journey stages.',
    section: 'legacy',
    requires: { dataPresence: ['anchor_pipeline'] },
    fallbackCopy: 'Pipeline tracking is available when relevant.',
  },
  {
    key: 'legacy_volume',
    title: 'Volume Metrics',
    description: 'Monthly volume and production trends.',
    section: 'legacy',
    requires: { dataPresence: ['anchors'] },
    fallbackCopy: 'Volume tracking is not active.',
  },
  {
    key: 'legacy_metro_readiness',
    title: 'Metro Readiness',
    description: 'Geographic readiness for expansion.',
    section: 'legacy',
    requires: { featureFlags: ['signum_baseline'], dataPresence: ['metros'] },
    fallbackCopy: 'You can add Metros later if you grow beyond one region.',
  },

  // ── Grants ──
  {
    key: 'grants_overview',
    title: 'Grants Overview',
    description: 'Active grants and funding pipeline.',
    section: 'grants',
    requires: { dataPresence: ['grants'] },
    fallbackCopy: 'No grants tracked yet.',
  },
  {
    key: 'grants_pipeline',
    title: 'Grant Pipeline',
    description: 'Grants by stage and funder type.',
    section: 'grants',
    requires: { dataPresence: ['grants'] },
    fallbackCopy: 'Grant pipeline will appear when you add grants.',
  },
];

/**
 * Returns visible panels for a given section, filtered by capabilities.
 */
export function getVisiblePanels(
  section: MissionPanelConfig['section'],
  capabilities: {
    activeFeatures: string[];
    tablesWithData: string[];
    archetype?: string;
  },
): MissionPanelConfig[] {
  return MISSION_PANELS.filter(panel => {
    if (panel.section !== section) return false;

    const req = panel.requires;
    if (!req) return true;

    // Feature flag check
    if (req.featureFlags?.length) {
      const hasFeature = req.featureFlags.some(f => capabilities.activeFeatures.includes(f));
      if (!hasFeature) return false;
    }

    // Archetype check
    if (req.archetypes?.length && capabilities.archetype) {
      if (!req.archetypes.includes(capabilities.archetype)) return false;
    }

    // Data presence check
    if (req.dataPresence?.length) {
      const hasData = req.dataPresence.some(t => capabilities.tablesWithData.includes(t));
      if (!hasData) return false;
    }

    return true;
  });
}
