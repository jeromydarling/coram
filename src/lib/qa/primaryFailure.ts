/**
 * primaryFailure — Deterministic primary/cascading failure detection for QA runs.
 *
 * WHAT: Identifies the first true failure in a run timeline and separates cascading steps.
 * WHERE: Used by QA prompt builder to produce root-cause-targeted repair prompts.
 * WHY: Prevents misleading prompts that focus on downstream symptoms instead of root cause.
 */

export interface QAStep {
  step_key: string;
  label: string;
  status: string;
  url: string | null;
  screenshot_path: string | null;
  console_errors: unknown[];
  page_errors: unknown[];
  network_failures: unknown[];
  notes: string | null;
}

export interface PrimaryFailureResult {
  step: QAStep;
  index: number;
}

export interface CascadingStep {
  step: QAStep;
  index: number;
}

/**
 * Returns the earliest failed step with an error signal.
 * A step is a candidate if status === 'failed' AND it has any error evidence.
 */
export function getPrimaryFailure(steps: QAStep[]): PrimaryFailureResult | null {
  for (let i = 0; i < steps.length; i++) {
    const s = steps[i];
    if (s.status !== 'failed') continue;
    const hasError =
      (s.console_errors?.length ?? 0) > 0 ||
      (s.page_errors?.length ?? 0) > 0 ||
      (s.network_failures?.length ?? 0) > 0 ||
      !!s.notes;
    if (hasError) return { step: s, index: i };
  }
  // Fallback: first failed step even without evidence
  for (let i = 0; i < steps.length; i++) {
    if (steps[i].status === 'failed') return { step: steps[i], index: i };
  }
  return null;
}

/**
 * All steps after primaryIndex that are failed or skipped.
 */
export function getCascadingFailures(steps: QAStep[], primaryIndex: number): CascadingStep[] {
  const result: CascadingStep[] = [];
  for (let i = primaryIndex + 1; i < steps.length; i++) {
    if (steps[i].status === 'failed' || steps[i].status === 'skipped') {
      result.push({ step: steps[i], index: i });
    }
  }
  return result;
}
