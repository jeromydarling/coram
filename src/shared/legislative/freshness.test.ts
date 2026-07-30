import { describe, expect, it } from 'vitest';

import { PATHWAYS } from './index';
import { RESET_AFTER, allLinks, freshnessFor, freshnessSummary, verdictFor } from './freshness';

const BEFORE = new Date('2026-08-01T00:00:00Z');
const AFTER = new Date('2026-11-10T00:00:00Z');

describe('the date the numbers stop being true', () => {
  /*
   * The whole point of the module. On the night of a general election most
   * initiative thresholds are recomputed, and every figure here becomes wrong
   * at once with no error and nothing to notice.
   */
  it('calls a verified figure current before the election and unverified after', () => {
    expect(freshnessFor('CA', BEFORE)!.state).toBe('current');
    expect(freshnessFor('CA', AFTER)!.state).toBe('needs_verification');
  });

  it('tells the organizer to confirm with the state, naming it', () => {
    const v = freshnessFor('MO', AFTER)!;
    expect(v.message).toMatch(/confirm it with Missouri/i);
    expect(v.message).toMatch(/before gathering a single signature/i);
  });

  it('points at a source they can actually check', () => {
    for (const p of PATHWAYS) {
      const v = verdictFor(p, AFTER);
      if (v.state === 'needs_verification') expect(v.source).toMatch(/^https:\/\//);
    }
  });

  /*
   * Fails in the safe direction. After the reset date every fixed figure is
   * flagged, including the ones that did not move — over-warning costs a phone
   * call, under-warning costs a year of gathering against the wrong target.
   */
  it('flags every fixed figure after the reset, not a chosen subset', () => {
    for (const p of PATHWAYS) {
      if (p.statuteCountKind !== 'fixed') continue;
      expect(verdictFor(p, AFTER).state).toBe('needs_verification');
    }
  });
});

describe('what an election does not change', () => {
  /*
   * Nebraska and DC never had a fixed number, so they have nothing to go stale.
   * An election changes nothing about "use the formula and check the live
   * registration figure", and telling them to re-verify would be noise.
   */
  it.each(['NE', 'DC'])('%s never expires, because it never had a number', (code) => {
    for (const now of [BEFORE, AFTER]) {
      const v = freshnessFor(code, now)!;
      expect(v.state).toBe('never_expires');
      expect(v.message).toMatch(/registration/i);
    }
  });

  it('does not tell a state with no initiative to re-check its threshold', () => {
    const v = freshnessFor('TX', AFTER)!;
    expect(v.state).toBe('never_expires');
    expect(v.message).toMatch(/not something an election changes/i);
  });

  it('keeps an unverified figure unverified rather than promoting it', () => {
    const unverified = PATHWAYS.filter((p) => p.statuteCountKind === 'unverified');
    for (const p of unverified) {
      expect(verdictFor(p, BEFORE).state).toBe('unverified');
      expect(verdictFor(p, AFTER).state).toBe('unverified');
    }
  });

  it('returns null for a jurisdiction it does not cover', () => {
    expect(freshnessFor('ZZ', BEFORE)).toBeNull();
  });
});

describe('summary', () => {
  it('accounts for every jurisdiction exactly once', () => {
    for (const now of [BEFORE, AFTER]) {
      const total = Object.values(freshnessSummary(now)).reduce((a, b) => a + b, 0);
      expect(total).toBe(PATHWAYS.length);
    }
  });

  it('shows the shift across the reset date rather than a constant', () => {
    const before = freshnessSummary(BEFORE);
    const after = freshnessSummary(AFTER);
    expect(before.current).toBeGreaterThan(0);
    expect(after.current).toBe(0);
    expect(after.needs_verification).toBe(before.current);
  });
});

describe('links', () => {
  /*
   * Pennsylvania's drafting manual was deleted in May 2026 and reads
   * "{Reserved}" — nine weeks before this research ran. Enumerating every link
   * is what lets a scheduled job find the next one before an organizer does.
   */
  it('enumerates every URL the guide would send someone to', () => {
    const links = allLinks();
    expect(links.length).toBeGreaterThan(150);
    for (const l of links) {
      expect(l.url).toMatch(/^https:\/\//);
      expect(l.code).toMatch(/^[A-Z]{2}$/);
    }
  });

  it('covers drafting manuals and sources both', () => {
    const fields = new Set(allLinks().map((l) => l.field));
    expect(fields).toContain('manualUrl');
    expect([...fields].some((f) => f.startsWith('sources.'))).toBe(true);
  });

  it('lists no link for a jurisdiction that publishes no manual', () => {
    const pa = allLinks().filter((l) => l.code === 'PA' && l.field === 'manualUrl');
    expect(pa).toEqual([]);
  });

  it('names the reset date in a form a person can read', () => {
    expect(RESET_AFTER).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(new Date(`${RESET_AFTER}T00:00:00Z`).getTime()).toBeGreaterThan(0);
  });
});
