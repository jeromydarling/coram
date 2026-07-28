/**
 * qaRepairSnippets — Deterministic repair snippet generator for QA Employee.
 *
 * WHAT: Maps common QA step failures to actionable Lovable repair prompts.
 * WHERE: QA Employee run detail page in Operator Console.
 * WHY: Enables one-click copy of structured fix prompts without AI inference.
 */

interface QAStepFailure {
  step_key: string;
  label: string;
  url: string | null;
  screenshot_path: string | null;
  console_errors: unknown[];
  page_errors: unknown[];
  network_failures: unknown[];
  notes: string | null;
  status: string;
}

interface RepairSnippet {
  title: string;
  what_failed: string;
  where: string;
  screenshot_link: string;
  proposed_fixes: string[];
}

function classifyFailure(step: QAStepFailure): string {
  const allErrors = [
    ...step.console_errors.map(String),
    ...step.page_errors.map(String),
    ...step.network_failures.map(String),
    step.notes || '',
  ].join(' ').toLowerCase();

  if (allErrors.includes('timeout') || allErrors.includes('element not found') || allErrors.includes('locator')) {
    return 'selector_timeout';
  }
  if (allErrors.includes('404') || allErrors.includes('not found')) {
    return 'route_404';
  }
  if (allErrors.includes('401') || allErrors.includes('403') || allErrors.includes('unauthorized') || allErrors.includes('redirect')) {
    return 'auth_failure';
  }
  if (allErrors.includes('rls') || allErrors.includes('row-level security') || allErrors.includes('policy')) {
    return 'rls_violation';
  }
  if (allErrors.includes('crash') || allErrors.includes('unhandled') || allErrors.includes('cannot read') || allErrors.includes('undefined')) {
    return 'react_crash';
  }
  if (allErrors.includes('network') || allErrors.includes('fetch') || allErrors.includes('500')) {
    return 'network_error';
  }
  return 'unknown';
}

const FIX_TEMPLATES: Record<string, (step: QAStepFailure) => string[]> = {
  selector_timeout: (step) => [
    `Add stable data-testid to the target element in the component for step "${step.label}"`,
    'Verify the element renders before the Playwright timeout (default 30s)',
    'Check if the element is behind a loading state or conditional render',
    'Update the QA suite selector to match the current DOM structure',
  ],
  route_404: (step) => [
    `Verify route "${step.url || 'unknown'}" exists in AppRouter.tsx`,
    'Ensure the route is registered and not gated by a missing feature flag',
    'Check for typos in sidebar navigation hrefs',
    'Add missing route guard if the page was recently added',
  ],
  auth_failure: (step) => [
    'Verify seeded QA user (qa-demo@thecros.app) exists and has correct password',
    'Check that tenant slug matches the demo tenant assignment',
    'Confirm login form has data-testid="login-submit" on the submit button',
    'Verify no auth redirect loop between /login and the target page',
  ],
  rls_violation: (step) => [
    'Confirm the QA user has the correct role for the operation',
    'Check RLS policies on the affected table — ensure authenticated users can read',
    'Verify edge function auth helper passes the correct JWT',
    'Check if the query filters by tenant_id correctly',
  ],
  react_crash: (step) => [
    `Fix component crash on route "${step.url || 'unknown'}"`,
    'Add null guards for data that may not be loaded yet',
    'Check for missing context providers (AuthContext, TenantContext)',
    'Verify all hooks are called unconditionally (no conditional hook usage)',
  ],
  network_error: (step) => [
    'Check if the backend function is deployed and responding',
    'Verify CORS headers include all required headers',
    'Check for 500 errors in edge function logs',
    'Ensure the request includes proper Authorization header',
  ],
  unknown: (step) => [
    `Investigate step "${step.label}" failure — check console errors and screenshot`,
    'Review the page state at the time of failure',
    'Add more detailed error logging to the affected component',
  ],
};

export function generateRepairSnippet(step: QAStepFailure, baseStorageUrl?: string): RepairSnippet {
  const failureType = classifyFailure(step);
  const fixes = FIX_TEMPLATES[failureType]?.(step) || FIX_TEMPLATES.unknown(step);

  const screenshotUrl = step.screenshot_path && baseStorageUrl
    ? `${baseStorageUrl}/storage/v1/object/qa_screenshots/${step.screenshot_path}`
    : '(no screenshot)';

  return {
    title: `QA FIX: ${step.label} — ${failureType.replace('_', ' ')}`,
    what_failed: `Step "${step.label}" (${step.step_key}) ended with status: ${step.status}`,
    where: `URL: ${step.url || 'unknown'} | Step index: ${step.step_key}`,
    screenshot_link: screenshotUrl,
    proposed_fixes: fixes,
  };
}

export function formatRepairSnippetAsText(snippet: RepairSnippet): string {
  return [
    `# ${snippet.title}`,
    '',
    `## What failed`,
    snippet.what_failed,
    '',
    `## Where`,
    snippet.where,
    '',
    `## Screenshot`,
    snippet.screenshot_link,
    '',
    `## Proposed fixes`,
    ...snippet.proposed_fixes.map((f, i) => `${i + 1}. ${f}`),
    '',
    `## Requirements`,
    '- [ ] Fix must not break existing functionality',
    '- [ ] Mobile-first — layouts work at 320px',
    '- [ ] Maintain RLS policies — no security regressions',
    '- [ ] Add data-testid if selector was unstable',
  ].join('\n');
}

export function generateBulkRepairText(steps: QAStepFailure[], baseStorageUrl?: string): string {
  const failedSteps = steps.filter(s => s.status === 'failed');
  if (failedSteps.length === 0) return '# All QA steps passed ✅\nNo repair needed.';

  const header = [
    '# CROS™ QA Repair Pack',
    '',
    `This pack addresses ${failedSteps.length} failed step(s).`,
    'Fix each in order. Maintain all existing functionality.',
    '',
    '---',
    '',
  ].join('\n');

  const bodies = failedSteps.slice(0, 10).map((step, i) => {
    const snippet = generateRepairSnippet(step, baseStorageUrl);
    return `## Issue ${i + 1} of ${Math.min(failedSteps.length, 10)}\n\n${formatRepairSnippetAsText(snippet)}`;
  });

  return header + bodies.join('\n\n---\n\n');
}
