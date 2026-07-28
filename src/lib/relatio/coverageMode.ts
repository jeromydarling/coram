/**
 * Coverage Mode Engine — Evaluates imported data to assign honest coverage modes.
 *
 * WHAT: Analyzes import results and determines Mode A/B/C for narrative seed allowance.
 * WHERE: Called after any Relatio import pipeline completes.
 * WHY: Prevents fabricated narrative from thin data. Human-first honesty.
 */

export type CoverageMode = 'A' | 'B' | 'C';

export interface ImportDataProfile {
  contactCount: number;
  partnerCount: number;
  householdCount: number;
  hasNotes: boolean;
  hasTasks: boolean;
  hasLastContacted: boolean;
  hasEvents: boolean;
  hasActivities: boolean;
  hasAttendance: boolean;
  hasVolunteerHistory: boolean;
}

export interface CoverageResult {
  coverageMode: CoverageMode;
  contactCount: number;
  partnerCount: number;
  householdCount: number;
  hasNotes: boolean;
  hasEvents: boolean;
  hasActivities: boolean;
  adoptionMomentumScore: number;
  allowedSeeds: string[];
  disallowedSeeds: string[];
}

// ── Allowed seeds per mode ──────────────────────────────────
const MODE_A_SEEDS = [
  'relatio_import:contacts_imported',
  'relatio_import:partners_imported',
  'relatio_import:households_detected',
] as const;

const MODE_B_SEEDS = [
  ...MODE_A_SEEDS,
  'relatio_import:legacy_relationships',
  'relatio_import:dormancy_distribution',
  'relatio_import:touchpoints_detected',
] as const;

const MODE_C_SEEDS = [
  ...MODE_B_SEEDS,
  'relatio_import:volunteer_base_detected',
  'relatio_import:event_history_detected',
  'relatio_import:testimonium_seed',
] as const;

const NEVER_ALLOWED_MODE_A = [
  'drift_signal',
  'reconnection_signal',
  'narrative_momentum',
  'testimonium_seed',
];

/**
 * Determine coverage mode from import data profile.
 */
export function determineCoverageMode(profile: ImportDataProfile): CoverageMode {
  // MODE C: Full Relationship Spine — events OR activities OR attendance OR volunteer history
  if (profile.hasEvents || profile.hasActivities || profile.hasAttendance || profile.hasVolunteerHistory) {
    return 'C';
  }

  // MODE B: Light History — notes OR tasks OR last_contacted present
  if (profile.hasNotes || profile.hasTasks || profile.hasLastContacted) {
    return 'B';
  }

  // MODE A: Structure Only — contacts exist but no historical activity
  return 'A';
}

/**
 * Calculate adoption momentum score (0–100).
 */
export function calculateAdoptionMomentum(profile: ImportDataProfile): number {
  let score = 0;

  if (profile.contactCount > 0) score += 10;
  if (profile.householdCount > 0) score += 15;
  if (profile.hasNotes || profile.hasTasks || profile.hasLastContacted) score += 25;
  if (profile.hasEvents || profile.hasAttendance) score += 35;
  if (profile.hasVolunteerHistory) score += 20;

  return Math.min(score, 100);
}

/**
 * Get allowed and disallowed seed types for a coverage mode.
 */
function getSeedsForMode(mode: CoverageMode): { allowed: string[]; disallowed: string[] } {
  switch (mode) {
    case 'A':
      return {
        allowed: [...MODE_A_SEEDS],
        disallowed: NEVER_ALLOWED_MODE_A,
      };
    case 'B':
      return {
        allowed: [...MODE_B_SEEDS],
        disallowed: ['testimonium_seed'],
      };
    case 'C':
      return {
        allowed: [...MODE_C_SEEDS],
        disallowed: [],
      };
  }
}

/**
 * Get suggested playbook slugs based on coverage mode.
 */
export function getSuggestedPlaybooks(mode: CoverageMode): { slug: string; title: string }[] {
  switch (mode) {
    case 'A':
      return [
        { slug: 'visitor-mode-quick-start', title: 'Visitor Mode Quick Start' },
        { slug: 'email-intake-dissemination', title: 'Email Intake Dissemination Guide' },
      ];
    case 'B':
      return [
        { slug: 'dormant-relationship-recovery', title: 'Dormant Relationship Recovery' },
        { slug: 'visitor-mode-quick-start', title: 'Visitor Mode Quick Start' },
      ];
    case 'C':
      return [
        { slug: 'momentum-activation', title: 'Momentum Activation' },
        { slug: 'dormant-relationship-recovery', title: 'Dormant Relationship Recovery' },
      ];
  }
}

/**
 * Get calm, human-first narrative summary for an import notice.
 */
export function getImportNarrativeSummary(mode: CoverageMode, profile: ImportDataProfile): string {
  switch (mode) {
    case 'A':
      return `${profile.contactCount} people recognized during import. We received structure — names, roles, and connections — but no historical activity. This organization's story begins now.`;
    case 'B':
      return `${profile.contactCount} people recognized, with legacy relationship signals detected. Notes and touchpoints suggest existing relationships that can be gently reawakened.`;
    case 'C':
      return `${profile.contactCount} people recognized with historical rhythm — events, activities, and community presence. This organization already has momentum worth celebrating.`;
  }
}

/**
 * Full coverage evaluation — the main entry point after import.
 */
export function evaluateCoverage(profile: ImportDataProfile): CoverageResult {
  const mode = determineCoverageMode(profile);
  const momentum = calculateAdoptionMomentum(profile);
  const seeds = getSeedsForMode(mode);

  return {
    coverageMode: mode,
    contactCount: profile.contactCount,
    partnerCount: profile.partnerCount,
    householdCount: profile.householdCount,
    hasNotes: profile.hasNotes,
    hasEvents: profile.hasEvents,
    hasActivities: profile.hasActivities,
    adoptionMomentumScore: momentum,
    allowedSeeds: seeds.allowed,
    disallowedSeeds: seeds.disallowed,
  };
}

/**
 * Generate an aggregate testimonium seed event (never per-contact).
 * Only allowed for Mode B and C.
 */
export function buildTestimoniumSeed(
  mode: CoverageMode,
  profile: ImportDataProfile
): { event_kind: string; summary: string; source_module: string; metadata: Record<string, unknown> } | null {
  if (mode === 'A') return null; // Not allowed for structure-only imports

  return {
    event_kind: 'relatio_import_summary',
    summary: `${profile.contactCount} people recognized during import.`,
    source_module: 'relatio_import',
    metadata: {
      coverage_mode: mode,
      origin: 'relatio_import',
      confidence: 'derived',
      contact_count: profile.contactCount,
      partner_count: profile.partnerCount,
      household_count: profile.householdCount,
      has_events: profile.hasEvents,
      has_activities: profile.hasActivities,
      has_volunteer_history: profile.hasVolunteerHistory,
    },
  };
}
