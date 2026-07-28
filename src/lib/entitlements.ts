/**
 * Entitlement enforcement utilities.
 *
 * WHAT: Pure functions to check entitlement limits.
 * WHERE: Used in invite flows, AI dispatch, pulse scheduling, NRI rollups.
 * WHY: Centralized guard logic so enforcement is consistent across the app.
 */

/** Per-user AI rates by plan key (matches operator_ai_budget defaults) */
const AI_RATES_PER_USER = {
  core: { calls: 30, tokens: 50_000 },
  insight: { calls: 60, tokens: 100_000 },
  story: { calls: 100, tokens: 200_000 },
} as const;

/** Pulse run quotas by tier */
const PULSE_QUOTAS = {
  base: { runs: 4, articles: 200 },
  expanded: { runs: 30, articles: 2_000 },
} as const;

/** NRI quotas by tier */
const NRI_QUOTAS = {
  standard: { rollups: 4, flags: 50 },
  advanced: { rollups: 30, flags: 500 },
} as const;

const AI_QUOTAS = {
  base: { calls: 200, tokens: 500_000 },
  expanded: { calls: 600, tokens: 1_500_000 },
} as const;

export function getAIQuota(aiTier: 'base' | 'expanded') {
  return AI_QUOTAS[aiTier];
}

/** Compute dynamic AI quota based on plan + active user count */
export function getDynamicAIQuota(
  planKey: string,
  activeUsers: number,
  bonusCalls: number = 0,
  bonusTokens: number = 0,
): { calls: number; tokens: number } {
  const rates = AI_RATES_PER_USER[planKey as keyof typeof AI_RATES_PER_USER] ?? AI_RATES_PER_USER.core;
  const users = Math.max(activeUsers, 1);
  return {
    calls: (rates.calls * users) + bonusCalls,
    tokens: (rates.tokens * users) + bonusTokens,
  };
}

export function canRunAI(
  aiTier: 'base' | 'expanded',
  currentCalls: number,
  currentTokens: number,
  dynamicQuota?: { calls: number; tokens: number },
): { allowed: boolean; warning?: boolean; message?: string } {
  const quota = dynamicQuota ?? AI_QUOTAS[aiTier];
  const callPct = quota.calls > 0 ? currentCalls / quota.calls : 0;
  const tokenPct = quota.tokens > 0 ? currentTokens / quota.tokens : 0;
  const maxPct = Math.max(callPct, tokenPct);

  if (maxPct >= 1) {
    return { allowed: false, message: "This month's AI usage pool has been reached. Consider expanding your AI capacity." };
  }
  if (maxPct >= 0.8) {
    return { allowed: true, warning: true, message: "AI usage is near this month's pool." };
  }
  return { allowed: true };
}

export function getPulseQuota(pulseTier: 'base' | 'expanded') {
  return PULSE_QUOTAS[pulseTier];
}

export function canRunPulse(
  pulseTier: 'base' | 'expanded',
  currentRuns: number,
): { allowed: boolean; message?: string } {
  const quota = PULSE_QUOTAS[pulseTier];
  if (currentRuns >= quota.runs) {
    return { allowed: false, message: "Local Pulse run limit reached this period." };
  }
  return { allowed: true };
}

export function getNRIQuota(nriTier: 'standard' | 'advanced') {
  return NRI_QUOTAS[nriTier];
}

export function canRunAdvancedNRI(nriTier: 'standard' | 'advanced'): boolean {
  return nriTier === 'advanced';
}

/** Usage percentage helper for UI bars */
export function usagePct(current: number, limit: number): number {
  if (limit <= 0) return 0;
  return Math.min(Math.round((current / limit) * 100), 100);
}
