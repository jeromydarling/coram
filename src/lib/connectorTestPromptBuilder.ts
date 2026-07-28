/**
 * connectorTestPromptBuilder — Self-healing repair prompt generator for connector tests.
 *
 * WHAT: Produces copy-paste Lovable repair prompts targeting connector adapter failures.
 * WHERE: Demo Lab → Connector Tests tab — "Copy fix prompt" action.
 * WHY: Enables one-click structured repair prompts mirroring QA Employee pattern.
 */

import type { ConnectorTestStep, ConnectorTestRun } from './connectorTestRunner';

// ── File mapping ──

const ADAPTER_FILE_MAP: Record<string, string> = {
  salesforce: 'src/integrations/connectors/salesforceAdapter.ts',
  airtable: 'src/integrations/connectors/airtableAdapter.ts',
  fluentcrm: 'src/integrations/connectors/fluentcrmAdapter.ts',
  jetpackcrm: 'src/integrations/connectors/jetpackcrmAdapter.ts',
  wperp: 'src/integrations/connectors/wperpAdapter.ts',
};

function suggestFiles(step: ConnectorTestStep): string[] {
  const files: string[] = [];
  const adapterFile = ADAPTER_FILE_MAP[step.adapter_key];
  if (adapterFile) {
    files.push(adapterFile);
  } else {
    files.push('src/integrations/connectors/stubAdapters.ts');
  }
  files.push('src/integrations/connectors/types.ts');
  files.push('src/integrations/connectors/__tests__/connectorAdapters.test.ts');
  return files;
}

function classifyFailure(step: ConnectorTestStep): { type: string; severity: string; explanation: string } {
  const msg = (step.error_message || '').toLowerCase();

  if (msg.includes('orphan')) {
    return { type: 'orphan_detection', severity: 'medium', explanation: 'Orphan contact detection failed — adapter may not check for missing account reference.' };
  }
  if (msg.includes('lowercase') || msg.includes('email')) {
    return { type: 'normalization', severity: 'medium', explanation: 'Email normalization failed — adapter should lowercase emails.' };
  }
  if (msg.includes('null') || msg.includes('reject')) {
    return { type: 'validation', severity: 'high', explanation: 'Adapter accepted invalid input — should reject empty required fields.' };
  }
  if (msg.includes('organization') || msg.includes('name')) {
    return { type: 'field_mapping', severity: 'high', explanation: 'Required field mapping failed — adapter did not extract expected field.' };
  }
  return { type: 'unknown', severity: 'medium', explanation: 'Connector adapter test failure — review error message and adapter logic.' };
}

// ── Single step prompt ──

export function buildConnectorStepPrompt(step: ConnectorTestStep): string {
  const classification = classifyFailure(step);
  const files = suggestFiles(step);

  const sections = [
    `# CONNECTOR FIX: ${step.adapter_key} — ${step.entity} — ${step.label}`,
    '',
    '## CONTEXT',
    `A connector adapter test failed for **${step.adapter_key}** on the \`${step.entity}\` entity.`,
    `Test key: \`${step.step_key}\``,
    '',
    '## WHAT FAILED',
    `- **Step:** ${step.label}`,
    `- **Adapter:** ${step.adapter_key}`,
    `- **Entity:** ${step.entity}`,
    `- **Error:** ${step.error_message || '(no error text)'}`,
    '',
    '## WHY IT FAILED',
    `- **Classification:** ${classification.type}`,
    `- **Severity:** ${classification.severity}`,
    `- **Explanation:** ${classification.explanation}`,
    '',
    '## LIKELY FILES',
    ...files.map(f => `- \`${f}\``),
    '',
    '## REQUIRED FIX',
    '- [ ] Fix the adapter normalization logic for this entity',
    '- [ ] Ensure email lowercasing is applied',
    '- [ ] Ensure orphan contacts produce warnings',
    '- [ ] Ensure empty/invalid input returns null result with warnings',
    '- [ ] Do not break other adapters or contract tests',
    '',
    '## TESTS REQUIRED',
    '- [ ] Vitest fixture test covering this failure path',
    '- [ ] Cross-adapter contract test still passes for all 30+ adapters',
    '- [ ] Run connector tests in Demo Lab — all green',
    '',
    '## DONE WHEN',
    `- [ ] Test \`${step.step_key}\` passes`,
    '- [ ] No regressions in other adapter tests',
    '- [ ] Error no longer appears in Error Desk',
  ];

  return sections.join('\n');
}

// ── Full run prompt ──

export function buildConnectorRunPrompt(run: ConnectorTestRun): string {
  const failures = run.steps.filter(s => s.status === 'failed');

  if (failures.length === 0) {
    return '# All connector tests passed ✅\nNo repair needed.';
  }

  const header = [
    '# CROS™ Connector Adapter Repair Pack',
    '',
    `This pack addresses **${failures.length}** failing test(s) out of ${run.total} total.`,
    `Run ID: \`${run.run_id}\``,
    `Executed: ${new Date(run.started_at).toLocaleString()}`,
    '',
    '---',
    '',
  ].join('\n');

  const bodies = failures.slice(0, 8).map((step, i) =>
    `## Failure ${i + 1} of ${Math.min(failures.length, 8)}\n\n${buildConnectorStepPrompt(step)}`
  );

  return header + bodies.join('\n\n---\n\n');
}
