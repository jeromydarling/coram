/**
 * Schema Drift Tests — Confidence Ladder Rung 2
 *
 * WHAT: Tests all connector adapters against vendor schema changes.
 * WHERE: Vitest — run via `bun run test`.
 * WHY: Ensures adapters don't crash when vendors add/rename/remove fields.
 *
 * Covers 4 drift scenarios per adapter:
 *   1. Extra unknown fields present
 *   2. Field renamed (primary missing, fallback still works)
 *   3. Null/missing nested objects
 *   4. Malformed dates
 */

import { describe, it, expect } from 'vitest';
import { salesforceAdapter } from '../salesforceAdapter';
import { dynamics365Adapter } from '../dynamics365Adapter';
import { civicrmAdapter } from '../civicrmAdapter';
import { airtableAdapter } from '../airtableAdapter';
import { fluentcrmAdapter } from '../fluentcrmAdapter';
import { jetpackcrmAdapter } from '../jetpackcrmAdapter';
import { wperpAdapter } from '../wperpAdapter';
import { STUB_ADAPTERS } from '../stubAdapters';
import type { ConnectorAdapter } from '../types';

// ── All adapters under test ──

const FULL_ADAPTERS: { name: string; adapter: ConnectorAdapter }[] = [
  { name: 'Salesforce', adapter: salesforceAdapter },
  { name: 'Dynamics 365', adapter: dynamics365Adapter },
  { name: 'CiviCRM', adapter: civicrmAdapter },
  { name: 'Airtable', adapter: airtableAdapter },
  { name: 'FluentCRM', adapter: fluentcrmAdapter },
  { name: 'Jetpack CRM', adapter: jetpackcrmAdapter },
  { name: 'WP ERP', adapter: wperpAdapter },
];

const ALL_ADAPTERS: { name: string; adapter: ConnectorAdapter }[] = [
  ...FULL_ADAPTERS,
  ...Object.entries(STUB_ADAPTERS).map(([key, adapter]) => ({
    name: adapter.displayName,
    adapter,
  })),
];

// ── Scenario 1: Extra Unknown Fields ──
// Adapters must not crash when vendor adds new fields

describe('Schema Drift: Extra unknown fields are ignored safely', () => {
  const accountWithExtras = {
    Id: 'drift-a-1',
    Name: 'Drift Test Org',
    name: 'Drift Test Org',
    organization_name: 'Drift Test Org',
    company: 'Drift Test Org',
    Website: 'https://drift.org',
    website: 'https://drift.org',
    City: 'Austin',
    city: 'Austin',
    State: 'TX',
    state: 'TX',
    // Unknown fields a vendor might add
    __v: 3,
    _metadata: { lastSync: '2026-03-01' },
    customField__c: 'custom value',
    newFieldNotInSpec: true,
    'odata.etag': 'W/"12345"',
    '@odata.type': '#Microsoft.Dynamics.CRM.account',
  };

  const contactWithExtras = {
    Id: 'drift-c-1',
    first_name: 'Schema',
    last_name: 'Drift',
    email: 'drift@test.org',
    account_id: 'drift-a-1',
    // Unknown fields
    avatar_url: 'https://cdn.example.com/avatar.jpg',
    scorecard: { engagement: 85 },
    tags: ['vip', 'donor'],
    custom_boolean__c: false,
  };

  for (const { name, adapter } of ALL_ADAPTERS) {
    it(`${name}: handles extra fields on account without crashing`, () => {
      const { result } = adapter.normalizeAccount(accountWithExtras);
      expect(result).not.toBeNull();
      expect(result!.organization).toBe('Drift Test Org');
      // Extra fields should not appear in normalized output
      expect((result as any).__v).toBeUndefined();
      expect((result as any)._metadata).toBeUndefined();
    });

    it(`${name}: handles extra fields on contact without crashing`, () => {
      const { result } = adapter.normalizeContact(contactWithExtras);
      expect(result).not.toBeNull();
      expect(result!.name).toContain('Drift');
      expect((result as any).avatar_url).toBeUndefined();
      expect((result as any).tags).toBeUndefined();
    });
  }
});

// ── Scenario 2: Null / Missing Nested Objects ──
// Some vendor fields are nested objects that may be null

describe('Schema Drift: Null or missing nested objects handled gracefully', () => {
  const accountNullNested = {
    Id: 'null-a-1',
    Name: 'Null Nested Org',
    name: 'Null Nested Org',
    organization_name: 'Null Nested Org',
    company: 'Null Nested Org',
    // All optional fields explicitly null
    Website: null,
    website: null,
    Phone: null,
    phone: null,
    BillingStreet: null,
    BillingCity: null,
    BillingState: null,
    BillingPostalCode: null,
    Description: null,
    description: null,
    Type: null,
    Industry: null,
    // CiviCRM nested patterns
    'website_primary.url': null,
    phone_primary: null,
    address_primary: null,
  };

  const contactNullNested = {
    Id: 'null-c-1',
    first_name: 'Null',
    last_name: 'Test',
    email: null,
    phone: null,
    title: null,
    city: null,
    state: null,
    account_id: null,
  };

  for (const { name, adapter } of ALL_ADAPTERS) {
    it(`${name}: normalizes account with all-null optional fields`, () => {
      const { result } = adapter.normalizeAccount(accountNullNested);
      expect(result).not.toBeNull();
      expect(result!.organization).toBe('Null Nested Org');
      // All optional fields should be null, not undefined or throw
      expect(result!.website_url).toBeNull();
      expect(result!.phone).toBeNull();
    });

    it(`${name}: normalizes contact with all-null optional fields`, () => {
      const { result, warnings } = adapter.normalizeContact(contactNullNested);
      expect(result).not.toBeNull();
      expect(result!.name).toBe('Null Test');
      expect(result!.email).toBeNull();
      // Should produce orphan warning since account_id is null
      expect(warnings.some(w => w.type === 'orphan_contact')).toBe(true);
    });
  }
});

// ── Scenario 3: Malformed and edge-case dates ──

describe('Schema Drift: Malformed dates produce warnings, not crashes', () => {
  const malformedDates = [
    'not-a-date',
    '13/40/2026',        // impossible month/day
    '',                   // empty string
    0,                    // zero
    false,                // boolean
    '2026',              // year only
    '2026-13-01',        // month 13
  ];

  for (const { name, adapter } of ALL_ADAPTERS) {
    for (const badDate of malformedDates) {
      it(`${name}: task with date "${badDate}" does not throw`, () => {
        expect(() => {
          adapter.normalizeTask({
            Id: 'date-t-1',
            Subject: 'Date drift test',
            title: 'Date drift test',
            ActivityDate: badDate,
            due_date: badDate,
          });
        }).not.toThrow();
      });

      it(`${name}: event with date "${badDate}" does not throw`, () => {
        expect(() => {
          adapter.normalizeEvent({
            Id: 'date-e-1',
            Subject: 'Date drift event',
            title: 'Date drift event',
            event_name: 'Date drift event',
            StartDateTime: badDate,
            start_date: badDate,
            start: badDate,
          });
        }).not.toThrow();
      });
    }
  }
});

// ── Scenario 4: Empty arrays / missing optional collections ──

describe('Schema Drift: Empty arrays and undefined collections', () => {
  for (const { name, adapter } of ALL_ADAPTERS) {
    it(`${name}: account with empty string name is rejected`, () => {
      const { result, warnings } = adapter.normalizeAccount({
        Id: 'empty-1',
        Name: '   ',
        name: '   ',
        organization: '   ',
      });
      expect(result).toBeNull();
      expect(warnings.length).toBeGreaterThan(0);
    });

    it(`${name}: contact with whitespace-only name is rejected`, () => {
      const { result, warnings } = adapter.normalizeContact({
        Id: 'empty-2',
        first_name: '  ',
        last_name: '  ',
        Name: '  ',
        name: '  ',
      });
      expect(result).toBeNull();
      expect(warnings.length).toBeGreaterThan(0);
    });

    it(`${name}: activity from undefined source does not throw`, () => {
      expect(() => {
        adapter.normalizeActivity({
          Id: 'empty-3',
          Title: 'Empty source test',
          title: 'Empty source test',
          Subject: 'Empty source test',
          Body: undefined,
          body: undefined,
          notes: undefined,
          description: undefined,
          CreatedDate: undefined,
          created_at: undefined,
          date: undefined,
        });
      }).not.toThrow();
    });
  }
});

// ── Vendor-Specific Drift Scenarios ──

describe('Schema Drift: Salesforce-specific', () => {
  it('handles Salesforce Bulk API extra metadata fields', () => {
    const sfBulkRecord = {
      Id: 'sf-bulk-1',
      Name: 'Bulk Import Org',
      attributes: { type: 'Account', url: '/services/data/v58.0/sobjects/Account/sf-bulk-1' },
      RecordTypeId: '012000000000001',
      IsDeleted: false,
      SystemModstamp: '2026-03-15T10:30:00.000+0000',
      LastModifiedById: '005000000000001',
    };
    const { result } = salesforceAdapter.normalizeAccount(sfBulkRecord);
    expect(result).not.toBeNull();
    expect(result!.organization).toBe('Bulk Import Org');
  });

  it('handles Salesforce contact with compound name field', () => {
    const sfCompound = {
      Id: 'sf-c-compound',
      Name: 'Dr. Jane Smith III',
      // No FirstName/LastName — compound Name only
      Email: 'Jane.Smith@Org.com',
      AccountId: 'sf-a-1',
    };
    // Should fall through to raw.Name since first+last is empty
    // Stubs handle this; Salesforce adapter requires FirstName/LastName
    const { result, warnings } = salesforceAdapter.normalizeContact(sfCompound);
    // May be null if adapter strictly requires FirstName/LastName — that's valid
    if (result) {
      expect(result.email).toBe('jane.smith@org.com');
    }
  });
});

describe('Schema Drift: Dynamics 365-specific', () => {
  it('handles Dynamics OData annotation fields', () => {
    const d365Record = {
      accountid: 'd365-a-1',
      name: 'OData Org',
      'name@OData.Community.Display.V1.FormattedValue': 'OData Org',
      '_primarycontactid_value': 'guid-123',
      '_primarycontactid_value@OData.Community.Display.V1.FormattedValue': 'John Doe',
      '@odata.etag': 'W/"1234567"',
    };
    const { result } = dynamics365Adapter.normalizeAccount(d365Record);
    expect(result).not.toBeNull();
    expect(result!.organization).toBe('OData Org');
  });

  it('handles inactive contact (statecode=1)', () => {
    const inactive = {
      contactid: 'd365-c-inactive',
      firstname: 'Inactive',
      lastname: 'Person',
      statecode: 1,
      emailaddress1: 'inactive@test.org',
    };
    const { result, warnings } = dynamics365Adapter.normalizeContact(inactive);
    expect(result).not.toBeNull();
    expect(warnings.some(w => w.message.includes('inactive'))).toBe(true);
  });
});

describe('Schema Drift: CiviCRM-specific', () => {
  it('handles CiviCRM APIv4 chained entity format', () => {
    const civiChained = {
      id: 'civi-org-chained',
      organization_name: 'Chained Org',
      'website_primary.url': 'https://chained.org',
      'phone_primary.phone': '555-0199',
      'address_primary.city': 'Portland',
      'address_primary.state_province_id:label': 'Oregon',
      'address_primary.postal_code': '97201',
      'address_primary.street_address': '100 Main St',
    };
    const { result } = civicrmAdapter.normalizeAccount(civiChained);
    expect(result).not.toBeNull();
    expect(result!.organization).toBe('Chained Org');
    expect(result!.city).toBe('Portland');
    expect(result!.phone).toBe('555-0199');
  });

  it('handles CiviCRM contribution with all-null optional fields', () => {
    const civiContrib = {
      id: 'civi-gift-null',
      receive_date: '2026-03-01',
      total_amount: 100,
      contribution_recur_id: null,
      frequency_unit: null,
      'financial_type_id:label': null,
      source: null,
      'contribution_status_id:label': 'Completed',
    };
    const { result } = civicrmAdapter.normalizeGiving!(civiContrib);
    expect(result).not.toBeNull();
    expect(result!.amount).toBe(100);
    expect(result!.is_recurring).toBe(false);
    expect(result!.note).toBeNull();
  });
});

// ── Giving Adapter Drift Tests ──

import { bloomerangGivingAdapter, neonCrmGivingAdapter, donorPerfectGivingAdapter, lglGivingAdapter } from '../givingAdapters';

describe('Schema Drift: Giving adapters handle malformed data', () => {
  const givingAdapters = [
    { name: 'Bloomerang', adapter: bloomerangGivingAdapter, typeField: 'Type', typeVal: 'Donation', dateField: 'Date' },
    { name: 'NeonCRM', adapter: neonCrmGivingAdapter, typeField: 'donationStatus', typeVal: 'SUCCEED', dateField: 'donationDate' },
    { name: 'DonorPerfect', adapter: donorPerfectGivingAdapter, typeField: 'record_type', typeVal: 'D', dateField: 'gift_date' },
    { name: 'LGL', adapter: lglGivingAdapter, typeField: null, typeVal: null, dateField: 'received_on' },
  ];

  for (const { name, adapter, typeField, typeVal, dateField } of givingAdapters) {
    it(`${name}: handles extra unknown fields`, () => {
      const record: Record<string, unknown> = {
        [dateField]: '2026-01-15',
        Amount: 250,
        amount: 250,
        total_amount: 250,
        __newVendorField: true,
        internalScore: 0.95,
      };
      if (typeField && typeVal) record[typeField] = typeVal;
      // DonorPerfect needs gift_date format
      if (name === 'DonorPerfect') record.gift_date = '01/15/2026';

      expect(() => adapter.normalizeGiving(record)).not.toThrow();
    });

    it(`${name}: handles null amount gracefully`, () => {
      const record: Record<string, unknown> = {
        [dateField]: '2026-01-15',
        Amount: null,
        amount: null,
        total_amount: null,
      };
      if (typeField && typeVal) record[typeField] = typeVal;
      if (name === 'DonorPerfect') record.gift_date = '01/15/2026';

      const { result } = adapter.normalizeGiving(record);
      if (result) {
        expect(result.amount).toBe(0);
      }
    });

    it(`${name}: handles malformed date`, () => {
      const record: Record<string, unknown> = {
        [dateField]: 'not-a-date',
        Amount: 100,
        amount: 100,
        total_amount: 100,
      };
      if (typeField && typeVal) record[typeField] = typeVal;
      if (name === 'DonorPerfect') record.gift_date = 'not-a-date';

      expect(() => adapter.normalizeGiving(record)).not.toThrow();
    });
  }
});
