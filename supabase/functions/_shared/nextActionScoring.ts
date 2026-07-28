/**
 * Next-Best-Action Scoring Engine
 * 
 * Deterministic scoring formula:
 *   score = (severity * 3) + (confidence * 2) + (predicted_success_rate * 4)
 *           - recency_penalty - dismissal_penalty
 *
 * predicted_success_rate:
 *   - From org_action_effectiveness_mv if available
 *   - Else default 0.35
 */

export interface NextActionInput {
  severity: number;       // 1–5
  confidence: number;     // 0–1
  predicted_success_rate: number | null;
  created_at: string;     // ISO
  dismissed_count?: number;
}

export interface ScoreResult {
  score: number;
  predicted_success_rate: number;
  breakdown: {
    severity_component: number;
    confidence_component: number;
    success_component: number;
    recency_penalty: number;
    dismissal_penalty: number;
  };
}

const DEFAULT_SUCCESS_RATE = 0.35;
const RECENCY_DECAY_DAYS = 30;
const MAX_RECENCY_PENALTY = 3;
const DISMISSAL_PENALTY_PER = 2;

export function computeScore(input: NextActionInput): ScoreResult {
  const psr = input.predicted_success_rate ?? DEFAULT_SUCCESS_RATE;
  
  const severity_component = input.severity * 3;
  const confidence_component = input.confidence * 2;
  const success_component = psr * 4;
  
  // Recency penalty: older actions get penalised
  const ageMs = Date.now() - new Date(input.created_at).getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  const recency_penalty = Math.min(
    MAX_RECENCY_PENALTY,
    (ageDays / RECENCY_DECAY_DAYS) * MAX_RECENCY_PENALTY
  );
  
  // Dismissal penalty
  const dismissal_penalty = (input.dismissed_count ?? 0) * DISMISSAL_PENALTY_PER;
  
  const score = Math.round(
    (severity_component + confidence_component + success_component - recency_penalty - dismissal_penalty) * 100
  ) / 100;

  return {
    score: Math.max(0, score),
    predicted_success_rate: psr,
    breakdown: {
      severity_component,
      confidence_component,
      success_component,
      recency_penalty: Math.round(recency_penalty * 100) / 100,
      dismissal_penalty,
    },
  };
}

/** Threshold for generating an alert */
export const ALERT_SCORE_THRESHOLD = 12;

export { DEFAULT_SUCCESS_RATE, RECENCY_DECAY_DAYS, MAX_RECENCY_PENALTY, DISMISSAL_PENALTY_PER };
