/**
 * Tests the registry as it actually is, rather than with synthetic rules.
 *
 * retention.test.ts proves the rules of registration. This proves the tables we
 * really shipped obey them — the two catch different mistakes, and this is the
 * one that would notice a new module registering something careless.
 */

import { describe, expect, it } from 'vitest';

import { allRules, getRule, sweepableRules, sweepStatement } from '../retention';
import './index';

describe('the registered schema', () => {
  it('registers every table exactly once and none of them twice', () => {
    const names = allRules().map((r) => r.table);
    expect(new Set(names).size).toBe(names.length);
    expect(names.length).toBeGreaterThan(20);
  });

  it('produces valid sweep SQL for every sweepable table', () => {
    for (const rule of sweepableRules()) {
      const { sql, cutoffDays } = sweepStatement(rule);

      expect(sql, rule.table).toContain(`"${rule.table}"`);
      expect(sql, rule.table).toContain(`"${rule.timestampColumn}"`);
      // The cutoff must be a bind parameter, never interpolated.
      expect(sql, rule.table).toContain('$1');
      expect(cutoffDays, rule.table).toBeGreaterThan(0);
    }
  });

  it('gives every table a reason someone could act on', () => {
    for (const rule of allRules()) {
      // Long enough to be a justification rather than a restatement of the
      // table name. §3 rule 4 asks for the shipped feature that breaks
      // without it, and that does not fit in four words.
      expect(rule.reason.length, rule.table).toBeGreaterThan(40);
    }
  });

  it('keeps no directly identifying data indefinitely', () => {
    for (const rule of allRules()) {
      if (rule.pii === 'contact' || rule.pii === 'protected') {
        expect(rule.retentionDays, rule.table).not.toBeNull();
      }
    }
  });

  // §3.7 permits an IP address only inside a 24-hour rate-limit window, which
  // lives in KV. If one ever appears in a Postgres table this should be the
  // thing that notices.
  it('has no table whose name suggests it holds network identifiers', () => {
    for (const rule of allRules()) {
      expect(rule.table).not.toMatch(/(^|_)(ip|ips|ip_address|device|fingerprint)s?($|_)/);
    }
  });
});

describe('check_ins', () => {
  const rule = () => getRule('check_ins')!;

  it('anonymizes rather than deletes, so attendance counts stay honest', () => {
    expect(rule().purge).toBe('anonymize');
    expect(rule().anonymizeColumns).toEqual(['contact_id']);
  });

  it('nulls the contact and leaves the row', () => {
    const { sql } = sweepStatement(rule());

    expect(sql).toMatch(/^UPDATE/);
    expect(sql).toContain('"contact_id" = NULL');
    expect(sql).not.toContain('DELETE');
    // Without this guard every sweep rewrites the whole historical table.
    expect(sql).toContain('"contact_id" IS NOT NULL');
  });
});

describe('contacts', () => {
  it('ages from last touch, not from creation', () => {
    // Measuring from created_at would purge a supporter a group has been
    // organizing with for years, purely because the record is old.
    expect(getRule('contacts')!.timestampColumn).toBe('updated_at');
  });
});
