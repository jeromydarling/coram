/**
 * Connector Adapter Fixture Tests
 *
 * WHAT: Deterministic fixture tests for all ConnectorAdapter implementations.
 * WHERE: Vitest — run via `bun run test`.
 * WHY: Verifies CRM normalization logic without real vendor accounts.
 */

import { describe, it, expect } from 'vitest';
import { salesforceAdapter } from '../salesforceAdapter';
import { airtableAdapter } from '../airtableAdapter';
import { fluentcrmAdapter } from '../fluentcrmAdapter';
import { jetpackcrmAdapter } from '../jetpackcrmAdapter';
import { wperpAdapter } from '../wperpAdapter';
import type { ConnectorAdapter } from '../types';

// ── Fixtures ──

const FLUENTCRM_FIXTURES = {
  account: {
    id: 'fc-co-1', name: 'Twin Cities Food Bank', website: 'https://tcfb.org',
    phone: '612-555-0100', city: 'Minneapolis', state: 'MN', postal_code: '55401',
    description: 'Community food distribution nonprofit',
  },
  contact: {
    id: 'fc-sub-1', first_name: 'Maria', last_name: 'Garcia',
    email: 'Maria@Example.Org', phone: '612-555-0101', job_title: 'Director',
    city: 'Saint Paul', state: 'minnesota', company_id: 'fc-co-1',
  },
  contactOrphan: {
    id: 'fc-sub-2', first_name: 'James', last_name: 'Wilson', email: 'james@test.org',
  },
  contactEmpty: { id: 'fc-sub-3' },
  task: {
    id: 'fc-t-1', title: 'Follow up with tenant', subscriber_id: 'fc-sub-1',
    due_date: '03/15/2026', status: 'pending', description: 'Check in on onboarding progress',
  },
  event: {
    id: 'fc-e-1', title: 'Onboarding Webinar', start_at: '2026-03-20T14:00:00Z',
    end_at: '2026-03-20T15:00:00Z', location: 'Zoom', subscriber_id: 'fc-sub-1',
  },
  activity: {
    id: 'fc-a-1', title: 'Email opened', subscriber_id: 'fc-sub-1',
    created_at: '2026-02-10T09:00:00Z', description: 'Welcome sequence email 1',
  },
};

const JETPACKCRM_FIXTURES = {
  account: {
    id: 'jp-co-1', name: 'Metro Youth Services', homeurl: 'https://metroyouth.org',
    maintel: '651-555-0200', city: 'Minneapolis', county: 'MN', postcode: '55402',
    notes: 'Youth programming partner',
  },
  contact: {
    id: 'jp-c-1', fname: 'James', lname: 'Wilson', email: 'James@Ministry.Org',
    hometel: '651-555-0201', jobTitle: 'Pastor', city: 'Bloomington', county: 'minnesota',
    company: 'jp-co-1',
  },
  contactOrphan: {
    id: 'jp-c-2', fname: 'Ana', lname: 'Rodriguez', email: 'ana@test.org',
  },
  task: {
    id: 'jp-t-1', title: 'Tenant Onboarding Call', customer: 'jp-c-1',
    from: '03/15/2026 13:00:00', to: '03/15/2026 14:00:00',
    notes: 'Initial CROS setup walkthrough', complete: 0,
  },
  taskCompleted: {
    id: 'jp-t-2', title: 'Welcome email sent', customer: 'jp-c-1', complete: 1,
  },
  activity: {
    id: 'jp-a-1', title: 'Invoice sent', customer: 'jp-c-1',
    date: '2026-02-15', notes: 'Partnership agreement invoice',
  },
};

const WPERP_FIXTURES = {
  account: {
    id: 'erp-co-1', company: 'Refugee Resettlement Alliance', website: 'https://rra.org',
    phone: '612-555-0300', city: 'Saint Paul', state: 'MN', postal_code: '55103',
    life_stage: 'customer', notes: 'Active CROS tenant since Jan 2026',
  },
  contact: {
    id: 'erp-c-1', first_name: 'Fatima', last_name: 'Ahmed',
    email: 'Fatima@RRA.org', phone: '612-555-0301', designation: 'Case Manager',
    city: 'Saint Paul', state: 'minnesota', company_id: 'erp-co-1',
  },
  contactOrphan: {
    id: 'erp-c-2', first_name: 'David', last_name: 'Lee', email: 'david@test.org',
  },
  task: {
    id: 'erp-t-1', title: 'Quarterly check-in', contact_id: 'erp-c-1',
    log_type: 'task', message: 'Quarterly check-in', start_date: '2026-04-01',
    status: 'open', extra: 'Review adoption metrics',
  },
  event: {
    id: 'erp-e-1', title: 'Community Gathering', start_date: '2026-05-10T10:00:00Z',
    end_date: '2026-05-10T12:00:00Z', location: 'Community Center', contact_id: 'erp-c-1',
  },
  activity: {
    id: 'erp-a-1', message: 'Called about renewal', contact_id: 'erp-c-1',
    log_type: 'log', created_at: '2026-02-20T11:30:00Z', extra: 'Discussed pricing tier',
  },
};

// ── Shared assertion helpers ──

function expectValidAccount(adapter: ConnectorAdapter, raw: Record<string, unknown>) {
  const { result, warnings } = adapter.normalizeAccount(raw);
  expect(result).not.toBeNull();
  expect(result!.external_id).toBeTruthy();
  expect(result!.organization).toBeTruthy();
  return { result: result!, warnings };
}

function expectValidContact(adapter: ConnectorAdapter, raw: Record<string, unknown>) {
  const { result, warnings } = adapter.normalizeContact(raw);
  expect(result).not.toBeNull();
  expect(result!.name).toBeTruthy();
  return { result: result!, warnings };
}

function expectNullResult(fn: () => { result: unknown; warnings: unknown[] }) {
  const { result, warnings } = fn();
  expect(result).toBeNull();
  expect(warnings.length).toBeGreaterThan(0);
}

// ── FluentCRM Tests ──

describe('FluentCRM Adapter', () => {
  const a = fluentcrmAdapter;

  it('normalizes account', () => {
    const { result } = expectValidAccount(a, FLUENTCRM_FIXTURES.account);
    expect(result.organization).toBe('Twin Cities Food Bank');
    expect(result.website_url).toBe('https://tcfb.org');
    expect(result.state).toBe('MN');
  });

  it('normalizes contact with email lowercasing', () => {
    const { result, warnings } = expectValidContact(a, FLUENTCRM_FIXTURES.contact);
    expect(result.name).toBe('Maria Garcia');
    expect(result.email).toBe('maria@example.org');
    expect(result.state).toBe('MN'); // minnesota → MN
    expect(result.account_external_id).toBe('fc-co-1');
    expect(warnings).toEqual([]); // has company_id, no orphan warning
  });

  it('flags orphan contact', () => {
    const { warnings } = expectValidContact(a, FLUENTCRM_FIXTURES.contactOrphan);
    expect(warnings.some(w => w.type === 'orphan_contact')).toBe(true);
  });

  it('rejects contact without name', () => {
    expectNullResult(() => a.normalizeContact(FLUENTCRM_FIXTURES.contactEmpty));
  });

  it('normalizes task with non-ISO date', () => {
    const { result, warnings } = a.normalizeTask(FLUENTCRM_FIXTURES.task);
    expect(result).not.toBeNull();
    expect(result!.title).toBe('Follow up with tenant');
    // 03/15/2026 is MM/DD/YYYY, should normalize with warning
    expect(result!.due_date).toBeTruthy();
    expect(warnings.some(w => w.type === 'invalid_date')).toBe(true);
  });

  it('normalizes event', () => {
    const { result } = a.normalizeEvent(FLUENTCRM_FIXTURES.event);
    expect(result).not.toBeNull();
    expect(result!.event_name).toBe('Onboarding Webinar');
    expect(result!.location).toBe('Zoom');
  });

  it('normalizes activity', () => {
    const { result } = a.normalizeActivity(FLUENTCRM_FIXTURES.activity);
    expect(result).not.toBeNull();
    expect(result!.title).toBe('Email opened');
  });
});

// ── Jetpack CRM Tests ──

describe('Jetpack CRM Adapter', () => {
  const a = jetpackcrmAdapter;

  it('normalizes account with Jetpack-specific fields', () => {
    const { result } = expectValidAccount(a, JETPACKCRM_FIXTURES.account);
    expect(result.organization).toBe('Metro Youth Services');
    expect(result.website_url).toBe('https://metroyouth.org');
    expect(result.phone).toBe('651-555-0200');
    expect(result.postal_code).toBe('55402');
  });

  it('normalizes contact with fname/lname pattern', () => {
    const { result } = expectValidContact(a, JETPACKCRM_FIXTURES.contact);
    expect(result.name).toBe('James Wilson');
    expect(result.email).toBe('james@ministry.org');
    expect(result.title).toBe('Pastor');
    expect(result.state).toBe('MN');
  });

  it('flags orphan contact', () => {
    const { warnings } = expectValidContact(a, JETPACKCRM_FIXTURES.contactOrphan);
    expect(warnings.some(w => w.type === 'orphan_contact')).toBe(true);
  });

  it('normalizes task with complete flag', () => {
    const { result: open } = a.normalizeTask(JETPACKCRM_FIXTURES.task);
    expect(open!.status).toBe('open');

    const { result: done } = a.normalizeTask(JETPACKCRM_FIXTURES.taskCompleted);
    expect(done!.status).toBe('completed');
  });

  it('normalizes event', () => {
    const { result } = a.normalizeEvent(JETPACKCRM_FIXTURES.task); // tasks double as events
    expect(result).not.toBeNull();
    expect(result!.event_name).toBe('Tenant Onboarding Call');
  });

  it('normalizes activity', () => {
    const { result } = a.normalizeActivity(JETPACKCRM_FIXTURES.activity);
    expect(result).not.toBeNull();
    expect(result!.title).toBe('Invoice sent');
  });
});

// ── WP ERP Tests ──

describe('WP ERP Adapter', () => {
  const a = wperpAdapter;

  it('normalizes account with life_stage as org_type', () => {
    const { result } = expectValidAccount(a, WPERP_FIXTURES.account);
    expect(result.organization).toBe('Refugee Resettlement Alliance');
    expect(result.org_type).toBe('customer');
    expect(result.state).toBe('MN');
  });

  it('normalizes contact with designation as title', () => {
    const { result } = expectValidContact(a, WPERP_FIXTURES.contact);
    expect(result.name).toBe('Fatima Ahmed');
    expect(result.title).toBe('Case Manager');
    expect(result.state).toBe('MN');
    expect(result.account_external_id).toBe('erp-co-1');
  });

  it('flags orphan contact', () => {
    const { warnings } = expectValidContact(a, WPERP_FIXTURES.contactOrphan);
    expect(warnings.some(w => w.type === 'orphan_contact')).toBe(true);
  });

  it('normalizes task from activity log', () => {
    const { result } = a.normalizeTask(WPERP_FIXTURES.task);
    expect(result).not.toBeNull();
    expect(result!.title).toBe('Quarterly check-in');
    expect(result!.contact_external_id).toBe('erp-c-1');
  });

  it('normalizes event', () => {
    const { result } = a.normalizeEvent(WPERP_FIXTURES.event);
    expect(result).not.toBeNull();
    expect(result!.event_name).toBe('Community Gathering');
    expect(result!.location).toBe('Community Center');
  });

  it('normalizes activity', () => {
    const { result } = a.normalizeActivity(WPERP_FIXTURES.activity);
    expect(result).not.toBeNull();
    expect(result!.title).toBe('Called about renewal');
    expect(result!.body_snippet).toContain('Discussed pricing tier');
  });
});

// ── Cross-adapter contract tests (all adapters, including stubs) ──

import { STUB_ADAPTERS } from '../stubAdapters';

const ALL_ADAPTERS: ConnectorAdapter[] = [
  salesforceAdapter, airtableAdapter, fluentcrmAdapter, jetpackcrmAdapter, wperpAdapter,
  ...Object.values(STUB_ADAPTERS),
];

describe('Adapter Contract: all adapters reject empty required fields', () => {
  for (const adapter of ALL_ADAPTERS) {
    it(`${adapter.displayName}: rejects empty account`, () => {
      expectNullResult(() => adapter.normalizeAccount({}));
    });
    it(`${adapter.displayName}: rejects empty contact`, () => {
      expectNullResult(() => adapter.normalizeContact({}));
    });
    it(`${adapter.displayName}: rejects empty task`, () => {
      expectNullResult(() => adapter.normalizeTask({}));
    });
    it(`${adapter.displayName}: rejects empty event`, () => {
      expectNullResult(() => adapter.normalizeEvent({}));
    });
    it(`${adapter.displayName}: rejects empty activity`, () => {
      expectNullResult(() => adapter.normalizeActivity({}));
    });
  }
});

describe('Adapter Contract: all adapters produce valid output for generic data', () => {
  const genericAccount = { id: 'gen-1', name: 'Test Org', Website: 'https://test.org', City: 'Dallas', State: 'TX' };
  const genericContact = { id: 'gen-c1', first_name: 'Test', last_name: 'User', email: 'test@test.org', account_id: 'gen-1' };

  for (const adapter of ALL_ADAPTERS) {
    it(`${adapter.displayName}: normalizes generic account`, () => {
      const { result } = adapter.normalizeAccount(genericAccount);
      expect(result).not.toBeNull();
      expect(result!.organization).toBeTruthy();
    });
    it(`${adapter.displayName}: normalizes generic contact`, () => {
      const { result } = adapter.normalizeContact(genericContact);
      expect(result).not.toBeNull();
      expect(result!.name).toBeTruthy();
    });
  }
});
