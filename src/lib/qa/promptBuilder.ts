/**
 * promptBuilder — Self-healing, root-cause-targeted QA repair prompt generator.
 *
 * WHAT: Produces copy-paste Lovable repair prompts that target the PRIMARY failure.
 * WHERE: Operator QA Console — "Copy step fix" and bulk repair actions.
 * WHY: Prevents misleading prompts that focus on downstream cascading failures.
 */

import type { QAStep } from './primaryFailure';
import { getPrimaryFailure, getCascadingFailures } from './primaryFailure';
import { classifyStepFailure, type FailureClassification } from './failureClassifier';
import { NAV_ITEM_TO_GROUP, GROUP_LABELS } from './navMap';

// ── Nav expansion snippet generator ──────────────────────────
function suggestNavGroupExpansion(step: QAStep): string | null {
  const text = extractBestError(step);

  // Find nav item testId in error text
  const match = text.match(/\[data-testid="(nav-[^"]+)"\]/) || text.match(/data-testid="(nav-[^"]+)"/);
  const testId = match?.[1];
  if (!testId || !NAV_ITEM_TO_GROUP[testId]) return null;

  const groupId = NAV_ITEM_TO_GROUP[testId];
  const groupLabel = GROUP_LABELS[groupId] || groupId;

  return `// Fix: "${testId}" is inside collapsible group "${groupLabel}"
// Radix Collapsible unmounts children when closed — expand group first.
// Wait on CONTENT node (Radix puts data-state on CollapsibleContent).
await page.click('[data-testid="${groupId}-trigger"]');

const contentSel = '[data-testid="${groupId}-content"][data-state="open"]';
const rootSel = '[data-testid="${groupId}"][data-state="open"]';

// Prefer content node; fall back to root if content testid is absent
if (await page.locator('[data-testid="${groupId}-content"]').count()) {
  await page.waitForSelector(contentSel, { timeout: 15000 });
} else {
  await page.waitForSelector(rootSel, { timeout: 15000 });
}

await page.click('[data-testid="${testId}"]');`;
}

// ── Error extraction ─────────────────────────────────────────
/**
 * Extract the best error evidence from a step, preferring structured
 * fields (console_errors, page_errors, network_failures) over notes.
 */
function extractBestError(step: QAStep): string {
  const parts: string[] = [];

  // Structured errors first — these are the real signals
  if (step.console_errors?.length) {
    parts.push(...step.console_errors.map(String));
  }
  if (step.page_errors?.length) {
    parts.push(...step.page_errors.map(String));
  }
  if (step.network_failures?.length) {
    parts.push(...step.network_failures.map(String));
  }
  // Notes last — fallback only
  if (step.notes) {
    parts.push(step.notes);
  }

  return parts.join(' ');
}

// ── Route → file mapping ─────────────────────────────────────
const ROUTE_FILE_MAP: Record<string, string[]> = {
  '/login': ['src/pages/LoginPage.tsx', 'src/components/auth/LoginForm.tsx'],
  '/dashboard': ['src/pages/DashboardPage.tsx'],
  '/opportunities': ['src/pages/OpportunitiesPage.tsx'],
  '/events': ['src/pages/EventsPage.tsx'],
  '/provisions': ['src/pages/ProvisionsPage.tsx'],
  '/settings': ['src/pages/SettingsPage.tsx'],
  '/operator': ['src/pages/operator/'],
};

function suggestFiles(step: QAStep, classification: FailureClassification): string[] {
  const files = new Set<string>();
  if (step.url) {
    try {
      const path = new URL(step.url).pathname;
      for (const [route, routeFiles] of Object.entries(ROUTE_FILE_MAP)) {
        if (path.includes(route)) routeFiles.forEach(f => files.add(f));
      }
    } catch { /* ignore */ }
  }
  if (classification.type === 'nav_collapsible' || classification.type === 'selector_timeout') {
    files.add('src/components/layout/Sidebar.tsx');
    files.add('qa-runner/runner.ts');
  }
  if (classification.type === 'auth_failure') {
    files.add('src/contexts/AuthContext.tsx');
  }
  if (classification.type === 'selector_parse') {
    files.add('qa-runner/runner.ts');
  }
  return Array.from(files).slice(0, 6);
}

// ── Single-step fix prompt ───────────────────────────────────
function buildStepFixSection(
  step: QAStep,
  stepIndex: number,
  classification: FailureClassification,
  role: 'primary' | 'secondary',
): string {
  const navSnippet = suggestNavGroupExpansion(step);
  const files = suggestFiles(step, classification);
  const errorEvidence = extractBestError(step);
  // Show structured errors first, fall back to notes
  const errorExcerpt = errorEvidence.slice(0, 500) || '(no error text)';

  const sections: string[] = [];

  if (role === 'primary') {
    sections.push(`## 1. What Failed (PRIMARY)`);
  } else {
    sections.push(`## Secondary Fix: ${step.label}`);
  }
  sections.push(`- **Step:** ${step.label} (\`${step.step_key}\`)`);
  sections.push(`- **Step index:** ${stepIndex}`);
  sections.push(`- **URL:** ${step.url || 'unknown'}`);
  sections.push(`- **Error:** ${errorExcerpt || '(no error text)'}`);
  sections.push('');

  sections.push(`## 2. Why It Failed`);
  sections.push(`- **Classification:** ${classification.type}`);
  sections.push(`- **Severity:** ${classification.severity}`);
  sections.push(`- **Explanation:** ${classification.explanation}`);
  sections.push('');

  sections.push(`## 3. Exact Fix`);
  if (navSnippet) {
    sections.push('**Update qa-runner test file** (`qa-runner/runner.ts`):');
    sections.push('```typescript');
    sections.push(navSnippet);
    sections.push('```');
  } else if (classification.type === 'selector_parse') {
    sections.push('**Update qa-runner test file** (`qa-runner/runner.ts`):');
    sections.push('- Fix the CSS selector syntax — use `page.locator(\'[data-testid="..."]\')` instead of compound selectors');
    sections.push('- Or use `waitForTestId(page, "...")` helper for safe selection');
  } else {
    sections.push('**Investigate likely files:**');
    files.forEach(f => sections.push(`- \`${f}\``));
  }
  sections.push('');

  return sections.join('\n');
}

// ── Main prompt builder ──────────────────────────────────────
export interface SelfHealingPrompt {
  title: string;
  prompt_text: string;
  primary_step_key: string;
  primary_step_index: number;
  classification: FailureClassification;
  cascading_count: number;
  secondary_count: number;
}

export function buildSelfHealingPrompt(
  suiteKey: string,
  runId: string,
  steps: QAStep[],
): SelfHealingPrompt {
  const primary = getPrimaryFailure(steps);

  if (!primary) {
    return {
      title: 'All QA steps passed ✅',
      prompt_text: '# All QA steps passed ✅\nNo repair needed.',
      primary_step_key: '',
      primary_step_index: -1,
      classification: { type: 'unknown', severity: 'low', isIndependent: true, explanation: '' },
      cascading_count: 0,
      secondary_count: 0,
    };
  }

  const primaryClassification = classifyStepFailure(primary.step, 'primary');
  const cascading = getCascadingFailures(steps, primary.index);

  // Classify cascading steps for independence
  const secondaryFixes: Array<{ step: QAStep; index: number; classification: FailureClassification }> = [];
  const cascadingList: Array<{ step: QAStep; index: number }> = [];

  for (const c of cascading) {
    const cls = classifyStepFailure(c.step, 'cascading');
    if (cls.isIndependent) {
      secondaryFixes.push({ ...c, classification: cls });
    } else {
      cascadingList.push(c);
    }
  }

  // Build timeline
  const timeline = steps.map((s, i) => {
    const icon = s.status === 'passed' ? '✅' : s.status === 'failed' ? '❌' : '⏭️';
    const tag = i === primary.index ? ' ← PRIMARY' : '';
    return `${icon} ${s.label} (${s.step_key}) — ${s.url || 'no URL'}${tag}`;
  }).join('\n');

  const title = `QA FIX: ${primary.step.label} — ${primaryClassification.type.replace(/_/g, ' ')}`;

  const parts: string[] = [];

  parts.push(`# ${title}`);
  parts.push('');
  parts.push(`**Suite:** \`${suiteKey}\` | **Run:** \`${runId}\``);
  parts.push('');
  parts.push('## Steps Timeline');
  parts.push(timeline);
  parts.push('');

  // Primary fix
  parts.push(buildStepFixSection(primary.step, primary.index, primaryClassification, 'primary'));

  // Cascading
  if (cascadingList.length > 0) {
    parts.push('## 4. Downstream Impact (Cascading)');
    parts.push('These failures are likely caused by the primary failure above. They should resolve once the root cause is fixed.');
    parts.push('');
    for (const c of cascadingList) {
      parts.push(`- **${c.step.label}** (\`${c.step.step_key}\`, index ${c.index}) — ${c.step.status}`);
    }
    parts.push('');
  }

  // Secondary independent fixes
  if (secondaryFixes.length > 0) {
    parts.push('## 5. Secondary Independent Fixes');
    parts.push('These failures will occur regardless of the primary fix and need separate attention.');
    parts.push('');
    for (const s of secondaryFixes) {
      parts.push(buildStepFixSection(s.step, s.index, s.classification, 'secondary'));
    }
  }

  // Done when
  parts.push('## Done When');
  parts.push(`- [ ] Suite \`${suiteKey}\` passes end-to-end`);
  parts.push('- [ ] Primary failure resolved');
  if (secondaryFixes.length > 0) {
    parts.push('- [ ] Secondary independent issues resolved');
  }
  parts.push('- [ ] No console errors on failing pages');
  parts.push('- [ ] No RLS regressions');
  parts.push('- [ ] Mobile layout verified at 320px');

  return {
    title,
    prompt_text: parts.join('\n'),
    primary_step_key: primary.step.step_key,
    primary_step_index: primary.index,
    classification: primaryClassification,
    cascading_count: cascadingList.length,
    secondary_count: secondaryFixes.length,
  };
}

/**
 * Build a combined prompt for multiple runs (bulk repair pack).
 */
export function buildBulkSelfHealingPrompt(
  runs: Array<{ suiteKey: string; runId: string; steps: QAStep[] }>,
): string {
  const header = [
    '# CROS™ QA Self-Healing Repair Pack',
    '',
    `This pack addresses ${runs.length} failing suite(s).`,
    'Fix each in order of severity. Maintain all existing functionality.',
    '',
    '---',
    '',
  ].join('\n');

  const bodies = runs.slice(0, 5).map((r, i) => {
    const result = buildSelfHealingPrompt(r.suiteKey, r.runId, r.steps);
    return `## Suite ${i + 1} of ${Math.min(runs.length, 5)}\n\n${result.prompt_text}`;
  });

  return header + bodies.join('\n\n---\n\n');
}
