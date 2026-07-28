/**
 * sendLimitGuard — Shared send-limit safety for Gmail + Outlook.
 *
 * WHAT: Checks daily send counts against soft/hard limits before sending.
 * WHERE: Called by gmail-campaign-send and outlook-send before each batch.
 * WHY: Protects sender reputation by blocking risky sends.
 */

export interface SendLimitResult {
  allowed: boolean;
  warning: boolean;
  blocked: boolean;
  currentCount: number;
  dailyLimit: number;
  softThreshold: number;
  hardThreshold: number;
  message: string;
}

export interface SendLimitRow {
  id: string;
  tenant_id: string;
  provider: string;
  email_address: string;
  daily_limit: number;
  soft_limit: number; // percentage
  hard_limit: number; // percentage
  current_count: number;
  window_start: string;
}

// Default limits by provider
const PROVIDER_DEFAULTS: Record<string, { daily_limit: number; soft_limit: number; hard_limit: number }> = {
  gmail: { daily_limit: 2000, soft_limit: 60, hard_limit: 85 },
  outlook: { daily_limit: 300, soft_limit: 60, hard_limit: 85 },
};

/**
 * Evaluate whether sending is safe.
 * Returns status with warning/blocked state.
 */
export function evaluateSendLimit(
  row: SendLimitRow | null,
  provider: string,
  proposedCount: number = 1,
): SendLimitResult {
  const defaults = PROVIDER_DEFAULTS[provider] ?? PROVIDER_DEFAULTS.outlook;

  const dailyLimit = row?.daily_limit ?? defaults.daily_limit;
  const softPct = row?.soft_limit ?? defaults.soft_limit;
  const hardPct = row?.hard_limit ?? defaults.hard_limit;

  // Reset window if stale (not today)
  let currentCount = row?.current_count ?? 0;
  if (row?.window_start) {
    const windowDate = new Date(row.window_start).toISOString().slice(0, 10);
    const todayDate = new Date().toISOString().slice(0, 10);
    if (windowDate !== todayDate) {
      currentCount = 0;
    }
  }

  const softThreshold = Math.floor(dailyLimit * (softPct / 100));
  const hardThreshold = Math.floor(dailyLimit * (hardPct / 100));

  const afterSend = currentCount + proposedCount;

  if (afterSend >= hardThreshold) {
    return {
      allowed: false,
      warning: true,
      blocked: true,
      currentCount,
      dailyLimit,
      softThreshold,
      hardThreshold,
      message: `Sending blocked: ${currentCount}/${dailyLimit} sent today (${hardPct}% hard limit reached). Protect your account reputation.`,
    };
  }

  if (afterSend >= softThreshold) {
    return {
      allowed: true,
      warning: true,
      blocked: false,
      currentCount,
      dailyLimit,
      softThreshold,
      hardThreshold,
      message: `Warning: ${currentCount}/${dailyLimit} sent today. Approaching ${provider === 'outlook' ? "Microsoft's" : "Google's"} recommended daily limits.`,
    };
  }

  return {
    allowed: true,
    warning: false,
    blocked: false,
    currentCount,
    dailyLimit,
    softThreshold,
    hardThreshold,
    message: `Safe sending range: ${currentCount}/${dailyLimit} sent today.`,
  };
}
