/**
 * compassDirection — Pure utility for the Compass overlay.
 *
 * WHAT: Maps existing signal types to four directional movements (N/E/S/W).
 * WHERE: GardenPulsePage Compass overlay (Gardener-only).
 * WHY: Contemplative discernment lens — how movement flows, not where grace gathers (that's Providence).
 */

export type CompassDirection = 'north' | 'east' | 'south' | 'west';

export interface CompassWeight {
  north: number; // Narrative
  east: number;  // Discernment
  south: number; // Care
  west: number;  // Restoration
}

/** Signal-kind → compass direction mapping (pure, no side effects). */
const KIND_MAP: Record<string, CompassDirection> = {
  // NORTH — Narrative / Identity
  reflection: 'north',
  reflection_moment: 'north',
  ecosystem_reflection: 'north',
  voice_note: 'north',
  essay_published: 'north',
  nri_essay_published: 'north',
  testimonium: 'north',
  story_signal: 'north',
  marriage: 'north',
  ordination: 'north',
  graduation: 'north',
  anniversary: 'north',

  // EAST — Discernment / Becoming
  adoption_signal: 'east',
  momentum_signal: 'east',
  archetype_movement: 'east',
  community_growth: 'east',
  capacity_growth: 'east',
  nri_insight: 'east',
  friction_pattern: 'east',
  lumen_signal: 'east',
  milestone: 'east',
  sobriety_milestone: 'east',
  recovery: 'east',

  // SOUTH — Care / Presence
  visit: 'south',
  project: 'south',
  event_completed: 'south',
  provision: 'south',
  volunteer_participation: 'south',
  entity_created: 'south',
  collaboration_signal: 'south',
  birth: 'south',
  adoption: 'south',
  hospitalization: 'south',

  // WEST — Restoration / Return
  entity_restored: 'west',
  restore_success: 'west',
  recovery_ticket: 'west',
  relationship_restored: 'west',
  voice_returned: 'west',
  work_reopened: 'west',
  care_recovered: 'west',
  structure_restored: 'west',
  care_completed: 'west',
  retirement: 'west',
  death: 'west',
  relapse: 'west',
};

/** Derive compass direction from event/signal kind. Falls back to 'south' (care). */
export function buildCompassDirection(kind: string): CompassDirection {
  return KIND_MAP[kind] ?? 'south';
}

/** Aggregate an array of signal kinds into a weighted compass. */
export function buildCompassWeights(kinds: string[]): CompassWeight {
  const w: CompassWeight = { north: 0, east: 0, south: 0, west: 0 };
  for (const k of kinds) {
    w[buildCompassDirection(k)]++;
  }
  return w;
}

/** Orientation-aware weighting multipliers. */
const ORIENTATION_MULTIPLIERS: Record<string, Record<CompassDirection, number>> = {
  human_focused: { north: 1, east: 1, south: 2, west: 1 },      // visits/life_events amplified
  institution_focused: { north: 2, east: 2, south: 0.3, west: 1 }, // partner/grants amplified, life_events dampened
  hybrid: { north: 1, east: 1, south: 1, west: 1 },
};

/** Build compass weights adjusted for tenant relational orientation. */
export function buildOrientedWeights(
  kinds: string[],
  orientation: string = 'institution_focused'
): CompassWeight {
  const raw = buildCompassWeights(kinds);
  const mult = ORIENTATION_MULTIPLIERS[orientation] ?? ORIENTATION_MULTIPLIERS.hybrid;
  return {
    north: raw.north * mult.north,
    east: raw.east * mult.east,
    south: raw.south * mult.south,
    west: raw.west * mult.west,
  };
}

/** Find the dominant direction. */
export function dominantDirection(w: CompassWeight): CompassDirection {
  const entries = Object.entries(w) as [CompassDirection, number][];
  entries.sort((a, b) => b[1] - a[1]);
  return entries[0][0];
}

/** Narrative phrases for each direction — calm, Ignatian tone. */
export const COMPASS_NARRATIVES: Record<CompassDirection, string> = {
  north: 'Narrative gathers — reflections and stories are forming above.',
  east: 'Discernment stirs — signals of growth and clarity move forward.',
  south: 'Care deepens — visits, projects, and provision take root.',
  west: 'Restoration returns — what was lost is being reclaimed.',
};

/** CSS color tokens per direction (HSL-based, from design system). */
export const COMPASS_COLORS: Record<CompassDirection, string> = {
  north: 'hsl(var(--primary) / 0.25)',       // aurora / narrative
  east: 'hsl(var(--accent) / 0.2)',           // sunrise / discernment
  south: 'hsl(142 40% 55% / 0.2)',           // grounded green / care
  west: 'hsl(40 80% 60% / 0.2)',             // returning light / restoration
};

export const COMPASS_LABELS: Record<CompassDirection, string> = {
  north: 'Narrative',
  east: 'Discernment',
  south: 'Care',
  west: 'Restoration',
};
