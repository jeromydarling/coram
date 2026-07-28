/**
 * qaFixPromptEngine — Deterministic Lovable Fix Prompt generator for QA failures.
 *
 * WHAT: Transforms structured QA failure evidence into copy/paste-ready Lovable prompts.
 * WHERE: Used by qa-run-callback edge function and Operator Console UI.
 * WHY: Enables rapid, high-quality bug fixes without manual evidence gathering.
 */

interface FailureStep {
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

interface FailureEvidence {
  run_id: string;
  suite_key: string;
  base_url?: string;
  steps: FailureStep[];
}

export interface FixPromptOutput {
  title: string;
  prompt_text: string;
  failure_type: string;
  root_cause_hypotheses: string[];
  suggested_files: string[];
  redactions: string[];
}

// ── Redaction ────────────────────────────────────────────────
const REDACT_PATTERNS: Array<{ pattern: RegExp; label: string; replacement: string }> = [
  { pattern: /Bearer\s+[A-Za-z0-9\-_.~+/]+=*/g, label: 'auth_token', replacement: 'Bearer [REDACTED]' },
  { pattern: /eyJ[A-Za-z0-9\-_]+\.eyJ[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_.+/=]*/g, label: 'jwt', replacement: '[JWT_REDACTED]' },
  { pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, label: 'email', replacement: '[EMAIL_REDACTED]' },
  { pattern: /cookie:\s*[^\n]+/gi, label: 'cookie', replacement: 'cookie: [REDACTED]' },
  { pattern: /password['":\s]*[^\s,}'"]+/gi, label: 'password', replacement: 'password: [REDACTED]' },
  { pattern: /apikey[=:]\s*[^\s&'"]+/gi, label: 'api_key', replacement: 'apikey=[REDACTED]' },
];

function redact(text: string): { cleaned: string; redactions: string[] } {
  const found: string[] = [];
  let cleaned = text;
  for (const { pattern, label, replacement } of REDACT_PATTERNS) {
    if (pattern.test(cleaned)) {
      found.push(label);
      cleaned = cleaned.replace(pattern, replacement);
    }
  }
  return { cleaned, redactions: found };
}

// ── Failure Classification ───────────────────────────────────
function classifyFailure(steps: FailureStep[]): string {
  const failedSteps = steps.filter(s => s.status === 'failed');
  const allText = failedSteps.flatMap(s => [
    ...s.console_errors.map(String),
    ...s.page_errors.map(String),
    ...s.network_failures.map(String),
    s.notes || '',
  ]).join(' ').toLowerCase();

  if (allText.includes('timeout') || allText.includes('waiting for') || allText.includes('locator')) return 'timeout';
  if (allText.includes('401') || allText.includes('403') || allText.includes('unauthorized') || allText.includes('redirect')) return 'auth';
  if (allText.includes('500') || allText.includes('internal server')) return 'server_error';
  if (allText.includes('404') || allText.includes('not found')) return 'network';
  if (allText.includes('fetch') || allText.includes('network') || allText.includes('cors')) return 'network';
  if (allText.includes('assert') || allText.includes('expect') || allText.includes('tocontain')) return 'assertion';
  if (allText.includes('cannot read') || allText.includes('undefined') || allText.includes('null')) return 'ui_mismatch';
  return 'unknown';
}

// ── File Suggestions ─────────────────────────────────────────
const ROUTE_FILE_MAP: Record<string, string[]> = {
  '/login': ['src/pages/LoginPage.tsx', 'src/components/auth/LoginForm.tsx'],
  '/dashboard': ['src/pages/DashboardPage.tsx', 'src/components/dashboard/'],
  '/opportunities': ['src/pages/OpportunitiesPage.tsx', 'src/components/opportunities/'],
  '/events': ['src/pages/EventsPage.tsx', 'src/components/events/'],
  '/provisions': ['src/pages/ProvisionsPage.tsx', 'src/components/provisions/'],
  '/operator': ['src/pages/operator/', 'src/layouts/OperatorLayout.tsx'],
  '/settings': ['src/pages/SettingsPage.tsx'],
  '/integrations': ['src/pages/IntegrationsPage.tsx', 'src/components/integrations/'],
};

function suggestFiles(steps: FailureStep[], failureType: string): string[] {
  const files = new Set<string>();
  for (const step of steps.filter(s => s.status === 'failed')) {
    if (step.url) {
      try {
        const path = new URL(step.url).pathname;
        for (const [route, routeFiles] of Object.entries(ROUTE_FILE_MAP)) {
          if (path.includes(route)) {
            routeFiles.forEach(f => files.add(f));
          }
        }
      } catch { /* ignore invalid URLs */ }
    }
  }
  if (failureType === 'auth') {
    files.add('src/contexts/AuthContext.tsx');
    files.add('src/components/auth/LoginForm.tsx');
  }
  if (failureType === 'network' || failureType === 'server_error') {
    files.add('supabase/functions/');
  }
  return Array.from(files).slice(0, 8);
}

// ── Root Cause Hypotheses ────────────────────────────────────
function generateHypotheses(failureType: string, steps: FailureStep[]): string[] {
  const failedStep = steps.find(s => s.status === 'failed');
  const base: Record<string, string[]> = {
    timeout: [
      'Element selector changed or component not rendering in time',
      'Data query is slow or returns empty, preventing UI render',
      'Loading state blocks element visibility past the timeout',
    ],
    auth: [
      'QA user credentials expired or password was rotated',
      'Auth redirect loop between /login and target page',
      'RLS policy rejects the QA user role for this operation',
      'Session token not being passed correctly after login',
    ],
    server_error: [
      'Edge function has an unhandled exception for this input',
      'Database migration changed schema but code references old columns',
      'CORS headers missing on the failing endpoint',
    ],
    network: [
      'Route does not exist in AppRouter.tsx',
      'Edge function not deployed or name mismatch',
      'API endpoint returns 404 due to missing path handler',
    ],
    assertion: [
      'Expected UI element text or structure changed',
      'Feature flag disabled that controls the expected content',
      'Data seeding incomplete — expected records missing',
    ],
    ui_mismatch: [
      'Component references undefined prop or missing context provider',
      'Conditional rendering path hits null data before load completes',
      'Import path changed after refactor',
    ],
    unknown: [
      'Review the console errors and screenshots for more context',
      'Check if a recent deployment changed the failing component',
    ],
  };

  const hypotheses = [...(base[failureType] || base.unknown)];

  if (failedStep?.notes?.includes('navigation')) {
    hypotheses.unshift('Client-side routing may have changed — verify sidebar links and route guards');
  }

  return hypotheses.slice(0, 5);
}

// ── Main Generator ───────────────────────────────────────────
export function generateFixPrompt(evidence: FailureEvidence): FixPromptOutput {
  const failedSteps = evidence.steps.filter(s => s.status === 'failed');
  if (failedSteps.length === 0) {
    return {
      title: 'No failures detected',
      prompt_text: '# All QA steps passed ✅\nNo repair needed.',
      failure_type: 'none',
      root_cause_hypotheses: [],
      suggested_files: [],
      redactions: [],
    };
  }

  const failureType = classifyFailure(evidence.steps);
  const hypotheses = generateHypotheses(failureType, evidence.steps);
  const files = suggestFiles(evidence.steps, failureType);
  const lastFailed = failedSteps[failedSteps.length - 1];
  const allRedactions: string[] = [];

  // Build evidence sections
  const consoleSection = failedSteps
    .flatMap(s => s.console_errors.map(String))
    .slice(0, 10)
    .map(e => {
      const { cleaned, redactions } = redact(e);
      allRedactions.push(...redactions);
      return `- ${cleaned}`;
    })
    .join('\n');

  const networkSection = failedSteps
    .flatMap(s => s.network_failures.map(String))
    .slice(0, 10)
    .map(e => {
      const { cleaned, redactions } = redact(e);
      allRedactions.push(...redactions);
      return `- ${cleaned}`;
    })
    .join('\n');

  const stepsTimeline = evidence.steps.map(s => {
    const icon = s.status === 'passed' ? '✅' : s.status === 'failed' ? '❌' : '⏭️';
    return `${icon} ${s.label} (${s.step_key}) — ${s.url || 'no URL'}`;
  }).join('\n');

  const title = `QA FIX: ${evidence.suite_key} — ${lastFailed.label} (${failureType})`;

  const { cleaned: cleanedNotes } = redact(lastFailed.notes || '');

  const promptText = `# ${title}

## Context
QA suite \`${evidence.suite_key}\` failed during step **"${lastFailed.label}"** (${lastFailed.step_key}).
Run ID: \`${evidence.run_id}\`
Base URL: ${evidence.base_url || 'unknown'}
Failure type: **${failureType}**

## Steps Timeline
${stepsTimeline}

## Evidence

### Last Failing Step
- **Step:** ${lastFailed.label} (${lastFailed.step_key})
- **URL:** ${lastFailed.url || 'unknown'}
- **Error:** ${cleanedNotes || '(no notes)'}

${consoleSection ? `### Console Errors\n${consoleSection}` : ''}

${networkSection ? `### Network Failures\n${networkSection}` : ''}

## Root Cause Hypotheses (ranked)
${hypotheses.map((h, i) => `${i + 1}. ${h}`).join('\n')}

## Likely Files to Inspect
${files.map(f => `- \`${f}\``).join('\n')}

## Required Fixes
1. Fix the root cause so step "${lastFailed.label}" passes
2. Ensure no regressions in other QA steps
3. Add \`data-testid\` attributes if selectors were unstable
4. Test at 320px viewport width (mobile-first)

## Done When
- [ ] QA suite \`${evidence.suite_key}\` passes end-to-end
- [ ] No console errors on the failing page
- [ ] No RLS policy regressions
- [ ] Mobile layout verified at 320px

## Add/Update Tests
- Ensure \`data-testid\` attributes exist for all selectors used in this suite
- If a new component was added, add corresponding test coverage
`;

  return {
    title,
    prompt_text: promptText,
    failure_type: failureType,
    root_cause_hypotheses: hypotheses,
    suggested_files: files,
    redactions: [...new Set(allRedactions)],
  };
}
