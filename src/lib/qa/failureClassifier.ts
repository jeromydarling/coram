/**
 * failureClassifier — Classifies QA step failures with independence detection.
 *
 * WHAT: Determines failure type, severity, and whether a failure is independent or cascading.
 * WHERE: Used by QA prompt builder to separate root-cause from downstream symptoms.
 * WHY: Independent failures (e.g. selector parse bugs) need their own fix regardless of root cause.
 */

import type { QAStep } from './primaryFailure';
import { NAV_ITEM_TO_GROUP, GROUP_LABELS } from './navMap';

export type FailureType =
  | 'selector_parse'
  | 'selector_timeout'
  | 'nav_collapsible'
  | 'route_404'
  | 'auth_failure'
  | 'rls_violation'
  | 'react_crash'
  | 'network_error'
  | 'unknown';

export interface FailureClassification {
  type: FailureType;
  severity: 'critical' | 'high' | 'medium' | 'low';
  isIndependent: boolean;
  explanation: string;
}

function errorText(step: QAStep): string {
  const parts: string[] = [];
  // Structured error fields first — these are the real failure signals
  if (step.console_errors?.length) parts.push(...step.console_errors.map(String));
  if (step.page_errors?.length) parts.push(...step.page_errors.map(String));
  if (step.network_failures?.length) parts.push(...step.network_failures.map(String));
  // Notes last — often just the caught exception toString, may be misleading
  if (step.notes) parts.push(step.notes);
  return parts.join(' ');
}

/** Extract data-testid value from error text if present */
function extractTestId(text: string): string | null {
  const m = text.match(/data-testid="([^"]+)"/);
  return m ? m[1] : null;
}

export function classifyStepFailure(step: QAStep, isPrimaryOrLater: 'primary' | 'cascading'): FailureClassification {
  const text = errorText(step);
  const lower = text.toLowerCase();

  // 1) Selector parse errors — always independent
  if (lower.includes('unexpected token') && lower.includes('parsing css selector')) {
    return {
      type: 'selector_parse',
      severity: 'high',
      isIndependent: true,
      explanation: 'CSS selector syntax error — will fail every execution regardless of prior state.',
    };
  }

  // 2) Nav collapsible timeout
  const testId = extractTestId(text);
  if (testId && NAV_ITEM_TO_GROUP[testId] && (lower.includes('timeout') || lower.includes('waiting for'))) {
    const groupId = NAV_ITEM_TO_GROUP[testId];
    const groupLabel = GROUP_LABELS[groupId] || groupId;
    return {
      type: 'nav_collapsible',
      severity: 'critical',
      isIndependent: isPrimaryOrLater === 'primary',
      explanation: `Nav item "${testId}" is inside collapsible group "${groupLabel}". Radix unmounts children when closed — the group must be expanded first.`,
    };
  }

  // Also catch nav items from selector text patterns like [data-testid="nav-xxx"]
  const selectorMatch = text.match(/\[data-testid="(nav-[^"]+)"\]/);
  if (selectorMatch && NAV_ITEM_TO_GROUP[selectorMatch[1]] && (lower.includes('timeout') || lower.includes('waiting for'))) {
    const itemId = selectorMatch[1];
    const groupId = NAV_ITEM_TO_GROUP[itemId];
    const groupLabel = GROUP_LABELS[groupId] || groupId;
    return {
      type: 'nav_collapsible',
      severity: 'critical',
      isIndependent: isPrimaryOrLater === 'primary',
      explanation: `Nav item "${itemId}" is inside collapsible group "${groupLabel}". Radix unmounts children when closed — the group must be expanded first.`,
    };
  }

  // 3) Generic timeout
  if (lower.includes('timeout') || lower.includes('element not found') || lower.includes('waiting for') || lower.includes('locator')) {
    return {
      type: 'selector_timeout',
      severity: 'high',
      isIndependent: isPrimaryOrLater === 'primary',
      explanation: 'Element selector timed out — element may not be rendered or selector is stale.',
    };
  }

  // 4) Route 404
  if (lower.includes('404') || (lower.includes('not found') && !lower.includes('element'))) {
    return {
      type: 'route_404',
      severity: 'high',
      isIndependent: true,
      explanation: 'Route returned 404 — may be missing from router or misspelled.',
    };
  }

  // 5) Auth
  if (lower.includes('401') || lower.includes('403') || lower.includes('unauthorized') || lower.includes('redirect')) {
    return {
      type: 'auth_failure',
      severity: 'critical',
      isIndependent: isPrimaryOrLater === 'primary',
      explanation: 'Authentication or authorization failure.',
    };
  }

  // 6) RLS
  if (lower.includes('rls') || lower.includes('row-level security') || lower.includes('policy')) {
    return {
      type: 'rls_violation',
      severity: 'critical',
      isIndependent: true,
      explanation: 'Row-level security policy blocked the operation.',
    };
  }

  // 7) React crash
  if (lower.includes('crash') || lower.includes('unhandled') || lower.includes('cannot read') || lower.includes('undefined')) {
    return {
      type: 'react_crash',
      severity: 'high',
      isIndependent: isPrimaryOrLater === 'primary',
      explanation: 'React component crashed — likely null reference or missing context.',
    };
  }

  // 8) Network
  if (lower.includes('network') || lower.includes('fetch') || lower.includes('500') || lower.includes('cors')) {
    return {
      type: 'network_error',
      severity: 'high',
      isIndependent: isPrimaryOrLater === 'primary',
      explanation: 'Network request failed.',
    };
  }

  return {
    type: 'unknown',
    severity: 'medium',
    isIndependent: isPrimaryOrLater === 'primary',
    explanation: 'Unable to auto-classify — review console errors and screenshot.',
  };
}
