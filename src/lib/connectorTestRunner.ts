/**
 * connectorTestRunner — In-browser connector adapter test executor.
 *
 * WHAT: Runs connector adapter fixture tests and produces structured results.
 * WHERE: Demo Lab → Connector Tests tab.
 * WHY: Validates CRM normalization logic with full error diagnostics for operator repair.
 */

import { salesforceAdapter } from '@/integrations/connectors/salesforceAdapter';
import { airtableAdapter } from '@/integrations/connectors/airtableAdapter';
import { fluentcrmAdapter } from '@/integrations/connectors/fluentcrmAdapter';
import { jetpackcrmAdapter } from '@/integrations/connectors/jetpackcrmAdapter';
import { wperpAdapter } from '@/integrations/connectors/wperpAdapter';
import { dynamics365Adapter } from '@/integrations/connectors/dynamics365Adapter';
import { STUB_ADAPTERS } from '@/integrations/connectors/stubAdapters';
import { salesforceOutbound } from '@/integrations/connectors/salesforceOutbound';
import { dynamics365Outbound } from '@/integrations/connectors/dynamics365Outbound';
import type { OutboundAdapter } from '@/integrations/connectors/outboundTypes';
import type { ConnectorAdapter } from '@/integrations/connectors/types';

// ── Types ──

export interface ConnectorTestStep {
  step_key: string;
  label: string;
  adapter_key: string;
  entity: string;
  status: 'passed' | 'failed' | 'skipped';
  error_message?: string;
  stack?: string;
  duration_ms: number;
}

export interface ConnectorTestRun {
  run_id: string;
  started_at: string;
  completed_at: string;
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  steps: ConnectorTestStep[];
}

// ── Fixtures ──

const GENERIC_ACCOUNT = { id: 'gen-1', name: 'Test Org', Website: 'https://test.org', City: 'Dallas', State: 'TX' };
const GENERIC_CONTACT = { id: 'gen-c1', first_name: 'Test', last_name: 'User', email: 'test@test.org', account_id: 'gen-1' };

const FLUENTCRM_FIXTURES = {
  account: { id: 'fc-co-1', name: 'Twin Cities Food Bank', website: 'https://tcfb.org', phone: '612-555-0100', city: 'Minneapolis', state: 'MN' },
  contact: { id: 'fc-sub-1', first_name: 'Maria', last_name: 'Garcia', email: 'Maria@Example.Org', phone: '612-555-0101', company_id: 'fc-co-1' },
  contactOrphan: { id: 'fc-sub-2', first_name: 'James', last_name: 'Wilson', email: 'james@test.org' },
  contactEmpty: { id: 'fc-sub-3' },
};

const JETPACKCRM_FIXTURES = {
  account: { id: 'jp-co-1', name: 'Metro Youth Services', homeurl: 'https://metroyouth.org', maintel: '651-555-0200', city: 'Minneapolis', county: 'MN' },
  contact: { id: 'jp-c-1', fname: 'James', lname: 'Wilson', email: 'James@Ministry.Org', company: 'jp-co-1' },
  contactOrphan: { id: 'jp-c-2', fname: 'Ana', lname: 'Rodriguez', email: 'ana@test.org' },
};

const WPERP_FIXTURES = {
  account: { id: 'erp-co-1', company: 'Refugee Resettlement Alliance', website: 'https://rra.org', phone: '612-555-0300', state: 'MN' },
  contact: { id: 'erp-c-1', first_name: 'Fatima', last_name: 'Ahmed', email: 'Fatima@RRA.org', company_id: 'erp-co-1' },
  contactOrphan: { id: 'erp-c-2', first_name: 'David', last_name: 'Lee', email: 'david@test.org' },
};

// Dynamics 365 OData v4 fixtures
const DYNAMICS365_FIXTURES = {
  account: { accountid: 'd365-a-1', name: 'Faith Community Alliance', websiteurl: 'https://fca.org', telephone1: '214-555-0400', address1_line1: '100 Grace St', address1_city: 'Dallas', address1_stateorprovince: 'texas', address1_postalcode: '75201', description: 'A community-centered nonprofit.' },
  contact: { contactid: 'd365-c-1', firstname: 'Sarah', lastname: 'Chen', emailaddress1: 'Sarah@FCA.org', telephone1: '214-555-0401', jobtitle: 'Director', _parentcustomerid_value: 'd365-a-1', address1_city: 'Dallas', address1_stateorprovince: 'TX' },
  contactOrphan: { contactid: 'd365-c-2', firstname: 'Marcus', lastname: 'Rivera', emailaddress1: 'marcus@test.org' },
  contactEmpty: { contactid: 'd365-c-3' },
  contactInactive: { contactid: 'd365-c-4', firstname: 'Legacy', lastname: 'Record', emailaddress1: 'legacy@fca.org', statecode: 1 },
  task: { activityid: 'd365-t-1', subject: 'Follow up on grant proposal', scheduledend: '2025-06-15T00:00:00Z', statecode: 0, prioritycode: 2, description: 'Review and submit final draft.' },
  event: { activityid: 'd365-ev-1', subject: 'Quarterly Board Meeting', scheduledstart: '2025-07-01T09:00:00Z', scheduledend: '2025-07-01T11:00:00Z', location: 'Grace Hall Room 204' },
  activity: { activityid: 'd365-act-1', subject: 'Phone call with Sarah', description: 'Discussed partnership expansion plans.', createdon: '2025-05-10T14:30:00Z', _regardingobjectid_value: 'd365-c-1' },
};

// ── Test definitions ──

interface TestCase {
  key: string;
  label: string;
  adapterKey: string;
  entity: string;
  run: () => void;
}

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(`Assertion failed: ${msg}`);
}

function buildFullAdapterTests(adapter: ConnectorAdapter, key: string, fixtures: Record<string, Record<string, unknown>>): TestCase[] {
  const tests: TestCase[] = [];

  if (fixtures.account) {
    tests.push({
      key: `${key}-account-valid`, label: `${adapter.displayName}: normalize account`, adapterKey: key, entity: 'account',
      run: () => { const { result } = adapter.normalizeAccount(fixtures.account); assert(result !== null, 'account result should not be null'); assert(!!result!.organization, 'organization required'); },
    });
  }
  if (fixtures.contact) {
    tests.push({
      key: `${key}-contact-valid`, label: `${adapter.displayName}: normalize contact`, adapterKey: key, entity: 'contact',
      run: () => { const { result } = adapter.normalizeContact(fixtures.contact); assert(result !== null, 'contact result should not be null'); assert(!!result!.name, 'name required'); },
    });
  }
  if (fixtures.contact) {
    tests.push({
      key: `${key}-contact-email-lower`, label: `${adapter.displayName}: email lowercasing`, adapterKey: key, entity: 'contact',
      run: () => { const { result } = adapter.normalizeContact(fixtures.contact); assert(result !== null, 'result should not be null'); assert(result!.email === result!.email?.toLowerCase(), 'email should be lowercase'); },
    });
  }
  if (fixtures.contactOrphan) {
    tests.push({
      key: `${key}-contact-orphan`, label: `${adapter.displayName}: orphan detection`, adapterKey: key, entity: 'contact',
      run: () => { const { warnings } = adapter.normalizeContact(fixtures.contactOrphan); assert(warnings.some(w => w.type === 'orphan_contact'), 'should flag orphan'); },
    });
  }
  if (fixtures.contactEmpty) {
    tests.push({
      key: `${key}-contact-empty`, label: `${adapter.displayName}: reject empty contact`, adapterKey: key, entity: 'contact',
      run: () => { const { result, warnings } = adapter.normalizeContact(fixtures.contactEmpty); assert(result === null, 'should reject empty'); assert(warnings.length > 0, 'should produce warnings'); },
    });
  }

  return tests;
}

function buildContractTests(adapter: ConnectorAdapter, key: string): TestCase[] {
  const entities = ['account', 'contact', 'task', 'event', 'activity'] as const;
  const fns = {
    account: adapter.normalizeAccount,
    contact: adapter.normalizeContact,
    task: adapter.normalizeTask,
    event: adapter.normalizeEvent,
    activity: adapter.normalizeActivity,
  };
  return entities.map(entity => ({
    key: `${key}-contract-${entity}-empty`,
    label: `${adapter.displayName}: reject empty ${entity}`,
    adapterKey: key,
    entity,
    run: () => {
      const { result, warnings } = fns[entity].call(adapter, {});
      assert(result === null, `should reject empty ${entity}`);
      assert(warnings.length > 0, 'should produce warnings');
    },
  }));
}

function buildGenericTests(adapter: ConnectorAdapter, key: string): TestCase[] {
  return [
    {
      key: `${key}-generic-account`, label: `${adapter.displayName}: generic account`, adapterKey: key, entity: 'account',
      run: () => { const { result } = adapter.normalizeAccount(GENERIC_ACCOUNT); assert(result !== null, 'should handle generic account'); assert(!!result!.organization, 'organization required'); },
    },
    {
      key: `${key}-generic-contact`, label: `${adapter.displayName}: generic contact`, adapterKey: key, entity: 'contact',
      run: () => { const { result } = adapter.normalizeContact(GENERIC_CONTACT); assert(result !== null, 'should handle generic contact'); assert(!!result!.name, 'name required'); },
    },
  ];
}

// ── Outbound (bi-directional) test builders ──

function buildOutboundDenormTests(adapter: OutboundAdapter, key: string): TestCase[] {
  const tests: TestCase[] = [];
  const sampleAccount = { external_id: 'ob-a1', organization: 'Test Org', website_url: 'https://test.org', phone: '555-0100', address: '100 Main', city: 'Dallas', state: 'TX', postal_code: '75201', description: null, org_type: null, industry: null };
  const sampleContact = { external_id: 'ob-c1', account_external_id: 'ob-a1', name: 'Jane Doe', email: 'jane@test.org', phone: '555-0101', title: 'Director', city: 'Dallas', state: 'TX' };
  const sampleTask = { external_id: 'ob-t1', contact_external_id: 'ob-c1', account_external_id: null, title: 'Follow up', status: 'Open', priority: 'High', due_date: '2025-06-15T00:00:00Z', description: 'Test task' };
  const sampleEvent = { external_id: 'ob-e1', contact_external_id: 'ob-c1', account_external_id: null, event_name: 'Board Meeting', start_date: '2025-07-01T09:00:00Z', end_date: '2025-07-01T11:00:00Z', location: 'Room 204', description: null };
  const sampleActivity = { external_id: 'ob-n1', parent_external_id: 'ob-c1', title: 'Phone call', body_snippet: 'Discussed plans.', created_date: '2025-05-10T14:30:00Z' };

  // Denormalize create tests
  for (const [entity, sample, fn] of [
    ['account', sampleAccount, adapter.denormalizeAccount] as const,
    ['contact', sampleContact, adapter.denormalizeContact] as const,
    ['task', sampleTask, adapter.denormalizeTask] as const,
    ['event', sampleEvent, adapter.denormalizeEvent] as const,
    ['activity', sampleActivity, adapter.denormalizeActivity] as const,
  ]) {
    tests.push({
      key: `${key}-outbound-${entity}-create`, label: `${adapter.displayName} ⇆: denormalize ${entity} (create)`, adapterKey: key, entity,
      run: () => {
        const payload = fn.call(adapter, sample as any, false);
        assert(payload.method === 'POST', 'create should use POST');
        assert(!!payload.endpoint, 'endpoint required');
        assert(Object.keys(payload.body).length > 0, 'body should not be empty');
      },
    });
    tests.push({
      key: `${key}-outbound-${entity}-update`, label: `${adapter.displayName} ⇆: denormalize ${entity} (update)`, adapterKey: key, entity,
      run: () => {
        const payload = fn.call(adapter, sample as any, true);
        assert(payload.method === 'PATCH', 'update should use PATCH');
        assert(!!payload.externalId, 'externalId required for update');
      },
    });
  }

  return tests;
}

function buildConflictDetectionTests(adapter: OutboundAdapter, key: string): TestCase[] {
  const tests: TestCase[] = [];

  // Contact conflict: email differs
  tests.push({
    key: `${key}-conflict-contact-email`, label: `${adapter.displayName} ⇆: detect contact email conflict`, adapterKey: key, entity: 'contact',
    run: () => {
      const cros = { name: 'Jane Doe', email: 'jane@new.org', phone: '555-0101' };
      const remoteFieldMap: Record<string, Record<string, string>> = {
        salesforce: { name: 'Name', email: 'Email', phone: 'Phone' },
        dynamics365: { name: 'fullname', email: 'emailaddress1', phone: 'telephone1' },
      };
      const fields = remoteFieldMap[key];
      if (!fields) return; // skip if unknown
      const remote: Record<string, unknown> = {};
      remote[fields.name] = 'Jane Doe';
      remote[fields.email] = 'jane@old.org';
      remote[fields.phone] = '555-0101';
      const diffs = adapter.detectConflicts('contact', cros, remote);
      assert(diffs.length > 0, 'should detect email conflict');
      assert(diffs.some(d => d.field === 'email'), 'should flag email field');
    },
  });

  // Account conflict: org name differs
  tests.push({
    key: `${key}-conflict-account-name`, label: `${adapter.displayName} ⇆: detect account name conflict`, adapterKey: key, entity: 'account',
    run: () => {
      const cros = { organization: 'New Name Inc', phone: '555-0100' };
      const remoteFieldMap: Record<string, Record<string, string>> = {
        salesforce: { organization: 'Name', phone: 'Phone' },
        dynamics365: { organization: 'name', phone: 'telephone1' },
      };
      const fields = remoteFieldMap[key];
      if (!fields) return;
      const remote: Record<string, unknown> = {};
      remote[fields.organization] = 'Old Name LLC';
      remote[fields.phone] = '555-0100';
      const diffs = adapter.detectConflicts('account', cros, remote);
      assert(diffs.length > 0, 'should detect org name conflict');
    },
  });

  // No conflict scenario
  tests.push({
    key: `${key}-conflict-none`, label: `${adapter.displayName} ⇆: no conflict when matched`, adapterKey: key, entity: 'contact',
    run: () => {
      const cros = { name: 'Same Name', email: 'same@test.org' };
      const remoteFieldMap: Record<string, Record<string, string>> = {
        salesforce: { name: 'Name', email: 'Email' },
        dynamics365: { name: 'fullname', email: 'emailaddress1' },
      };
      const fields = remoteFieldMap[key];
      if (!fields) return;
      const remote: Record<string, unknown> = {};
      remote[fields.name] = 'Same Name';
      remote[fields.email] = 'same@test.org';
      const diffs = adapter.detectConflicts('contact', cros, remote);
      assert(diffs.length === 0, 'should detect no conflicts');
    },
  });

  return tests;
}

function getAllTests(): TestCase[] {
  const tests: TestCase[] = [];

  // Full adapter tests (inbound)
  tests.push(...buildFullAdapterTests(fluentcrmAdapter, 'fluentcrm', FLUENTCRM_FIXTURES));
  tests.push(...buildFullAdapterTests(jetpackcrmAdapter, 'jetpackcrm', JETPACKCRM_FIXTURES));
  tests.push(...buildFullAdapterTests(wperpAdapter, 'wperp', WPERP_FIXTURES));

  // Dynamics 365 — full inbound fixture tests
  tests.push(...buildFullAdapterTests(dynamics365Adapter, 'dynamics365', DYNAMICS365_FIXTURES));

  // Dynamics 365 — extra inbound tests
  tests.push({
    key: 'dynamics365-contact-inactive', label: 'Microsoft Dynamics 365: inactive contact warning', adapterKey: 'dynamics365', entity: 'contact',
    run: () => {
      const { result, warnings } = dynamics365Adapter.normalizeContact(DYNAMICS365_FIXTURES.contactInactive);
      assert(result !== null, 'should still normalize inactive contact');
      assert(warnings.some(w => w.message.includes('inactive')), 'should warn about inactive statecode');
    },
  });
  tests.push({
    key: 'dynamics365-account-state-norm', label: 'Microsoft Dynamics 365: state normalization', adapterKey: 'dynamics365', entity: 'account',
    run: () => {
      const { result, warnings } = dynamics365Adapter.normalizeAccount(DYNAMICS365_FIXTURES.account);
      assert(result !== null, 'should normalize account');
      assert(result!.state === 'TX', `state should normalize "texas" to "TX", got "${result!.state}"`);
      assert(warnings.some(w => w.type === 'normalization'), 'should produce normalization warning');
    },
  });
  tests.push({
    key: 'dynamics365-task-valid', label: 'Microsoft Dynamics 365: normalize task', adapterKey: 'dynamics365', entity: 'task',
    run: () => {
      const { result } = dynamics365Adapter.normalizeTask(DYNAMICS365_FIXTURES.task);
      assert(result !== null, 'should normalize task');
      assert(result!.priority === 'High', `priority should map code 2 to "High", got "${result!.priority}"`);
      assert(result!.status === 'Open', `status should map code 0 to "Open", got "${result!.status}"`);
    },
  });
  tests.push({
    key: 'dynamics365-event-valid', label: 'Microsoft Dynamics 365: normalize event', adapterKey: 'dynamics365', entity: 'event',
    run: () => {
      const { result } = dynamics365Adapter.normalizeEvent(DYNAMICS365_FIXTURES.event);
      assert(result !== null, 'should normalize event');
      assert(result!.location === 'Grace Hall Room 204', 'location should map');
    },
  });
  tests.push({
    key: 'dynamics365-activity-valid', label: 'Microsoft Dynamics 365: normalize activity', adapterKey: 'dynamics365', entity: 'activity',
    run: () => {
      const { result } = dynamics365Adapter.normalizeActivity(DYNAMICS365_FIXTURES.activity);
      assert(result !== null, 'should normalize activity');
      assert(result!.parent_external_id === 'd365-c-1', 'should map regardingobjectid');
    },
  });

  // All adapters (full + stubs): contract tests
  const allAdapters: Array<[string, ConnectorAdapter]> = [
    ['salesforce', salesforceAdapter],
    ['airtable', airtableAdapter],
    ['fluentcrm', fluentcrmAdapter],
    ['jetpackcrm', jetpackcrmAdapter],
    ['wperp', wperpAdapter],
    ['dynamics365', dynamics365Adapter],
    ...Object.entries(STUB_ADAPTERS).map(([k, v]) => [k, v] as [string, ConnectorAdapter]),
  ];

  for (const [key, adapter] of allAdapters) {
    tests.push(...buildContractTests(adapter, key));
    tests.push(...buildGenericTests(adapter, key));
  }

  // Outbound (bi-directional) tests — denormalization + conflict detection
  const outboundAdapters: Array<[string, OutboundAdapter]> = [
    ['salesforce', salesforceOutbound],
    ['dynamics365', dynamics365Outbound],
  ];

  for (const [key, adapter] of outboundAdapters) {
    tests.push(...buildOutboundDenormTests(adapter, key));
    tests.push(...buildConflictDetectionTests(adapter, key));
  }

  return tests;
}

// ── Runner ──

export function runConnectorTests(): ConnectorTestRun {
  const runId = `ct-${Date.now()}`;
  const startedAt = new Date().toISOString();
  const tests = getAllTests();
  const steps: ConnectorTestStep[] = [];

  for (const test of tests) {
    const t0 = performance.now();
    try {
      test.run();
      steps.push({
        step_key: test.key,
        label: test.label,
        adapter_key: test.adapterKey,
        entity: test.entity,
        status: 'passed',
        duration_ms: Math.round(performance.now() - t0),
      });
    } catch (err: unknown) {
      const e = err instanceof Error ? err : new Error(String(err));
      steps.push({
        step_key: test.key,
        label: test.label,
        adapter_key: test.adapterKey,
        entity: test.entity,
        status: 'failed',
        error_message: e.message,
        stack: e.stack?.slice(0, 1000),
        duration_ms: Math.round(performance.now() - t0),
      });
    }
  }

  return {
    run_id: runId,
    started_at: startedAt,
    completed_at: new Date().toISOString(),
    total: steps.length,
    passed: steps.filter(s => s.status === 'passed').length,
    failed: steps.filter(s => s.status === 'failed').length,
    skipped: steps.filter(s => s.status === 'skipped').length,
    steps,
  };
}
