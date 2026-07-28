/**
 * signalHygiene — Signal filtering engine for operator console.
 *
 * WHAT: Filters operator signals to surface only meaningful, persistent patterns.
 * WHERE: Applied before rendering signals in Nexus or dispatching notifications.
 * WHY: Reduces noise; only shows signals with cross-surface persistence.
 */

export type SignalPriority = 'low' | 'medium' | 'high';

export interface HygieneInput {
  /** Impact score from source (0–100) */
  impactScore: number;
  /** How many times this signal pattern has fired recently */
  persistenceCount: number;
  /** Whether the signal appears across multiple surfaces/tenants */
  crossSurface: boolean;
  /** Signal category for classification */
  category?: string;
}

export interface HygieneResult {
  /** Whether the signal passes the hygiene filter */
  surfaced: boolean;
  /** Assigned priority */
  priority: SignalPriority;
  /** Human-readable reason for filtering decision */
  reason: string;
}

// ─── Thresholds ─────────────────────────────────────

const IMPACT_THRESHOLD = 15;
const PERSISTENCE_MIN = 2;

/** Categories that should always be suppressed unless persistent */
const TRANSIENT_CATEGORIES = new Set([
  'single_click_anomaly',
  'isolated_friction',
  'transient_api_warning',
  'page_view_spike',
]);

// ─── Core Filter ────────────────────────────────────

/**
 * Determine whether a signal should be surfaced and at what priority.
 *
 * Rules:
 * - impact_score must exceed threshold
 * - persistence_count must be >= 2 (not one-off)
 * - cross_surface must be true for high priority
 * - Transient categories are suppressed unless persistent
 */
export function filterSignal(input: HygieneInput): HygieneResult {
  // Always suppress known transient categories unless highly persistent
  if (input.category && TRANSIENT_CATEGORIES.has(input.category)) {
    if (input.persistenceCount < 3) {
      return { surfaced: false, priority: 'low', reason: 'Transient signal — not yet persistent' };
    }
  }

  // Impact check
  if (input.impactScore < IMPACT_THRESHOLD) {
    return { surfaced: false, priority: 'low', reason: 'Impact below threshold' };
  }

  // Persistence check
  if (input.persistenceCount < PERSISTENCE_MIN) {
    return { surfaced: false, priority: 'low', reason: 'Single occurrence — waiting for pattern' };
  }

  // Assign priority
  let priority: SignalPriority;
  if (input.impactScore >= 60 && input.crossSurface) {
    priority = 'high';
  } else if (input.impactScore >= 30 || input.crossSurface) {
    priority = 'medium';
  } else {
    priority = 'low';
  }

  return {
    surfaced: true,
    priority,
    reason: priority === 'high'
      ? 'Cross-surface pattern with high impact'
      : priority === 'medium'
        ? 'Persistent pattern worth noticing'
        : 'Emerging signal — gentle awareness',
  };
}

/**
 * Map signal priority to operator presence level for push/digest routing.
 */
export function priorityToPresence(priority: SignalPriority): 'silent' | 'gentle' | 'urgent' {
  switch (priority) {
    case 'high': return 'urgent';
    case 'medium': return 'gentle';
    case 'low': return 'silent';
  }
}
