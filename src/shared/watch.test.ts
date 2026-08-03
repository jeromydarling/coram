/**
 * The two functions that decide what a group is told about, and the one that
 * decides where this Worker is willing to point itself.
 *
 * `matches` is the whole safety property of the watch list: it is the only
 * thing that creates a row, so a bug here is a hearing nobody hears about. Most
 * of this file is failure cases rather than happy paths, because the happy path
 * for substring matching is trivially right and the edges are where a monitor
 * turns into either a flood or a silence.
 */

import { describe, expect, it } from 'vitest';

import { MIN_TERM_LENGTH, matches, normaliseTerms, reasonUrlRefused } from './watch';

describe('matches', () => {
  it('finds a term regardless of case or spacing', () => {
    expect(matches('The RENT   Board meets Tuesday', ['rent board'])).toEqual(['rent board']);
  });

  /*
   * The flood.
   *
   * "rent" inside "current" and "ada" inside "Nevada" put every document in
   * the list, and a list that is always full is a list nobody reads — which
   * fails in exactly the same way as missing the document entirely, only more
   * expensively.
   */
  it('does not match a term inside a longer word', () => {
    expect(matches('the current arrangement', ['rent'])).toEqual([]);
    expect(matches('a Nevada matter', ['ada'])).toEqual([]);
    expect(matches('housing developments', ['develop'])).toEqual([]);
  });

  it('matches at the very start and the very end of the text', () => {
    expect(matches('Eviction notices filed', ['eviction'])).toEqual(['eviction']);
    expect(matches('Filed under eviction', ['eviction'])).toEqual(['eviction']);
  });

  it('matches next to punctuation, which is where most titles put it', () => {
    expect(matches('Ordinance (eviction), first reading', ['eviction'])).toEqual(['eviction']);
    expect(matches('Re: eviction—defence', ['eviction'])).toEqual(['eviction']);
  });

  /*
   * A bill number is the single most valuable thing to watch for and it is full
   * of characters a regex cares about. "SB 442" unescaped is merely wrong;
   * "C.S.H.B. 1" unescaped matches almost anything, because each dot becomes a
   * wildcard.
   */
  it('treats a bill number as text, not as a pattern', () => {
    expect(matches('Hearing on SB 442 scheduled', ['sb 442'])).toEqual(['sb 442']);
    expect(matches('Committee substitute C.S.H.B. 1', ['c.s.h.b. 1'])).toEqual(['c.s.h.b. 1']);
    // The dots must not have become wildcards.
    expect(matches('CxSxHxBx 1', ['c.s.h.b. 1'])).toEqual([]);
  });

  it('matches a hyphenated number, where a word boundary would not', () => {
    expect(matches('Ordinance 2026-14 adopted', ['2026-14'])).toEqual(['2026-14']);
  });

  it('returns every term that hit, not just the first', () => {
    expect(matches('Eviction hearing at the rent board', ['eviction', 'rent board', 'zoning'])).toEqual([
      'eviction',
      'rent board',
    ]);
  });

  it('does not let a phrase match a longer phrase that starts the same way', () => {
    expect(matches('the rent boarding house rules', ['rent board'])).toEqual([]);
  });

  it('finds nothing when there is nothing to find', () => {
    expect(matches('Parks and recreation budget', ['eviction'])).toEqual([]);
    expect(matches('anything at all', [])).toEqual([]);
  });
});

describe('normaliseTerms', () => {
  it('lowercases, trims and de-duplicates', () => {
    expect(normaliseTerms(['Eviction', ' eviction ', 'RENT  BOARD'])).toEqual(['eviction', 'rent board']);
  });

  /* A two-letter term matches half of every agenda. Three is the floor. */
  it('drops terms too short to mean anything', () => {
    expect(normaliseTerms(['a', 'of', 'adu'])).toEqual(['adu']);
    expect(MIN_TERM_LENGTH).toBe(3);
  });

  it('caps the list rather than storing whatever was pasted in', () => {
    const many = Array.from({ length: 100 }, (_, i) => `term${i}`);
    expect(normaliseTerms(many).length).toBeLessThanOrEqual(24);
  });
});

/*
 * This is a URL an authenticated user types into a box, and the Worker then
 * fetches it from the Worker's own network position. Everything below is a
 * refusal, because the interesting cases here are all refusals.
 */
describe('reasonUrlRefused', () => {
  it('allows an ordinary published feed', () => {
    expect(reasonUrlRefused('https://city.example.gov/agendas/rss')).toBeNull();
    expect(reasonUrlRefused('https://www.example.org/feed.xml?committee=7')).toBeNull();
  });

  it('refuses plain http, and says why', () => {
    const reason = reasonUrlRefused('http://city.example.gov/rss');
    expect(reason).toMatch(/https/i);
  });

  it('refuses anything that is not http at all', () => {
    for (const url of ['file:///etc/passwd', 'ftp://example.org/f', 'data:text/xml,<rss/>']) {
      expect(reasonUrlRefused(url), url).not.toBeNull();
    }
  });

  it('refuses an address literal in either family', () => {
    for (const url of [
      'https://127.0.0.1/rss',
      'https://10.0.0.5/rss',
      'https://169.254.169.254/latest/meta-data',
      'https://[::1]/rss',
    ]) {
      expect(reasonUrlRefused(url), url).not.toBeNull();
    }
  });

  it('refuses names that only resolve inside a network', () => {
    for (const url of [
      'https://localhost/rss',
      'https://metadata/rss',
      'https://printer.local/rss',
      'https://db.internal/rss',
    ]) {
      expect(reasonUrlRefused(url), url).not.toBeNull();
    }
  });

  it('refuses a non-standard port', () => {
    expect(reasonUrlRefused('https://example.org:8443/rss')).not.toBeNull();
    // The default, written out, is still the default.
    expect(reasonUrlRefused('https://example.org:443/rss')).toBeNull();
  });

  it('refuses credentials in the address', () => {
    expect(reasonUrlRefused('https://user:pass@example.org/rss')).not.toBeNull();
  });

  it('refuses something that is not a URL at all', () => {
    expect(reasonUrlRefused('city agendas')).not.toBeNull();
    expect(reasonUrlRefused('')).not.toBeNull();
  });

  /* Every refusal is shown to the person who typed the URL. */
  it('always explains itself in a sentence', () => {
    for (const url of ['http://x.org', 'https://127.0.0.1', 'nonsense']) {
      const reason = reasonUrlRefused(url)!;
      expect(reason.length, url).toBeGreaterThan(20);
      expect(reason.endsWith('.'), url).toBe(true);
    }
  });
});
