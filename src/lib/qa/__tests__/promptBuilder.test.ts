/**
 * QA Self-Healing Prompt — Unit Tests
 *
 * WHAT: Validates primary failure detection, nav expansion suggestions, cascading/independent classification.
 * WHERE: Vitest test suite.
 * WHY: Ensures repair prompts always target the correct root cause.
 */

import { describe, it, expect } from 'vitest';
import { getPrimaryFailure, getCascadingFailures, type QAStep } from '../primaryFailure';
import { classifyStepFailure } from '../failureClassifier';
import { buildSelfHealingPrompt } from '../promptBuilder';

function makeStep(overrides: Partial<QAStep> & { step_key: string; label: string; status: string }): QAStep {
  return {
    url: null,
    screenshot_path: null,
    console_errors: [],
    page_errors: [],
    network_failures: [],
    notes: null,
    ...overrides,
  };
}

describe('getPrimaryFailure', () => {
  it('chooses the earliest failed step', () => {
    const steps: QAStep[] = [
      makeStep({ step_key: 'login', label: 'Login', status: 'passed' }),
      makeStep({ step_key: 'dashboard', label: 'Dashboard', status: 'passed' }),
      makeStep({ step_key: 'open_opportunities', label: 'Open Opportunities', status: 'failed', notes: 'timeout waiting for selector' }),
      makeStep({ step_key: 'logout', label: 'Logout', status: 'failed', notes: 'selector parse error' }),
    ];
    const result = getPrimaryFailure(steps);
    expect(result).not.toBeNull();
    expect(result!.step.step_key).toBe('open_opportunities');
    expect(result!.index).toBe(2);
  });

  it('returns null when all steps pass', () => {
    const steps: QAStep[] = [
      makeStep({ step_key: 'login', label: 'Login', status: 'passed' }),
      makeStep({ step_key: 'dashboard', label: 'Dashboard', status: 'passed' }),
    ];
    expect(getPrimaryFailure(steps)).toBeNull();
  });
});

describe('getCascadingFailures', () => {
  it('returns failed/skipped steps after primary index', () => {
    const steps: QAStep[] = [
      makeStep({ step_key: 's1', label: 'S1', status: 'passed' }),
      makeStep({ step_key: 's2', label: 'S2', status: 'failed', notes: 'primary' }),
      makeStep({ step_key: 's3', label: 'S3', status: 'passed' }),
      makeStep({ step_key: 's4', label: 'S4', status: 'failed', notes: 'downstream' }),
      makeStep({ step_key: 's5', label: 'S5', status: 'skipped' }),
    ];
    const cascading = getCascadingFailures(steps, 1);
    expect(cascading).toHaveLength(2);
    expect(cascading[0].step.step_key).toBe('s4');
    expect(cascading[1].step.step_key).toBe('s5');
  });
});

describe('classifyStepFailure', () => {
  it('detects selector parse errors as independent', () => {
    const step = makeStep({
      step_key: 'logout',
      label: 'Logout',
      status: 'failed',
      notes: 'Error: page.click: Unexpected token "=" while parsing css selector "[data-testid="logout-button"]"',
    });
    const result = classifyStepFailure(step, 'cascading');
    expect(result.type).toBe('selector_parse');
    expect(result.isIndependent).toBe(true);
  });

  it('detects nav collapsible timeout', () => {
    const step = makeStep({
      step_key: 'open_opps',
      label: 'Open Opportunities',
      status: 'failed',
      notes: 'timeout waiting for [data-testid="nav-opportunities"]',
    });
    const result = classifyStepFailure(step, 'primary');
    expect(result.type).toBe('nav_collapsible');
    expect(result.explanation).toContain('Partners');
  });
});

describe('buildSelfHealingPrompt', () => {
  it('targets first failure as primary and includes nav expansion snippet', () => {
    const steps: QAStep[] = [
      makeStep({ step_key: 'login', label: 'Login', status: 'passed' }),
      makeStep({ step_key: 'dashboard', label: 'Dashboard Loads', status: 'passed' }),
      makeStep({
        step_key: 'open_opportunities',
        label: 'Open Opportunities',
        status: 'failed',
        notes: 'timeout waiting for [data-testid="nav-opportunities"]',
      }),
      makeStep({
        step_key: 'logout',
        label: 'Logout',
        status: 'failed',
        notes: 'Error: page.click: Unexpected token "=" while parsing css selector "[data-testid="logout-button"]"',
      }),
    ];

    const result = buildSelfHealingPrompt('01_nav_partners', 'run-123', steps);

    // Primary is open_opportunities
    expect(result.primary_step_key).toBe('open_opportunities');
    expect(result.primary_step_index).toBe(2);
    expect(result.classification.type).toBe('nav_collapsible');

    // Prompt includes nav expansion code
    expect(result.prompt_text).toContain('nav-group-partners-trigger');
    expect(result.prompt_text).toContain('data-state="open"');

    // Logout is secondary independent, not cascading
    expect(result.secondary_count).toBe(1);
    expect(result.prompt_text).toContain('Secondary Independent Fixes');
    expect(result.prompt_text).toContain('selector_parse');
  });

  it('labels cascading failures correctly', () => {
    const steps: QAStep[] = [
      makeStep({ step_key: 's1', label: 'Step 1', status: 'passed' }),
      makeStep({
        step_key: 's2',
        label: 'Step 2',
        status: 'failed',
        notes: 'timeout waiting for element',
      }),
      makeStep({
        step_key: 's3',
        label: 'Step 3',
        status: 'failed',
        notes: 'timeout waiting for element after previous failure',
      }),
    ];

    const result = buildSelfHealingPrompt('test_suite', 'run-456', steps);
    expect(result.primary_step_key).toBe('s2');
    expect(result.cascading_count).toBe(1);
    expect(result.prompt_text).toContain('Downstream Impact');
  });

  it('returns clean output when all steps pass', () => {
    const steps: QAStep[] = [
      makeStep({ step_key: 's1', label: 'Step 1', status: 'passed' }),
    ];
    const result = buildSelfHealingPrompt('suite', 'run', steps);
    expect(result.prompt_text).toContain('All QA steps passed');
  });
});
