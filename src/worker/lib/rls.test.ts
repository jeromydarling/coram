/**
 * The array literal builder.
 *
 * This exists because binding a JS array to a `text[]` column silently sends it
 * comma-joined and unbraced — see the note above `pgArray` in rls.ts — and the
 * failure only appears against a real Postgres, which a mocked API test never
 * touches. So the encoding gets its own tests, at the one point where it is
 * written down.
 *
 * The elements are words somebody typed into a text box. A comma, a brace or a
 * quote in one of them must not be able to change how many elements Postgres
 * sees, which is the property every case below is checking.
 */

import { describe, expect, it } from 'vitest';

import { pgArray } from './rls';

describe('pgArray', () => {
  it('builds a literal Postgres can read', () => {
    expect(pgArray(['eviction', 'lockout'])).toBe('{"eviction","lockout"}');
  });

  it('produces the empty literal, not an empty string', () => {
    expect(pgArray([])).toBe('{}');
  });

  /* A phrase is the normal case here — "rent board", "unlawful detainer". */
  it('keeps a phrase as one element', () => {
    expect(pgArray(['unlawful detainer'])).toBe('{"unlawful detainer"}');
  });

  /*
   * The one that matters. Unquoted, a comma inside an element would split it
   * into two, and a group watching for "Ordinance 14, section 2" would silently
   * end up watching for "section 2" as well.
   */
  it('does not let a comma inside an element become a separator', () => {
    expect(pgArray(['Ordinance 14, section 2'])).toBe('{"Ordinance 14, section 2"}');
  });

  it('escapes a double quote rather than ending the element', () => {
    expect(pgArray(['the "repairs" bill'])).toBe('{"the \\"repairs\\" bill"}');
  });

  it('escapes a backslash', () => {
    expect(pgArray(['a\\b'])).toBe('{"a\\\\b"}');
  });

  it('escapes a backslash before a quote in the right order', () => {
    // Naive replacement in the other order would double-escape the backslash
    // that the quote escape just introduced.
    expect(pgArray(['a\\"b'])).toBe('{"a\\\\\\"b"}');
  });

  it('keeps braces inside an element from nesting the literal', () => {
    expect(pgArray(['{not,an,array}'])).toBe('{"{not,an,array}"}');
  });

  it('quotes something that looks like NULL, so it stays a string', () => {
    expect(pgArray(['NULL'])).toBe('{"NULL"}');
  });

  /* Every element is quoted, so the count is always the input's length. */
  it('always produces exactly as many elements as it was given', () => {
    for (const input of [
      ['a'],
      ['a', 'b', 'c'],
      ['a,b'],
      ['a"b', 'c\\d'],
      ['{', '}', ','],
    ]) {
      const literal = pgArray(input);
      // Count unescaped separators: split on the commas between quoted runs.
      const separators = literal.slice(1, -1).match(/(?<!\\)","/g)?.length ?? 0;
      expect(separators, literal).toBe(input.length - 1);
    }
  });
});
