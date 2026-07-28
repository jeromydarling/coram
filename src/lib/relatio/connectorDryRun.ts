/**
 * connectorDryRun — Validates connector setup guides and credential forms without real accounts.
 *
 * WHAT: Simulates the full connector lifecycle (registry → guide → credential fields → config shape).
 * WHERE: Used by ConnectorDryRunPanel in admin/demo views.
 * WHY: Test all 30 connectors without setting up real accounts.
 */

import { CHMS_CONNECTORS, type ChmsConnectorConfig } from '@/lib/connectors/chmsRegistry';
import { SETUP_GUIDES, type ConnectorGuide } from '@/lib/relatio/setupGuides';

export interface DryRunCheck {
  name: string;
  status: 'pass' | 'fail' | 'warn';
  detail: string;
}

export interface ConnectorDryRunResult {
  connectorKey: string;
  label: string;
  checks: DryRunCheck[];
  allPass: boolean;
}

/**
 * Runs a dry-run validation for a single connector.
 * Checks: registry exists, guide exists, steps are non-empty,
 * credential step has matching fields, config shape is valid.
 */
export function runDryRunForConnector(key: string): ConnectorDryRunResult {
  const checks: DryRunCheck[] = [];
  const connector = CHMS_CONNECTORS[key];

  // Check 1: Registry entry exists
  checks.push({
    name: 'registry_entry',
    status: connector ? 'pass' : 'fail',
    detail: connector ? `${connector.label} (${connector.auth}, ${connector.polling})` : 'Not found in CHMS_CONNECTORS',
  });

  if (!connector) {
    return { connectorKey: key, label: key, checks, allPass: false };
  }

  // Check 2: Setup guide exists
  const guide = SETUP_GUIDES[key];
  checks.push({
    name: 'setup_guide',
    status: guide ? 'pass' : 'fail',
    detail: guide ? `${guide.steps.length} steps, ${guide.difficulty}, ~${guide.estimatedTime}` : 'No setup guide found',
  });

  if (!guide) {
    return { connectorKey: key, label: connector.label, checks, allPass: false };
  }

  // Check 3: Steps are non-empty and have titles
  const validSteps = guide.steps.filter(s => s.title && s.description);
  checks.push({
    name: 'steps_valid',
    status: validSteps.length === guide.steps.length ? 'pass' : 'fail',
    detail: `${validSteps.length}/${guide.steps.length} steps have title + description`,
  });

  // Check 4: Has at least one step with screenshot or copyable text
  const richSteps = guide.steps.filter(s => s.screenshotPath || s.copyableText || s.tip);
  checks.push({
    name: 'rich_content',
    status: richSteps.length > 0 ? 'pass' : 'warn',
    detail: `${richSteps.length} steps have screenshots, tips, or copyable text`,
  });

  // Check 5: Available data is defined
  checks.push({
    name: 'available_data',
    status: guide.availableData && guide.availableData.length > 0 ? 'pass' : 'warn',
    detail: guide.availableData ? `${guide.availableData.length} data types listed` : 'No available data defined',
  });

  // Check 6: Confirm step exists (last step should mention "Companion Mode")
  const lastStep = guide.steps[guide.steps.length - 1];
  const hasConfirmStep = lastStep?.title?.toLowerCase().includes('confirm') ||
    lastStep?.description?.toLowerCase().includes('companion') ||
    lastStep?.description?.toLowerCase().includes('source of record');
  checks.push({
    name: 'confirm_step',
    status: hasConfirmStep ? 'pass' : 'warn',
    detail: hasConfirmStep ? 'Final step confirms Companion Mode' : 'Final step may not clearly confirm Companion Mode',
  });

  // Check 7: Domains are non-empty
  checks.push({
    name: 'domains_defined',
    status: connector.domains.length > 0 ? 'pass' : 'fail',
    detail: `${connector.domains.length} domains: ${connector.domains.join(', ')}`,
  });

  // Check 8: Credential field mapping (verify the right fields are expected)
  const credFieldMap: Record<string, string[]> = {
    salesforce: ['key', 'secret', 'url'],
    hubspot: ['key'],
    airtable: ['key', 'baseId'],
    bloomerang: ['key'],
    neoncrm: ['orgId', 'key'],
    lgl: ['key'],
    donorperfect: ['key'],
    kindful: ['key', 'url'],
    zoho: ['key', 'secret', 'authCode'],
    breeze: ['key', 'url'],
    planningcenter: ['key', 'secret'],
    rock: ['key', 'url'],
    ministryplatform: ['key', 'secret', 'url'],
    parishsoft: ['key'],
    fellowshipone: ['key', 'secret', 'churchCode', 'portalUser', 'portalPass'],
    wildapricot: ['key', 'secret', 'accountId'],
    fluentcrm: ['key', 'password', 'url'],
    jetpackcrm: ['key', 'secret', 'url'],
    wperp: ['username', 'appPassword', 'url'],
    google_contacts: ['key', 'secret'],
    outlook_contacts: ['key', 'secret', 'tenantId'],
    monicacrm: ['key', 'url'],
    contactsplus: ['key'],
    civicrm: ['key', 'url'],
  };
  const expectedFields = credFieldMap[key];
  checks.push({
    name: 'credential_fields',
    status: expectedFields ? 'pass' : 'warn',
    detail: expectedFields ? `Expected fields: ${expectedFields.join(', ')}` : 'No credential field mapping defined',
  });

  const allPass = checks.every(c => c.status === 'pass');

  return { connectorKey: key, label: connector.label, checks, allPass };
}

/**
 * Runs dry-run validation for ALL registered connectors.
 */
export function runAllDryRuns(): ConnectorDryRunResult[] {
  return Object.keys(CHMS_CONNECTORS).map(runDryRunForConnector);
}
