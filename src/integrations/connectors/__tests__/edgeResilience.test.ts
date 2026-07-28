/**
 * Edge Function Resilience Tests — Confidence Ladder Rung 3
 *
 * WHAT: Validates sync infrastructure patterns (idempotency, error envelopes, logging).
 * WHERE: Vitest — run via `bun run test`.
 * WHY: Sync plumbing must be reliable and safe regardless of adapter.
 *
 * Tests the CONTRACT of the sync pipeline, not the edge functions themselves
 * (those are tested in supabase/functions/tests/).
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
import type { ConnectorAdapter, MappingWarning } from '../types';

const ALL_ADAPTERS: ConnectorAdapter[] = [
  salesforceAdapter,
  dynamics365Adapter,
  civicrmAdapter,
  airtableAdapter,
  fluentcrmAdapter,
  jetpackcrmAdapter,
  wperpAdapter,
  ...Object.values(STUB_ADAPTERS),
];

// ── Idempotency: Same input → same output ──

describe('Resilience: Adapter idempotency', () => {
  const stableAccount = {
    Id: 'idem-1',
    Name: 'Idempotent Org',
    name: 'Idempotent Org',
    Website: 'https://idem.org',
    City: 'Denver',
    State: 'CO',
  };

  const stableContact = {
    Id: 'idem-c-1',
    first_name: 'Stable',
    last_name: 'Output',
    FirstName: 'Stable',
    LastName: 'Output',
    email: 'stable@test.org',
    Email: 'stable@test.org',
    account_id: 'idem-1',
    AccountId: 'idem-1',
  };

  for (const adapter of ALL_ADAPTERS) {
    it(`${adapter.displayName}: same account input → identical output on repeated calls`, () => {
      const r1 = adapter.normalizeAccount(stableAccount);
      const r2 = adapter.normalizeAccount(stableAccount);
      expect(r1.result).toEqual(r2.result);
      expect(r1.warnings).toEqual(r2.warnings);
    });

    it(`${adapter.displayName}: same contact input → identical output on repeated calls`, () => {
      const r1 = adapter.normalizeContact(stableContact);
      const r2 = adapter.normalizeContact(stableContact);
      expect(r1.result).toEqual(r2.result);
    });
  }
});

// ── Error envelope: Failures produce structured warnings, not exceptions ──

describe('Resilience: Structured error output (no unhandled exceptions)', () => {
  const badInputs = [
    {},
    { Id: null },
    { Name: undefined, name: undefined },
    { Id: '', Name: '' },
    { Id: 0, Name: false },
    { Id: [], Name: {} },
  ];

  for (const adapter of ALL_ADAPTERS) {
    for (const input of badInputs) {
      it(`${adapter.displayName}: normalizeAccount(${JSON.stringify(input)}) returns structured result`, () => {
        const output = adapter.normalizeAccount(input as any);
        expect(output).toHaveProperty('result');
        expect(output).toHaveProperty('warnings');
        expect(Array.isArray(output.warnings)).toBe(true);
        // result is either null (rejected) or a valid NormalizedAccount
        if (output.result !== null) {
          expect(output.result).toHaveProperty('external_id');
          expect(output.result).toHaveProperty('organization');
        }
      });

      it(`${adapter.displayName}: normalizeContact(${JSON.stringify(input)}) returns structured result`, () => {
        const output = adapter.normalizeContact(input as any);
        expect(output).toHaveProperty('result');
        expect(output).toHaveProperty('warnings');
        if (output.result !== null) {
          expect(output.result).toHaveProperty('name');
        }
      });
    }
  }
});

// ── Warning type consistency ──

describe('Resilience: Warning types are from the allowed set', () => {
  const ALLOWED_WARNING_TYPES = [
    'duplicate_email',
    'missing_required',
    'invalid_date',
    'orphan_contact',
    'truncated_field',
    'normalization',
  ];

  for (const adapter of ALL_ADAPTERS) {
    it(`${adapter.displayName}: all warnings use valid MappingWarning types`, () => {
      // Run through various inputs to collect warnings
      const allWarnings: MappingWarning[] = [];

      const inputs = [
        { Id: 'w-1' },  // missing name
        { Id: 'w-2', first_name: 'Test', email: 'test@test.org' },  // orphan
        { Id: 'w-3', Subject: 'Task', title: 'Task', ActivityDate: 'bad-date', due_date: 'bad-date' },
      ];

      for (const input of inputs) {
        allWarnings.push(...adapter.normalizeAccount(input).warnings);
        allWarnings.push(...adapter.normalizeContact(input).warnings);
        allWarnings.push(...adapter.normalizeTask(input).warnings);
        allWarnings.push(...adapter.normalizeEvent(input).warnings);
        allWarnings.push(...adapter.normalizeActivity(input).warnings);
      }

      for (const w of allWarnings) {
        expect(ALLOWED_WARNING_TYPES).toContain(w.type);
        expect(typeof w.message).toBe('string');
        expect(w.message.length).toBeGreaterThan(0);
      }
    });
  }
});

// ── Output shape validation ──

describe('Resilience: Normalized outputs have correct shape', () => {
  const validAccount = { Id: 'shape-a-1', Name: 'Shape Org', name: 'Shape Org' };
  const validContact = {
    Id: 'shape-c-1',
    first_name: 'Shape',
    last_name: 'User',
    FirstName: 'Shape',
    LastName: 'User',
    email: 'shape@test.org',
    Email: 'shape@test.org',
    account_id: 'shape-a-1',
    AccountId: 'shape-a-1',
  };
  const validTask = {
    Id: 'shape-t-1',
    Subject: 'Shape Task',
    title: 'Shape Task',
    Status: 'Open',
    status: 'Open',
  };

  for (const adapter of ALL_ADAPTERS) {
    it(`${adapter.displayName}: NormalizedAccount has all required fields`, () => {
      const { result } = adapter.normalizeAccount(validAccount);
      if (result) {
        expect(result).toHaveProperty('external_id');
        expect(result).toHaveProperty('organization');
        expect(result).toHaveProperty('website_url');
        expect(result).toHaveProperty('phone');
        expect(result).toHaveProperty('address');
        expect(result).toHaveProperty('city');
        expect(result).toHaveProperty('state');
        expect(result).toHaveProperty('postal_code');
        expect(result).toHaveProperty('description');
        expect(result).toHaveProperty('org_type');
        expect(result).toHaveProperty('industry');
      }
    });

    it(`${adapter.displayName}: NormalizedContact has all required fields`, () => {
      const { result } = adapter.normalizeContact(validContact);
      if (result) {
        expect(result).toHaveProperty('external_id');
        expect(result).toHaveProperty('account_external_id');
        expect(result).toHaveProperty('name');
        expect(result).toHaveProperty('email');
        expect(result).toHaveProperty('phone');
        expect(result).toHaveProperty('title');
        expect(result).toHaveProperty('city');
        expect(result).toHaveProperty('state');
      }
    });

    it(`${adapter.displayName}: NormalizedTask has all required fields`, () => {
      const { result } = adapter.normalizeTask(validTask);
      if (result) {
        expect(result).toHaveProperty('external_id');
        expect(result).toHaveProperty('contact_external_id');
        expect(result).toHaveProperty('account_external_id');
        expect(result).toHaveProperty('title');
        expect(result).toHaveProperty('status');
        expect(result).toHaveProperty('priority');
        expect(result).toHaveProperty('due_date');
        expect(result).toHaveProperty('description');
      }
    });
  }
});

// ── Truncation safety ──

describe('Resilience: Long text fields are safely truncated', () => {
  const longText = 'A'.repeat(10000);

  for (const adapter of ALL_ADAPTERS) {
    it(`${adapter.displayName}: activity body is truncated to max 200 chars`, () => {
      const { result } = adapter.normalizeActivity({
        Id: 'trunc-1',
        Title: 'Truncation test',
        title: 'Truncation test',
        Subject: 'Truncation test',
        Body: longText,
        body: longText,
        notes: longText,
        description: longText,
        CreatedDate: '2026-01-01',
        created_at: '2026-01-01',
      });
      if (result?.body_snippet) {
        expect(result.body_snippet.length).toBeLessThanOrEqual(200);
      }
    });

    it(`${adapter.displayName}: account description is truncated`, () => {
      const { result } = adapter.normalizeAccount({
        Id: 'trunc-2',
        Name: 'Trunc Org',
        name: 'Trunc Org',
        Description: longText,
        description: longText,
        notes: longText,
      });
      if (result?.description) {
        expect(result.description.length).toBeLessThanOrEqual(200);
      }
    });
  }
});
