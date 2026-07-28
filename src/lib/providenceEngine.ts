/**
 * providenceEngine — Deterministic arc analysis + season classification.
 *
 * WHAT: Computes structural arc summary from tenant movement data, classifies season.
 * WHERE: Called by generate-providence edge function and useProvidenceReport hook.
 * WHY: Rule-driven synthesis of long-arc movement — AI is used ONLY for phrasing.
 */

// ── Types ──────────────────────────────────────────────────────

export type ProvidenceDirection = 'care' | 'expansion' | 'restoration' | 'steadfastness';

export interface DirectionMatrix {
  care: number;
  expansion: number;
  restoration: number;
  steadfastness: number;
}

export interface LifeEventCluster {
  eventType: string;
  count: number;
  isFirstOccurrence: boolean;
}

export interface RelationshipPattern {
  newEntities: number;
  dormantReactivations: number;
  closures: number;
  richnessUpgrades: number;
  journeyTransitions: number;
}

export interface TerritoryPattern {
  activations: number;
  firstSignalRegions: number;
  contractions: number;
}

export interface RhythmPattern {
  burstDays: number; // days with 5+ signals
  silenceDays: number; // longest streak of 0 signals
  steadyCadence: boolean; // low variance daily
}

export interface ArcSummary {
  directionMatrix: {
    d30: DirectionMatrix;
    d90: DirectionMatrix;
    d180: DirectionMatrix;
    d365: DirectionMatrix;
  };
  dominantDirection: ProvidenceDirection;
  shiftDetected: boolean;
  priorDominant: ProvidenceDirection | null;
  lifeEventClusters: LifeEventCluster[];
  relationshipPatterns: RelationshipPattern;
  territoryPatterns: TerritoryPattern;
  rhythmPatterns: RhythmPattern;
}

export interface SeasonClassification {
  seasonLabel: string;
  dominantDirection: ProvidenceDirection;
  classification: string;
}

// ── Direction inference helpers ─────────────────────────────────

const ACTIVITY_DIRECTION: Record<string, ProvidenceDirection> = {
  visit: 'care',
  meeting: 'care',
  phone_call: 'care',
  site_visit: 'care',
  note: 'care',
  email: 'expansion',
  referral: 'expansion',
  event: 'expansion',
  task: 'steadfastness',
  follow_up: 'steadfastness',
  proposal: 'steadfastness',
  presentation: 'steadfastness',
  reconnect: 'restoration',
  check_in: 'restoration',
};

function directionFromActivity(activityType: string): ProvidenceDirection {
  return ACTIVITY_DIRECTION[activityType] ?? 'care';
}

function emptyMatrix(): DirectionMatrix {
  return { care: 0, expansion: 0, restoration: 0, steadfastness: 0 };
}

function dominant(m: DirectionMatrix): ProvidenceDirection {
  const entries = Object.entries(m) as [ProvidenceDirection, number][];
  entries.sort((a, b) => b[1] - a[1]);
  return entries[0][0];
}

function dominance(m: DirectionMatrix): number {
  const total = m.care + m.expansion + m.restoration + m.steadfastness;
  if (total === 0) return 0;
  return Math.max(m.care, m.expansion, m.restoration, m.steadfastness) / total;
}

// ── Stage 1: Structural Arc Analysis ────────────────────────────

export interface RawSignals {
  activities: { activity_type: string; activity_date_time: string }[];
  lifeEvents: { event_type: string; event_date: string; entity_type: string }[];
  opportunities: {
    id: string;
    created_at: string;
    stage?: string;
    last_activity_date?: string;
    is_closed?: boolean;
  }[];
  reflections: { created_at: string }[];
  journeyTransitions: number;
  richnessUpgrades: number;
  dormantReactivations: number;
  closures: number;
  territoryActivations: number;
  firstSignalRegions: number;
  territoryContractions: number;
}

export function computeArcSummary(signals: RawSignals, periodEnd: Date): ArcSummary {
  const d30 = emptyMatrix();
  const d90 = emptyMatrix();
  const d180 = emptyMatrix();
  const d365 = emptyMatrix();

  const msPerDay = 86400000;
  const endMs = periodEnd.getTime();

  // Activity-based direction bucketing
  for (const a of signals.activities) {
    const dir = directionFromActivity(a.activity_type);
    const ageMs = endMs - new Date(a.activity_date_time).getTime();
    const ageDays = ageMs / msPerDay;
    if (ageDays <= 365) d365[dir]++;
    if (ageDays <= 180) d180[dir]++;
    if (ageDays <= 90) d90[dir]++;
    if (ageDays <= 30) d30[dir]++;
  }

  // Reflections count as care
  for (const r of signals.reflections) {
    const ageDays = (endMs - new Date(r.created_at).getTime()) / msPerDay;
    if (ageDays <= 365) d365.care++;
    if (ageDays <= 180) d180.care++;
    if (ageDays <= 90) d90.care++;
    if (ageDays <= 30) d30.care++;
  }

  const dominantDirection = dominant(d90);
  const priorDominant = dominant(d365);
  const shiftDetected = dominantDirection !== priorDominant && dominance(d90) > 0.4;

  // Life event clusters
  const eventCounts: Record<string, number> = {};
  const allEventTypes = new Set<string>();
  const recentEventTypes = new Set<string>();

  for (const le of signals.lifeEvents) {
    const ageDays = (endMs - new Date(le.event_date).getTime()) / msPerDay;
    allEventTypes.add(le.event_type);
    if (ageDays <= 30) {
      eventCounts[le.event_type] = (eventCounts[le.event_type] || 0) + 1;
      recentEventTypes.add(le.event_type);
    }
  }

  // First occurrences = types that appear in last 30d but not before
  const olderTypes = new Set(
    signals.lifeEvents
      .filter(le => (endMs - new Date(le.event_date).getTime()) / msPerDay > 30)
      .map(le => le.event_type)
  );

  const lifeEventClusters: LifeEventCluster[] = Object.entries(eventCounts)
    .filter(([_, count]) => count >= 3)
    .map(([eventType, count]) => ({
      eventType,
      count,
      isFirstOccurrence: !olderTypes.has(eventType),
    }));

  // Rhythm patterns
  const dailyBuckets: Record<string, number> = {};
  for (const a of signals.activities) {
    const day = a.activity_date_time.slice(0, 10);
    dailyBuckets[day] = (dailyBuckets[day] || 0) + 1;
  }

  const dayCounts = Object.values(dailyBuckets);
  const burstDays = dayCounts.filter(c => c >= 5).length;

  // Silence detection (longest gap in last 90 days)
  const last90 = signals.activities
    .filter(a => (endMs - new Date(a.activity_date_time).getTime()) / msPerDay <= 90)
    .map(a => new Date(a.activity_date_time).getTime())
    .sort();
  let maxGap = 0;
  for (let i = 1; i < last90.length; i++) {
    const gap = (last90[i] - last90[i - 1]) / msPerDay;
    if (gap > maxGap) maxGap = gap;
  }

  const mean = dayCounts.length ? dayCounts.reduce((s, c) => s + c, 0) / dayCounts.length : 0;
  const variance = dayCounts.length
    ? dayCounts.reduce((s, c) => s + (c - mean) ** 2, 0) / dayCounts.length
    : 0;
  const steadyCadence = dayCounts.length >= 14 && variance < mean * 2;

  return {
    directionMatrix: { d30, d90, d180, d365 },
    dominantDirection,
    shiftDetected,
    priorDominant: shiftDetected ? priorDominant : null,
    lifeEventClusters,
    relationshipPatterns: {
      newEntities: signals.opportunities.filter(
        o => (endMs - new Date(o.created_at).getTime()) / msPerDay <= 90
      ).length,
      dormantReactivations: signals.dormantReactivations,
      closures: signals.closures,
      richnessUpgrades: signals.richnessUpgrades,
      journeyTransitions: signals.journeyTransitions,
    },
    territoryPatterns: {
      activations: signals.territoryActivations,
      firstSignalRegions: signals.firstSignalRegions,
      contractions: signals.territoryContractions,
    },
    rhythmPatterns: {
      burstDays,
      silenceDays: Math.round(maxGap),
      steadyCadence,
    },
  };
}

// ── Stage 2: Season Classification (rule-based) ─────────────────

export function classifySeason(arc: ArcSummary): SeasonClassification {
  const d = arc.dominantDirection;
  const d90 = arc.directionMatrix.d90;
  const total90 = d90.care + d90.expansion + d90.restoration + d90.steadfastness;
  const pct = total90 > 0 ? d90[d] / total90 : 0;

  const hasDeathCluster = arc.lifeEventClusters.some(c => c.eventType === 'death');
  const hasLossCluster = arc.lifeEventClusters.some(
    c => c.eventType === 'loss' || c.eventType === 'departure'
  );

  // Threshold Crossing — dominant direction shifted
  if (arc.shiftDetected && arc.priorDominant) {
    return {
      seasonLabel: `From ${capitalize(arc.priorDominant)} toward ${capitalize(d)}`,
      dominantDirection: d,
      classification: 'Threshold Crossing',
    };
  }

  // Restorative Season
  if (d === 'restoration' && pct > 0.5) {
    return {
      seasonLabel: 'A Season of Restoration',
      dominantDirection: d,
      classification: 'Restorative Season',
    };
  }
  if ((hasDeathCluster || hasLossCluster) && d90.restoration > d90.expansion) {
    return {
      seasonLabel: 'A Season of Restoration',
      dominantDirection: 'restoration',
      classification: 'Restorative Season',
    };
  }

  // Expansion Cycle
  if (d === 'expansion' && arc.territoryPatterns.activations > 0) {
    return {
      seasonLabel: 'An Expansion Cycle',
      dominantDirection: d,
      classification: 'Expansion Cycle',
    };
  }
  if (d === 'expansion' && arc.relationshipPatterns.newEntities >= 3) {
    return {
      seasonLabel: 'An Expansion Cycle',
      dominantDirection: d,
      classification: 'Expansion Cycle',
    };
  }

  // Quiet Faithfulness
  if (d === 'steadfastness' && pct > 0.45 && arc.rhythmPatterns.steadyCadence) {
    return {
      seasonLabel: 'Quiet Faithfulness',
      dominantDirection: d,
      classification: 'Quiet Faithfulness',
    };
  }

  // Deep Care
  if (d === 'care' && pct > 0.55) {
    return {
      seasonLabel: 'A Season of Deep Care',
      dominantDirection: d,
      classification: 'Deep Care',
    };
  }

  // Reawakening
  if (arc.relationshipPatterns.dormantReactivations >= 2) {
    return {
      seasonLabel: 'A Time of Reawakening',
      dominantDirection: 'restoration',
      classification: 'Reawakening',
    };
  }

  // Burst Season
  if (arc.rhythmPatterns.burstDays >= 5 && !arc.rhythmPatterns.steadyCadence) {
    return {
      seasonLabel: 'A Season of Intensity',
      dominantDirection: d,
      classification: 'Burst Season',
    };
  }

  // Default — Steady Movement
  return {
    seasonLabel: `A Season of ${capitalize(d)}`,
    dominantDirection: d,
    classification: 'Steady Movement',
  };
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
