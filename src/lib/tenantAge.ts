/**
 * tenantAge — Pure utility for tenant lifecycle awareness.
 *
 * WHAT: Derives tenant age in days and provides first-month / first-two-weeks predicates.
 * WHERE: Compass sensitivity calibration, foundational Providence trigger.
 * WHY: Days 0–30 use heightened interpretive sensitivity; day 31+ returns to stable baseline.
 *       All calibration is runtime-only — no flags, no stored state.
 */

import { differenceInDays, parseISO } from 'date-fns';

/** Returns the number of whole days since the tenant was created. */
export function getTenantAgeDays(createdAt: string): number {
  return differenceInDays(new Date(), parseISO(createdAt));
}

/** True during the first 30 calendar days (inclusive). */
export function isFirstMonth(createdAt: string): boolean {
  return getTenantAgeDays(createdAt) <= 30;
}

/** True during the first 14 calendar days (inclusive). */
export function isFirstTwoWeeks(createdAt: string): boolean {
  return getTenantAgeDays(createdAt) <= 14;
}

/** Weekly reflection prompts for dead-surface prevention (Phase E). */
export const FOUNDATIONAL_REFLECTION_PROMPTS = [
  'What feels most alive in your work right now?',
  'Who received the most of your attention this week?',
  'Is there one relationship worth deepening?',
  'What small moment mattered most recently?',
] as const;

/**
 * Returns a reflection prompt for the current week of month 1.
 * Returns null if the tenant is past day 30.
 */
export function getWeeklyReflectionPrompt(createdAt: string): string | null {
  const days = getTenantAgeDays(createdAt);
  if (days > 30) return null;
  const weekIndex = Math.floor(days / 7) % FOUNDATIONAL_REFLECTION_PROMPTS.length;
  return FOUNDATIONAL_REFLECTION_PROMPTS[weekIndex];
}
