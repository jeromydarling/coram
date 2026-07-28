/**
 * Deterministic-first signal logic with LLM escalation threshold.
 * 
 * Rules:
 * - Deterministic signals always emitted first
 * - LLM escalation ONLY if: changed=true AND confidence < threshold AND word_delta >= MIN_DELTA
 * - No LLM calls for empty/no-op diffs
 */

export interface EscalationInput {
  changed: boolean;
  baseline: boolean;
  confidence: number;
  wordDelta: number;
  rawTextLength: number;
}

export interface EscalationResult {
  shouldEscalate: boolean;
  reason: string;
  llmUsed: boolean;
}

const CONFIDENCE_THRESHOLD = parseFloat(
  (typeof Deno !== "undefined" ? Deno.env.get("WATCHLIST_LLM_CONFIDENCE_THRESHOLD") : undefined) || "0.7"
);
const MIN_WORD_DELTA = parseInt(
  (typeof Deno !== "undefined" ? Deno.env.get("WATCHLIST_LLM_MIN_WORD_DELTA") : undefined) || "50",
  10
);

export function evaluateEscalation(input: EscalationInput): EscalationResult {
  // No change → no LLM
  if (!input.changed) {
    return { shouldEscalate: false, reason: "no_change", llmUsed: false };
  }

  // Baseline (first snapshot) → no LLM
  if (input.baseline) {
    return { shouldEscalate: false, reason: "baseline_snapshot", llmUsed: false };
  }

  // Empty input → safe no-op
  if (input.rawTextLength === 0) {
    return { shouldEscalate: false, reason: "empty_input", llmUsed: false };
  }

  // High confidence → no LLM
  if (input.confidence >= CONFIDENCE_THRESHOLD) {
    return { shouldEscalate: false, reason: "high_confidence", llmUsed: false };
  }

  // Word delta too small → no LLM
  if (input.wordDelta < MIN_WORD_DELTA) {
    return { shouldEscalate: false, reason: "word_delta_below_threshold", llmUsed: false };
  }

  // Low confidence + significant word change → escalate to LLM
  return {
    shouldEscalate: true,
    reason: `confidence=${input.confidence}<${CONFIDENCE_THRESHOLD}, wordDelta=${input.wordDelta}>=${MIN_WORD_DELTA}`,
    llmUsed: false, // will be set to true by caller if LLM actually invoked
  };
}
