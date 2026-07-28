import { describe, it, expect } from 'vitest';
import { normalizeCsvColumns, parseCsvWithNormalization } from '../normalizeCsvColumns';

describe('normalizeCsvColumns', () => {
  it('maps clean people headers to canonical keys', () => {
    const headers = ['external_id', 'first_name', 'last_name', 'email', 'phone', 'address', 'city', 'state', 'zip'];
    const result = normalizeCsvColumns(headers, 'people');

    expect(result.canonicalHeaders).toEqual(headers);
    expect(result.unknownHeaders).toHaveLength(0);
    expect(result.headerMap['email']).toBe('email');
    expect(result.headerMap['first_name']).toBe('first_name');
  });

  it('maps messy people headers to canonical keys', () => {
    const headers = ['ID', 'First Name', 'Last Name', 'Email Address', 'Mobile Phone', 'Street Address', 'City', 'State', 'Postal Code'];
    const result = normalizeCsvColumns(headers, 'people');

    expect(result.canonicalHeaders).toEqual([
      'external_id', 'first_name', 'last_name', 'email', 'phone', 'address', 'city', 'state', 'zip',
    ]);
    expect(result.unknownHeaders).toHaveLength(0);
    expect(result.headerMap['ID']).toBe('external_id');
    expect(result.headerMap['Email Address']).toBe('email');
    expect(result.headerMap['Postal Code']).toBe('zip');
  });

  it('returns unknown headers that cannot be mapped', () => {
    const headers = ['first_name', 'favorite_color', 'shoe_size'];
    const result = normalizeCsvColumns(headers, 'people');

    expect(result.unknownHeaders).toEqual(['favorite_color', 'shoe_size']);
    expect(result.headerMap['first_name']).toBe('first_name');
  });

  it('maps clean membership headers to canonical keys', () => {
    const headers = ['group_name', 'email_or_phone'];
    const result = normalizeCsvColumns(headers, 'memberships');

    expect(result.canonicalHeaders).toEqual(['group_name', 'email_or_phone']);
    expect(result.unknownHeaders).toHaveLength(0);
  });

  it('maps messy membership aliases', () => {
    const headers = ['Ministry', 'Member Contact'];
    const result = normalizeCsvColumns(headers, 'memberships');

    expect(result.headerMap['Ministry']).toBe('group_name');
    expect(result.headerMap['Member Contact']).toBe('email_or_phone');
    expect(result.unknownHeaders).toHaveLength(0);
  });
});

describe('parseCsvWithNormalization', () => {
  it('parses clean CSV into normalized rows', () => {
    const csv = `external_id,first_name,last_name,email
fn_001,Grace,Johnson,grace.johnson@example.org
fn_002,Michael,Reyes,michael.reyes@example.org`;

    const { rows, normalization } = parseCsvWithNormalization(csv, 'people');

    expect(rows).toHaveLength(2);
    expect(rows[0].external_id).toBe('fn_001');
    expect(rows[0].first_name).toBe('Grace');
    expect(rows[1].email).toBe('michael.reyes@example.org');
    expect(normalization.unknownHeaders).toHaveLength(0);
  });

  it('parses messy header CSV correctly', () => {
    const csv = `ID,First Name,Last Name,Email Address
fn_001,Grace,Johnson,grace.johnson@example.org`;

    const { rows, normalization } = parseCsvWithNormalization(csv, 'people');

    expect(rows[0].external_id).toBe('fn_001');
    expect(rows[0].first_name).toBe('Grace');
    expect(rows[0].email).toBe('grace.johnson@example.org');
    expect(normalization.headerMap['ID']).toBe('external_id');
  });

  it('preserves unmapped columns in _raw', () => {
    const csv = `first_name,favorite_color
Grace,Blue`;

    const { rows } = parseCsvWithNormalization(csv, 'people');

    expect(rows[0].first_name).toBe('Grace');
    expect(rows[0]._raw).toBeDefined();
    expect(JSON.parse(rows[0]._raw)).toEqual({ favorite_color: 'Blue' });
  });
});
