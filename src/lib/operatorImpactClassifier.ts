/**
 * operatorImpactClassifier — Deterministic severity classification for error desk.
 *
 * WHAT: Rules-based classifier that assigns impact level to operator errors.
 * WHERE: Used in Error Desk UI to show blocking badges.
 * WHY: Helps operator focus on issues that affect critical user flows.
 */

export type ImpactLevel = 'high' | 'normal' | 'low';

const HIGH_ROUTE_KEYWORDS = [
  'onboarding', 'checkout', 'campaign-send', 'migration-commit',
  'provision-create', 'auth', 'login', 'signup', 'stripe',
];

interface ErrorRecord {
  severity: string;
  context: Record<string, unknown>;
  count: number;
  first_seen_at: string;
  last_seen_at: string;
}

export function classifyImpact(error: ErrorRecord): ImpactLevel {
  const route = (error.context?.route as string) || '';
  const status = (error.context?.status as number) || 0;

  // HIGH: critical route, 5xx, or high occurrence
  if (HIGH_ROUTE_KEYWORDS.some(k => route.includes(k))) return 'high';
  if (status >= 500) return 'high';
  if (error.severity === 'high') return 'high';

  // Check frequency: >10 in last 24h approximation
  const hoursSinceFirst = (Date.now() - new Date(error.first_seen_at).getTime()) / 3_600_000;
  const ratePerDay = hoursSinceFirst > 0 ? (error.count / hoursSinceFirst) * 24 : error.count;
  if (ratePerDay > 10) return 'high';

  // NORMAL: repeated 400s
  if (status >= 400 && error.count > 1) return 'normal';

  // LOW: single occurrence, UI warnings
  if (error.count <= 1) return 'low';

  return 'normal';
}

/**
 * Check if an error looks auto-resolvable (no occurrences in 7 days).
 */
export function isAutoResolvable(error: ErrorRecord): boolean {
  const daysSinceLastSeen = (Date.now() - new Date(error.last_seen_at).getTime()) / 86_400_000;
  return daysSinceLastSeen >= 7 && error.severity !== 'high';
}
