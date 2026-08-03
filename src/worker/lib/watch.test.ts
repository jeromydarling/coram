/**
 * The boundary between "a document matched the group's words" and "a model had
 * an opinion about it".
 *
 * The tests that matter here are the ones asserting that the model cannot
 * remove anything. Everything else in this module degrades gracefully; that one
 * property, if it broke, would break silently and would look like a quiet week.
 */

import { describe, expect, it } from 'vitest';

import { matchCandidates, parseReading, type Candidate } from './watch';

const doc = (title: string, abstract = ''): Candidate => ({
  externalId: title,
  title,
  url: 'https://example.gov/x',
  publishedAt: null,
  abstract,
});

describe('matchCandidates', () => {
  it('keeps a document whose title matched', () => {
    const out = matchCandidates([doc('Rent board hearing')], ['rent board']);
    expect(out).toHaveLength(1);
    expect(out[0].matchedTerms).toEqual(['rent board']);
  });

  /*
   * An agenda line is routinely "Item 7(b) — Ordinance 2026-14" with the
   * subject only in the body. Matching titles alone would miss precisely the
   * documents a group most needs to hear about, which is the failure mode this
   * whole feature exists to prevent.
   */
  it('matches the upstream abstract as well as the title', () => {
    const out = matchCandidates(
      [doc('Item 7(b) — Ordinance 2026-14', 'Amends the eviction defence fund.')],
      ['eviction'],
    );
    expect(out).toHaveLength(1);
  });

  it('drops a document that matched nothing', () => {
    expect(matchCandidates([doc('Parks budget')], ['eviction'])).toEqual([]);
  });

  /*
   * No terms means no rows, rather than every row.
   *
   * A workspace with its topics switched off getting the entire council agenda
   * dumped into its list is how somebody stops trusting the feature on day one.
   */
  it('returns nothing at all when there are no terms', () => {
    expect(matchCandidates([doc('Anything')], [])).toEqual([]);
  });

  it('records every term that hit, for the badge under the item', () => {
    const out = matchCandidates(
      [doc('Eviction and zoning', 'the rent board considered both')],
      ['eviction', 'zoning', 'rent board', 'transit'],
    );
    expect(out[0].matchedTerms).toEqual(['eviction', 'zoning', 'rent board']);
  });
});

describe('parseReading', () => {
  it('reads a clean answer', () => {
    expect(parseReading('{"summary":"The board will hear four cases.","relevance":88}')).toEqual({
      summary: 'The board will hear four cases.',
      relevance: 88,
    });
  });

  /*
   * Models wrap JSON in prose and in code fences often enough that a strict
   * parse here would null out perfectly good summaries roughly one time in
   * twenty — and the row would look, on screen, exactly like an item the model
   * could not read.
   */
  it('finds the object inside a fence or a sentence', () => {
    for (const wrapper of [
      '```json\n{"summary":"A.","relevance":40}\n```',
      'Here you go: {"summary":"A.","relevance":40}',
      '{"summary":"A.","relevance":40}\nHope that helps.',
    ]) {
      expect(parseReading(wrapper), wrapper).toEqual({ summary: 'A.', relevance: 40 });
    }
  });

  it('clamps a score outside the range instead of storing it', () => {
    expect(parseReading('{"summary":"A.","relevance":500}').relevance).toBe(100);
    expect(parseReading('{"summary":"A.","relevance":-9}').relevance).toBe(0);
    expect(parseReading('{"summary":"A.","relevance":72.6}').relevance).toBe(73);
  });

  it('accepts a score the model sent as a string', () => {
    expect(parseReading('{"summary":"A.","relevance":"60"}').relevance).toBe(60);
  });

  /*
   * Every one of these produces nulls, and nulls are a complete outcome: the
   * item is already stored with its title, link and date by the time this runs.
   * A model failure costs a summary, never a document.
   */
  it('degrades to nulls on anything it cannot read', () => {
    for (const bad of [
      '',
      'I am sorry, I cannot help with that.',
      '{"summary":',
      '{"relevance":"soon"}',
      '{"summary":"   ","relevance":null}',
      'null',
    ]) {
      expect(parseReading(bad), bad).toEqual({ summary: null, relevance: null });
    }
  });

  it('takes a summary even when the score is unusable, and the reverse', () => {
    expect(parseReading('{"summary":"A hearing.","relevance":"maybe"}')).toEqual({
      summary: 'A hearing.',
      relevance: null,
    });
    expect(parseReading('{"relevance":30}')).toEqual({ summary: null, relevance: 30 });
  });

  it('caps a summary that ran away', () => {
    const long = JSON.stringify({ summary: 'x'.repeat(5_000), relevance: 10 });
    expect(parseReading(long).summary!.length).toBeLessThanOrEqual(600);
  });
});
