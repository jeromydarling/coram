/**
 * buildFrictionFixPrompt — Generates calm UX refinement prompts from design suggestions.
 *
 * WHAT: Deterministic prompt builder for friction-based UX improvements.
 * WHERE: Used in OperatorSignumPage "Copy Lovable Fix Prompt" action.
 * WHY: Bridges NRI friction intelligence into actionable engineering prompts.
 */

import type { DesignSuggestion } from '@/hooks/useFrictionInsights';

export function buildFrictionFixPrompt(suggestion: DesignSuggestion): string {
  const evidence = suggestion.evidence as {
    event_count?: number;
    unique_users?: number;
    unique_tenants?: number;
    sample_summaries?: string[];
  };

  const sections = [
    `# UX REFINEMENT: ${suggestion.suggestion_summary}`,
    '',
    '## CONTEXT',
    `NRI (Narrative Relational Intelligence) detected a friction pattern where people hesitate.`,
    `This is NOT an error. The system is functioning — people are simply getting stuck.`,
    '',
    `- **Pattern:** \`${suggestion.pattern_key}\``,
    `- **Severity:** ${suggestion.severity}`,
    `- **Observed:** ${evidence.event_count ?? 0} events from ${evidence.unique_users ?? 0} unique people across ${evidence.unique_tenants ?? 0} tenants`,
    '',
    '## AFFECTED ROUTES',
    ...(suggestion.affected_routes.length > 0
      ? suggestion.affected_routes.map(r => `- \`${r}\``)
      : ['- Unknown route']),
    '',
    '## ROLES AFFECTED',
    ...(suggestion.roles_affected.length > 0
      ? suggestion.roles_affected.map(r => `- ${r}`)
      : ['- All roles']),
    '',
    '## WHAT PEOPLE EXPERIENCED',
    suggestion.narrative_detail,
    '',
    evidence.sample_summaries?.length
      ? ['## SAMPLE SIGNALS', ...evidence.sample_summaries.map(s => `- "${s}"`)].join('\n')
      : '',
    '',
    '## REQUIRED CHANGES',
    '- [ ] Improve the flow clarity at the affected route',
    '- [ ] Add contextual help or progressive disclosure where needed',
    '- [ ] Maintain mobile-first — all layouts work at 320px',
    '- [ ] No breaking changes to existing functionality',
    '- [ ] Use Calm Mode language — gentle, never urgent',
    '- [ ] Preserve all RLS policies — no security regressions',
    '',
    '## SMOKE CHECKLIST',
    '- [ ] Friction pattern no longer reproducible',
    '- [ ] Page loads clean on mobile and desktop',
    '- [ ] No new console errors introduced',
    '- [ ] Help tooltips render correctly if added',
  ];

  return sections.filter(s => s !== undefined).join('\n');
}
