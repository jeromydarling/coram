/**
 * Campaign Intelligence — Suppression & Ranking Logic
 * 
 * Deterministic rules:
 * - Suppress when success_rate < 0.15 AND total_actions >= 3
 * - Boost when success_rate >= 0.5 AND last_success_at within 30 days
 * - Otherwise: shown
 */

export interface EffectivenessRow {
  org_id: string;
  action_type: string;
  source: string;
  total_actions: number;
  successful_actions: number;
  success_rate: number;
  avg_confidence: number | null;
  last_success_at: string | null;
}

export interface SuggestionDecision {
  decision: 'shown' | 'suppressed' | 'boosted';
  reason: string;
}

const SUPPRESS_THRESHOLD = 0.15;
const SUPPRESS_MIN_ACTIONS = 3;
const BOOST_THRESHOLD = 0.5;
const BOOST_RECENCY_DAYS = 30;

export function evaluateSuggestion(
  orgId: string,
  effectivenessRows: EffectivenessRow[],
): SuggestionDecision {
  // Find gmail_campaign effectiveness for this org
  const row = effectivenessRows.find(
    (r) => r.org_id === orgId && r.action_type === 'gmail_campaign',
  );

  if (!row || row.total_actions < SUPPRESS_MIN_ACTIONS) {
    return { decision: 'shown', reason: 'Insufficient history for ranking' };
  }

  // Suppress: low success rate with enough data
  if (row.success_rate < SUPPRESS_THRESHOLD) {
    return {
      decision: 'suppressed',
      reason: `Low success rate (${(row.success_rate * 100).toFixed(0)}%) across ${row.total_actions} campaigns`,
    };
  }

  // Boost: high success rate + recent success
  if (row.success_rate >= BOOST_THRESHOLD && row.last_success_at) {
    const lastSuccess = new Date(row.last_success_at);
    const daysSince = (Date.now() - lastSuccess.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSince <= BOOST_RECENCY_DAYS) {
      return {
        decision: 'boosted',
        reason: `High success rate (${(row.success_rate * 100).toFixed(0)}%) with recent activity (${Math.round(daysSince)}d ago)`,
      };
    }
  }

  return {
    decision: 'shown',
    reason: `Success rate ${(row.success_rate * 100).toFixed(0)}% across ${row.total_actions} campaigns`,
  };
}

export const THRESHOLDS = {
  SUPPRESS_THRESHOLD,
  SUPPRESS_MIN_ACTIONS,
  BOOST_THRESHOLD,
  BOOST_RECENCY_DAYS,
};
