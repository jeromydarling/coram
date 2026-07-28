import { beforeEach, describe, expect, it } from 'vitest';

import {
  __resetRegistryForTests,
  allRules,
  registerTable,
  RetentionError,
  sweepableRules,
  sweepStatement,
  type RetentionRule,
} from './retention';

const base: RetentionRule = {
  table: 'contacts',
  retentionDays: 365,
  pii: 'contact',
  timestampColumn: 'created_at',
  tenantColumn: 'tenant_id',
  purge: 'delete',
  reason: 'The supporter CRM spine.',
};

beforeEach(() => __resetRegistryForTests());

describe('registerTable', () => {
  it('accepts a well-formed rule', () => {
    expect(registerTable(base)).toEqual(base);
    expect(allRules()).toHaveLength(1);
  });

  it('rejects a second registration of the same table', () => {
    registerTable(base);
    expect(() => registerTable(base)).toThrow(RetentionError);
  });

  it('rejects a table with no stated reason', () => {
    expect(() => registerTable({ ...base, reason: '   ' })).toThrow(/no reason/);
  });

  // §3.4 — this is the rule the whole file exists to enforce.
  it('rejects indefinite retention on anything holding personal data', () => {
    expect(() => registerTable({ ...base, retentionDays: null })).toThrow(/must declare retentionDays/);
  });

  it('allows indefinite retention only when there is no personal data', () => {
    expect(() =>
      registerTable({ ...base, table: 'tenants', retentionDays: null, pii: 'none' }),
    ).not.toThrow();
  });

  it('caps how long directly identifying data may be kept', () => {
    expect(() => registerTable({ ...base, retentionDays: 3650 })).toThrow(/cap/);
  });

  it('lets pseudonymous data outlive the contact cap', () => {
    expect(() => registerTable({ ...base, pii: 'pseudonym', retentionDays: 3650 })).not.toThrow();
  });

  it('requires anonymize rules to name the columns they null', () => {
    expect(() => registerTable({ ...base, purge: 'anonymize' })).toThrow(/names no columns/);
  });

  it('rejects anonymize columns on a delete rule, which would be a no-op', () => {
    expect(() => registerTable({ ...base, anonymizeColumns: ['email'] })).toThrow(/also names/);
  });
});

describe('sweepStatement', () => {
  it('builds a parameterized delete', () => {
    const { sql, cutoffDays } = sweepStatement(base);
    expect(sql).toContain('DELETE FROM "contacts"');
    expect(sql).toContain('"created_at" < now() - ($1');
    expect(cutoffDays).toBe(365);
  });

  it('builds an anonymize that skips already-cleared rows', () => {
    const { sql } = sweepStatement({
      ...base,
      purge: 'anonymize',
      anonymizeColumns: ['email', 'phone'],
    });
    expect(sql).toContain('SET "email" = NULL, "phone" = NULL');
    // Without this the sweep rewrites the whole historical table every night.
    expect(sql).toContain('"email" IS NOT NULL');
  });

  it('refuses to build SQL for an identifier that is not a plain name', () => {
    expect(() => sweepStatement({ ...base, table: 'contacts"; DROP TABLE users; --' })).toThrow(
      /suspicious identifier/,
    );
  });

  it('refuses to sweep a table with no finite retention', () => {
    expect(() => sweepStatement({ ...base, retentionDays: null, pii: 'none' })).toThrow(
      /not sweepable/,
    );
  });
});

describe('sweepableRules', () => {
  it('omits tables that live as long as the workspace', () => {
    registerTable(base);
    registerTable({ ...base, table: 'tenants', retentionDays: null, pii: 'none' });

    expect(sweepableRules().map((r) => r.table)).toEqual(['contacts']);
  });
});
