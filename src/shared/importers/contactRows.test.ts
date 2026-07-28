import { describe, expect, it } from 'vitest';

import { isReachable, mapRow, suggestMapping, unmappedHeaders } from './contactRows';

describe('mapRow', () => {
  it('applies the mapping and drops unmapped columns', () => {
    const row = { Name: 'A. Okonkwo', 'E-mail': 'A.Okonkwo@Example.org', Donated: '$40' };
    expect(mapRow(row, { Name: 'displayName', 'E-mail': 'email' })).toEqual({
      displayName: 'A. Okonkwo',
      email: 'a.okonkwo@example.org',
    });
  });

  // Must match the database's lower(email) unique index, or the preview says
  // "create" and the insert then conflicts.
  it('lowercases email and nothing else', () => {
    const mapped = mapRow(
      { e: 'MIXED@Case.ORG', n: 'Ada B. Márquez' },
      { e: 'email', n: 'displayName' },
    );
    expect(mapped.email).toBe('mixed@case.org');
    expect(mapped.displayName).toBe('Ada B. Márquez');
  });

  it('treats blank and whitespace-only cells as absent', () => {
    const mapped = mapRow({ n: '  ', e: '', p: '  555 0134  ' }, {
      n: 'displayName',
      e: 'email',
      p: 'phone',
    });
    expect(mapped).toEqual({ phone: '555 0134' });
  });

  it('ignores a mapped column the row does not have', () => {
    expect(mapRow({ n: 'Solo' }, { n: 'displayName', missing: 'email' })).toEqual({
      displayName: 'Solo',
    });
  });
});

describe('isReachable', () => {
  it('accepts a row with any one of name, email, or phone', () => {
    expect(isReachable({ displayName: 'A' })).toBe(true);
    expect(isReachable({ email: 'a@b.org' })).toBe(true);
    expect(isReachable({ phone: '555' })).toBe(true);
  });

  it('rejects a row with none of them', () => {
    expect(isReachable({})).toBe(false);
    expect(isReachable({ postalCode: '60625' })).toBe(false);
  });
});

describe('suggestMapping', () => {
  it('recognises the usual header spellings', () => {
    expect(suggestMapping(['Full Name', 'Email Address', 'Mobile', 'ZIP'])).toEqual({
      'Full Name': 'displayName',
      'Email Address': 'email',
      Mobile: 'phone',
      ZIP: 'postalCode',
    });
  });

  // Guessing on a second email column would silently overwrite the first.
  it('leaves a duplicate column for the organizer to resolve', () => {
    const suggestion = suggestMapping(['email', 'Email']);
    expect(Object.keys(suggestion)).toHaveLength(1);
    expect(suggestion.email).toBe('email');
  });

  it('suggests nothing for headers it does not recognise', () => {
    expect(suggestMapping(['Household Income', 'Immigration Status'])).toEqual({});
  });
});

describe('unmappedHeaders', () => {
  it('reports what will be dropped, so the UI can say so', () => {
    expect(unmappedHeaders(['Name', 'Notes', 'Score'], { Name: 'displayName' })).toEqual([
      'Notes',
      'Score',
    ]);
  });
});
