/**
 * buildLovableFixPrompt — Generates copy-paste Lovable repair prompts from error records.
 *
 * WHAT: Deterministic prompt builder for operator error desk.
 * WHERE: Used in ErrorDetailDrawer and bulk repair actions.
 * WHY: Enables one-click generation of structured repair prompts.
 */

interface ErrorRow {
  id: string;
  source: string;
  severity: string;
  fingerprint: string;
  message: string;
  context: Record<string, unknown>;
  repro_steps?: string | null;
  expected?: string | null;
  count: number;
  first_seen_at: string;
  last_seen_at: string;
  status: string;
}

function inferLikelyFiles(error: ErrorRow): string[] {
  const files: string[] = [];
  const route = (error.context?.route as string) || '';
  const functionName = (error.context?.function_name as string) || '';

  // Infer from route
  if (route.includes('/operator')) files.push('src/pages/operator/');
  if (route.includes('/admin')) files.push('src/pages/admin/');
  if (route.includes('/onboarding')) files.push('src/pages/Onboarding.tsx');
  if (route.includes('/settings')) files.push('src/pages/Settings.tsx');

  // Infer from source
  if (error.source === 'edge_function' && functionName) {
    files.push(`supabase/functions/${functionName}/index.ts`);
  }

  // Infer from stack
  const stack = (error.context?.stack as string) || '';
  const srcMatch = stack.match(/src\/[^\s:)]+/g);
  if (srcMatch) files.push(...srcMatch.slice(0, 3));

  return [...new Set(files)];
}

function safeContextExcerpt(context: Record<string, unknown>): string {
  const safe = { ...context };
  // Strip sensitive keys
  delete safe.userAgent;
  const json = JSON.stringify(safe, null, 2);
  return json.length > 500 ? json.slice(0, 500) + '\n...' : json;
}

export function buildLovableFixPrompt(error: ErrorRow): string {
  const route = (error.context?.route as string) || 'unknown';
  const shortMessage = error.message.length > 60 ? error.message.slice(0, 60) + '…' : error.message;
  const likelyFiles = inferLikelyFiles(error);

  const sections = [
    `# FIX: [${error.source}] — ${route} — ${shortMessage}`,
    '',
    '## CONTEXT',
    `A ${error.source} error has been occurring on route \`${route}\`.`,
    `It has been seen ${error.count} time(s) since ${new Date(error.first_seen_at).toLocaleDateString()}.`,
    `Severity: ${error.severity}. Status: ${error.status}.`,
    '',
    '## REPRO STEPS',
    error.repro_steps || `1. Navigate to \`${route}\`\n2. Trigger the failing action\n3. Observe the error`,
    '',
    '## EXPECTED',
    error.expected || 'The operation should complete without error.',
    '',
    '## ACTUAL',
    `Error message: ${error.message}`,
    (error.context?.stack as string)
      ? `\nStack excerpt:\n\`\`\`\n${(error.context.stack as string).slice(0, 600)}\n\`\`\``
      : '',
    '',
    '## LOG DATA',
    '```json',
    safeContextExcerpt(error.context),
    '```',
    '',
    '## LIKELY FILES',
    likelyFiles.length > 0
      ? likelyFiles.map(f => `- \`${f}\``).join('\n')
      : '- Unable to infer — check stack trace above',
    '',
    '## REQUIRED FIX',
    '- [ ] Stabilize the failing handler',
    '- [ ] Add input guardrails / validation',
    '- [ ] Maintain RLS policies — no security regressions',
    '- [ ] Mobile-first — all layouts work at 320px',
    '- [ ] No AI generation — deterministic logic only',
    '- [ ] Use Calm Mode language — no urgency styling',
    '',
    '## TESTS REQUIRED',
    error.source === 'edge_function'
      ? '- [ ] Deno edge function test covering this failure path'
      : '- [ ] Frontend test covering this component / route',
    '- [ ] Verify error does not reoccur after fix',
    '',
    '## SMOKE CHECKLIST',
    '- [ ] Error no longer appears in Error Desk',
    '- [ ] No tenant data leakage',
    '- [ ] Operator console loads clean',
  ];

  return sections.filter(s => s !== undefined).join('\n');
}

/**
 * Build a combined prompt for multiple errors (bulk repair pack).
 */
export function buildBulkRepairPrompt(errors: ErrorRow[]): string {
  const header = [
    '# CROS™ Bulk Stabilization Prompt',
    '',
    `This prompt addresses ${errors.length} tracked issue(s).`,
    'Fix each in order of severity. Maintain all existing functionality.',
    '',
    '---',
    '',
  ].join('\n');

  const bodies = errors.slice(0, 5).map((e, i) => {
    return `## Issue ${i + 1} of ${Math.min(errors.length, 5)}\n\n${buildLovableFixPrompt(e)}`;
  });

  return header + bodies.join('\n\n---\n\n');
}
