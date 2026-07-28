/**
 * movementWindow — Centralized time-period resolver for Movement Intelligence.
 *
 * WHAT: Returns a unified { periodStart, periodEnd, label } for all dashboard queries.
 * WHERE: useMovementIntelligence, Compass, Providence, NRI layers.
 * WHY: Prevents drift between sections using different date ranges.
 */

import { subDays, startOfDay, format } from 'date-fns';

export interface MovementWindow {
  /** ISO string — start of the period (inclusive) */
  periodStart: string;
  /** ISO string — end of the period (now) */
  periodEnd: string;
  /** Human-readable label, e.g. "Last 30 Days" */
  label: string;
  /** Number of days in the window */
  days: number;
}

export type MovementWindowPreset = 30 | 60 | 90;

/**
 * Returns a unified movement window.
 * Default is 30 days. All dashboard sections MUST consume this
 * instead of computing their own date ranges.
 */
export function getMovementWindow(days: MovementWindowPreset = 30): MovementWindow {
  const now = new Date();
  const start = startOfDay(subDays(now, days));

  return {
    periodStart: start.toISOString(),
    periodEnd: now.toISOString(),
    label: `Last ${days} Days`,
    days,
  };
}

/** Dev-only performance warning helper */
export function logPerformanceWarning(label: string, durationMs: number, thresholdMs = 800) {
  if (import.meta.env.DEV && durationMs > thresholdMs) {
    console.warn(
      `[Movement Intelligence] ⚠ ${label} took ${durationMs}ms (threshold: ${thresholdMs}ms)`
    );
  }
}
