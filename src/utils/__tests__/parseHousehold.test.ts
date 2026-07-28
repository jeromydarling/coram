import { describe, it, expect } from 'vitest';
import {
  parseHouseholdString,
  parseHouseholdMultiColumn,
  parseHouseholdSize,
  extractHouseholdFromRow,
  dedupeHouseholdMembers,
  householdDedupeSignature,
} from '../parseHousehold';

describe('parseHouseholdString', () => {
  it('parses parentheses format', () => {
    const result = parseHouseholdString('John (son); Mary (spouse); Ava (daughter)');
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ name: 'John', relationship: 'son', notes: null });
    expect(result[1]).toEqual({ name: 'Mary', relationship: 'spouse', notes: null });
    expect(result[2]).toEqual({ name: 'Ava', relationship: 'daughter', notes: null });
  });

  it('parses pipe-delimited format', () => {
    const result = parseHouseholdString('John|son, Mary|spouse, Ava|daughter');
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ name: 'John', relationship: 'son', notes: null });
    expect(result[1]).toEqual({ name: 'Mary', relationship: 'spouse', notes: null });
  });

  it('parses dash format', () => {
    const result = parseHouseholdString('John - son; Mary - spouse');
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ name: 'John', relationship: 'son', notes: null });
    expect(result[1]).toEqual({ name: 'Mary', relationship: 'spouse', notes: null });
  });

  it('parses names-only (no relationship)', () => {
    const result = parseHouseholdString('John; Mary; Ava');
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ name: 'John', relationship: null, notes: null });
  });

  it('returns empty for empty/null input', () => {
    expect(parseHouseholdString('')).toEqual([]);
    expect(parseHouseholdString('   ')).toEqual([]);
  });
});

describe('parseHouseholdMultiColumn', () => {
  it('extracts from numbered columns', () => {
    const row = {
      household_member_1_name: 'John',
      household_member_1_relationship: 'son',
      household_member_2_name: 'Mary',
      household_member_2_relationship: 'spouse',
      household_member_2_notes: 'Wheelchair user',
    };
    const result = parseHouseholdMultiColumn(row);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ name: 'John', relationship: 'son', notes: null });
    expect(result[1]).toEqual({ name: 'Mary', relationship: 'spouse', notes: 'Wheelchair user' });
  });

  it('handles family_member variant', () => {
    const row = { family_member_1_name: 'Ana', family_member_1_relationship: 'child' };
    const result = parseHouseholdMultiColumn(row);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Ana');
  });

  it('skips empty name columns', () => {
    const row = { household_member_1_name: '', household_member_2_name: 'Val' };
    const result = parseHouseholdMultiColumn(row);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Val');
  });
});

describe('parseHouseholdSize', () => {
  it('returns count from household_size', () => {
    expect(parseHouseholdSize({ household_size: '4' })).toBe(4);
  });

  it('returns count from family_size', () => {
    expect(parseHouseholdSize({ family_size: '3' })).toBe(3);
  });

  it('returns null when no size column', () => {
    expect(parseHouseholdSize({ name: 'John' })).toBeNull();
  });

  it('returns null for non-numeric', () => {
    expect(parseHouseholdSize({ household_size: 'large' })).toBeNull();
  });
});

describe('extractHouseholdFromRow', () => {
  it('prefers embedded column over multi-column', () => {
    const row = {
      household_members: 'John (son); Mary (spouse)',
      household_member_1_name: 'Other',
    };
    const { members } = extractHouseholdFromRow(row);
    expect(members).toHaveLength(2);
    expect(members[0].name).toBe('John');
  });

  it('falls back to multi-column when no embedded', () => {
    const row = { household_member_1_name: 'Ana' };
    const { members } = extractHouseholdFromRow(row);
    expect(members).toHaveLength(1);
  });

  it('returns householdSize independently', () => {
    const row = { household_size: '5' };
    const { members, householdSize } = extractHouseholdFromRow(row);
    expect(members).toHaveLength(0);
    expect(householdSize).toBe(5);
  });
});

describe('dedupeHouseholdMembers', () => {
  it('removes duplicates by name+relationship', () => {
    const members = [
      { name: 'John', relationship: 'son', notes: null },
      { name: 'john', relationship: 'Son', notes: 'extra' },
      { name: 'Mary', relationship: null, notes: null },
    ];
    const result = dedupeHouseholdMembers(members);
    expect(result).toHaveLength(2);
  });
});

describe('householdDedupeSignature', () => {
  it('produces consistent lowercase signatures', () => {
    const sig = householdDedupeSignature({ name: ' John ', relationship: ' Son ', notes: null });
    expect(sig).toBe('john|son');
  });
});
