/**
 * CSV format detection and column mapping tests.
 *
 * WHAT: Tests detect() and map() for all CSV importer presets.
 * WHERE: src/lib/importers/Importer.ts, src/lib/importers/GivingCSVImporter.ts
 * WHY: Ensures auto-detection and column mapping work for each supported CRM export format.
 */
import { describe, it, expect } from 'vitest';
import { GenericCSVImporter, HubSpotCSVImporter } from '@/lib/importers/Importer';
import {
  GivingCSVImporter,
  BloomerangGivingImporter,
  NeonCRMGivingImporter,
  DonorPerfectGivingImporter,
  LGLGivingImporter,
  GIVING_TARGET_FIELDS,
} from '@/lib/importers/GivingCSVImporter';

// ─── GenericCSVImporter ────────────────────────────────

describe('GenericCSVImporter', () => {
  const importer = new GenericCSVImporter();

  it('detects generic_csv source system', () => {
    expect(importer.detect(['Name', 'Email'], 'generic_csv')).toBe(true);
  });

  it('detects any non-empty headers as generic', () => {
    expect(importer.detect(['col1'], '')).toBe(true);
  });

  it('map() returns empty for generic (no auto-mapping)', () => {
    expect(importer.map(['Name', 'Email'])).toEqual({});
  });

  it('preview() returns limited rows with mapped fields', () => {
    const data = Array.from({ length: 30 }, (_, i) => ({
      Name: `Person ${i}`,
      Email: `p${i}@test.com`,
    }));
    const mapping = { Name: 'name', Email: 'email' };
    const preview = importer.preview(data, mapping, 5);
    expect(preview).toHaveLength(5);
    expect(preview[0].action).toBe('create');
    expect(preview[0].data.name).toBe('Person 0');
  });
});

// ─── HubSpotCSVImporter ───────────────────────────────

describe('HubSpotCSVImporter', () => {
  const importer = new HubSpotCSVImporter();

  it('detects hubspot_export source system', () => {
    expect(importer.detect([], 'hubspot_export')).toBe(true);
  });

  it('auto-detects HubSpot by column names', () => {
    expect(importer.detect(['Company name', 'Industry', 'City'], '')).toBe(true);
    expect(importer.detect(['Record ID', 'Phone Number'], '')).toBe(true);
  });

  it('does NOT detect non-HubSpot headers', () => {
    expect(importer.detect(['First Name', 'Amount', 'Date'], '')).toBe(false);
  });

  it('maps HubSpot columns correctly', () => {
    const mapping = importer.map(['Company name', 'Email', 'Job Title', 'Unknown Col']);
    expect(mapping['Company name']).toBe('organization');
    expect(mapping['Email']).toBe('email');
    expect(mapping['Job Title']).toBe('title');
    expect(mapping['Unknown Col']).toBeUndefined();
  });

  it('handles case-sensitive HubSpot variations', () => {
    const mapping = importer.map(['Company Name', 'Company name']);
    expect(mapping['Company Name']).toBe('organization');
    expect(mapping['Company name']).toBe('organization');
  });
});

// ─── GivingCSVImporter ────────────────────────────────

describe('GivingCSVImporter', () => {
  const importer = new GivingCSVImporter();

  it('detects giving_csv source system', () => {
    expect(importer.detect([], 'giving_csv')).toBe(true);
  });

  it('auto-detects by giving-specific columns (needs 2+)', () => {
    expect(importer.detect(['Amount', 'Gift Date', 'Name'], '')).toBe(true);
    expect(importer.detect(['amount', 'donation date'], '')).toBe(true);
  });

  it('does NOT detect with only 1 giving signal', () => {
    expect(importer.detect(['Amount', 'Company', 'City'], '')).toBe(false);
  });

  it('maps giving aliases case-insensitively', () => {
    const mapping = importer.map(['Gift Date', 'Amount', 'Email', 'First Name']);
    expect(mapping['Gift Date']).toBe('gift_date');
    expect(mapping['Amount']).toBe('amount');
    expect(mapping['Email']).toBe('email');
    expect(mapping['First Name']).toBe('first_name');
  });

  it('preview parses amount as number', () => {
    const data = [{ Amount: '$1,500.00', 'Gift Date': '2025-01-01' }];
    const mapping = { Amount: 'amount', 'Gift Date': 'gift_date' };
    const preview = importer.preview(data, mapping);
    expect(preview[0].data.amount).toBe(1500);
  });

  it('preview normalizes recurring boolean', () => {
    const data = [{ Recurring: 'Yes', Amount: '100' }];
    const mapping = { Recurring: 'is_recurring', Amount: 'amount' };
    const preview = importer.preview(data, mapping);
    expect(preview[0].data.is_recurring).toBe(true);
  });
});

// ─── BloomerangGivingImporter ─────────────────────────

describe('BloomerangGivingImporter', () => {
  const importer = new BloomerangGivingImporter();

  it('detects bloomerang_giving source system', () => {
    expect(importer.detect([], 'bloomerang_giving')).toBe(true);
  });

  it('auto-detects by Bloomerang-specific columns', () => {
    expect(importer.detect(['FundName', 'Amount', 'Date'], '')).toBe(true);
    expect(importer.detect(['CampaignName', 'Date'], '')).toBe(true);
  });

  it('maps Bloomerang columns correctly', () => {
    const mapping = importer.map(['Date', 'Amount', 'FundName', 'IsRecurring']);
    expect(mapping['Date']).toBe('gift_date');
    expect(mapping['Amount']).toBe('amount');
    expect(mapping['FundName']).toBe('note');
    expect(mapping['IsRecurring']).toBe('is_recurring');
  });
});

// ─── NeonCRMGivingImporter ────────────────────────────

describe('NeonCRMGivingImporter', () => {
  const importer = new NeonCRMGivingImporter();

  it('detects neoncrm_giving source system', () => {
    expect(importer.detect([], 'neoncrm_giving')).toBe(true);
  });

  it('auto-detects by NeonCRM columns', () => {
    expect(importer.detect(['Donation Date', 'Amount'], '')).toBe(true);
    expect(importer.detect(['donationDate', 'donationStatus'], '')).toBe(true);
  });

  it('maps NeonCRM columns', () => {
    const mapping = importer.map(['Donation Date', 'Amount', 'Campaign Name']);
    expect(mapping['Donation Date']).toBe('gift_date');
    expect(mapping['Amount']).toBe('amount');
    expect(mapping['Campaign Name']).toBe('note');
  });
});

// ─── DonorPerfectGivingImporter ───────────────────────

describe('DonorPerfectGivingImporter', () => {
  const importer = new DonorPerfectGivingImporter();

  it('detects donorperfect_giving source system', () => {
    expect(importer.detect([], 'donorperfect_giving')).toBe(true);
  });

  it('auto-detects by DonorPerfect columns (needs 2+)', () => {
    expect(importer.detect(['gift_date', 'gl_code', 'Amount'], '')).toBe(true);
    expect(importer.detect(['record_type', 'solicit_code'], '')).toBe(true);
  });

  it('does NOT detect with only 1 DP signal', () => {
    expect(importer.detect(['gift_date', 'Name'], '')).toBe(false);
  });
});

// ─── LGLGivingImporter ───────────────────────────────

describe('LGLGivingImporter', () => {
  const importer = new LGLGivingImporter();

  it('detects lgl_giving source system', () => {
    expect(importer.detect([], 'lgl_giving')).toBe(true);
  });

  it('auto-detects by LGL columns', () => {
    expect(importer.detect(['Received On', 'Amount'], '')).toBe(true);
    expect(importer.detect(['fund_name', 'appeal_name'], '')).toBe(true);
  });

  it('maps LGL columns', () => {
    const mapping = importer.map(['Received On', 'Amount', 'Fund Name', 'Email']);
    expect(mapping['Received On']).toBe('gift_date');
    expect(mapping['Amount']).toBe('amount');
    expect(mapping['Fund Name']).toBe('note');
    expect(mapping['Email']).toBe('email');
  });
});

// ─── Cross-importer discrimination ───────────────────

describe('Format discrimination', () => {
  const importers = [
    new HubSpotCSVImporter(),
    new BloomerangGivingImporter(),
    new NeonCRMGivingImporter(),
    new DonorPerfectGivingImporter(),
    new LGLGivingImporter(),
  ];

  it('HubSpot headers are NOT detected as giving', () => {
    const hubspotHeaders = ['Company name', 'Company Domain Name', 'Record ID'];
    const giving = new GivingCSVImporter();
    expect(giving.detect(hubspotHeaders, '')).toBe(false);
  });

  it('generic fallback detects everything', () => {
    const generic = new GenericCSVImporter();
    expect(generic.detect(['anything'], '')).toBe(true);
    expect(generic.detect(['Company name'], '')).toBe(true);
  });
});

// ─── GIVING_TARGET_FIELDS ────────────────────────────

describe('GIVING_TARGET_FIELDS', () => {
  it('includes core giving fields', () => {
    expect(GIVING_TARGET_FIELDS).toContain('gift_date');
    expect(GIVING_TARGET_FIELDS).toContain('amount');
    expect(GIVING_TARGET_FIELDS).toContain('is_recurring');
    expect(GIVING_TARGET_FIELDS).toContain('email');
  });

  it('has no duplicate fields', () => {
    expect(new Set(GIVING_TARGET_FIELDS).size).toBe(GIVING_TARGET_FIELDS.length);
  });
});
