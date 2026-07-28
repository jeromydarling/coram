import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  describeTake,
  isWaived,
  netCents,
  takeBasisPoints,
  takeCents,
  TAKE_BASIS_POINTS,
  WAIVED_KINDS,
  type FundKind,
} from './takerate';

describe('the waiver', () => {
  /*
   * §5.6 calls this a permanent product commitment and §10 names it as one of
   * three things not to soften under revenue pressure. If someone ever does,
   * this is the test that has to be deleted first — which is the point of
   * writing it.
   */
  it('takes nothing from bail or mutual aid', () => {
    expect(takeBasisPoints('bail')).toBe(0);
    expect(takeBasisPoints('mutual_aid')).toBe(0);

    // On a real bail fund's worth of money.
    expect(takeCents(2_500_00, 'bail')).toBe(0);
    expect(netCents(2_500_00, 'bail')).toBe(2_500_00);
    expect(takeCents(50_000_00, 'mutual_aid')).toBe(0);
  });

  it('lists exactly the two waived kinds', () => {
    expect([...WAIVED_KINDS].sort()).toEqual(['bail', 'mutual_aid']);
    expect(isWaived('bail')).toBe(true);
    expect(isWaived('mutual_aid')).toBe(true);
    expect(isWaived('general')).toBe(false);
    expect(isWaived('dues')).toBe(false);
  });

  it('cannot be edited at runtime', () => {
    expect(Object.isFrozen(TAKE_BASIS_POINTS)).toBe(true);
    expect(() => {
      (TAKE_BASIS_POINTS as Record<string, number>).bail = 100;
    }).toThrow();
    expect(takeBasisPoints('bail')).toBe(0);
  });

  it('says so at the point of donation', () => {
    expect(describeTake('bail')).toMatch(/takes nothing/i);
    expect(describeTake('general')).toMatch(/1%/);
  });
});

describe('takeCents', () => {
  it('is 1% on fundraising and dues', () => {
    expect(takeCents(100_00, 'general')).toBe(1_00);
    expect(takeCents(100_00, 'dues')).toBe(1_00);
    expect(netCents(100_00, 'general')).toBe(99_00);
  });

  // Truncating division, matching the SQL. Both round in the group's favour.
  it('rounds down, never up', () => {
    expect(takeCents(1_99, 'general')).toBe(1); // 1.99 cents -> 1
    expect(takeCents(5, 'general')).toBe(0); // a five cent gift costs nothing
    expect(netCents(5, 'general')).toBe(5);
  });

  it('handles a zero contribution', () => {
    expect(takeCents(0, 'general')).toBe(0);
  });

  it('refuses anything that is not a non-negative integer', () => {
    expect(() => takeCents(-1, 'general')).toThrow(RangeError);
    expect(() => takeCents(10.5, 'general')).toThrow(RangeError);
    expect(() => takeCents(Number.MAX_VALUE, 'general')).toThrow(RangeError);
  });
});

/*
 * The rate exists twice — here and in coram.take_basis_points() — because SQL
 * needs it inside a trigger and TypeScript needs it to quote a fee. Two copies
 * can drift, so this reads the migration and checks them against each other.
 */
describe('the SQL and TypeScript copies agree', () => {
  const sql = readFileSync(
    join(import.meta.dirname, '..', '..', '..', 'migrations', '0005_thesaurus.sql'),
    'utf8',
  );

  const declared = (kind: FundKind): number => {
    const match = sql.match(new RegExp(`WHEN '${kind}'\\s+THEN\\s+(\\d+)`));
    if (!match) throw new Error(`take_basis_points has no branch for ${kind}`);
    return Number(match[1]);
  };

  it.each(['general', 'dues', 'mutual_aid', 'bail'] as const)('%s matches', (kind) => {
    expect(declared(kind)).toBe(takeBasisPoints(kind));
  });

  it('leaves no configurable rate anywhere in the migration', () => {
    // Comments stripped first: the migration's own prose explains that there
    // is no take_rate column, and matching that would be the test reading the
    // documentation rather than the schema.
    const statements = sql.replace(/--[^\n]*/g, '');

    // A column or setting named like a rate is the shape this commitment would
    // erode into. It should not exist.
    expect(statements).not.toMatch(/\btake_rate\b|\bfee_percent\b|\bplatform_fee\w*\b/i);
    // Nor a per-tenant or per-fund override of the basis points.
    expect(statements).not.toMatch(/\b\w*take_bps\b|\bbasis_points\s+(integer|numeric|bigint)/i);
  });
});
