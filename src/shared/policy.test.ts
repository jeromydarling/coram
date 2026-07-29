import { describe, expect, it } from 'vitest';

import {
  ABUSE_CONTACT,
  ENFORCEMENT,
  IDEOLOGY_WORDS,
  LIMITS,
  PROHIBITED,
  PROTECTED,
} from './policy';

/*
 * These are not style checks. Each one pins a property that makes the
 * difference between a policy that protects organisers and one that can be
 * used against them.
 */
describe('acceptable use', () => {
  it('describes conduct, never belief', () => {
    for (const rule of [...PROHIBITED, ...PROTECTED]) {
      for (const word of IDEOLOGY_WORDS) {
        // PROTECTED may *mention* the label in order to disclaim it; the
        // prohibitions may not use it at all.
        if (PROHIBITED.includes(rule)) {
          expect(`${rule.title} ${rule.rule}`.toLowerCase()).not.toContain(word);
        }
      }
    }
  });

  it('names protected activity, not just prohibited conduct', () => {
    // A prohibition list on its own is a deplatforming tool. The protections
    // are what make it answerable.
    expect(PROTECTED.length).toBeGreaterThanOrEqual(PROHIBITED.length - 2);
  });

  /*
   * The four that get reported most often, and the four this product would be
   * dishonest to remove: it takes zero fee from bail and mutual aid precisely
   * because they matter most.
   */
  it.each(['civil-disobedience', 'bail-and-jail-support', 'mutual-aid', 'strikes'])(
    'explicitly protects %s',
    (id) => {
      expect(PROTECTED.map((r) => r.id)).toContain(id);
    },
  );

  it('refuses government designations as grounds for action', () => {
    const rule = PROTECTED.find((r) => r.id === 'designations');
    expect(rule).toBeDefined();
    expect(rule!.rule.toLowerCase()).toContain('not');
  });

  it('keeps the violence rule about people rather than property', () => {
    const rule = PROHIBITED.find((r) => r.id === 'violence');
    expect(rule!.rule).toMatch(/people/);
    // "Damage to property" as violence is the reading that swallows blockades,
    // lock-ons and occupations — every one of which is protected above.
    expect(rule!.rule.toLowerCase()).not.toContain('property');
    expect(rule!.why.toLowerCase()).toContain('property');
  });

  it('gives every rule a stated reason', () => {
    for (const rule of [...PROHIBITED, ...PROTECTED]) {
      expect(rule.why.length).toBeGreaterThan(40);
      expect(rule.rule.length).toBeGreaterThan(30);
    }
  });

  it('has unique ids', () => {
    const ids = [...PROHIBITED, ...PROTECTED].map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('limits', () => {
  /*
   * §3.2 and §3.3 mean we hold ciphertext for most content. A policy implying
   * we monitor it would be a claim the architecture contradicts — and would
   * invite exactly the demands ("you can see it, so you must act") that the
   * encryption exists to make impossible to satisfy.
   */
  it('states that we cannot read sealed content', () => {
    const text = LIMITS.join(' ').toLowerCase();
    expect(text).toContain('do not read');
    expect(text).toContain('encrypt');
  });

  it('does not claim proactive detection', () => {
    const text = LIMITS.join(' ').toLowerCase();
    expect(text).not.toMatch(/we (scan|monitor|detect|review all)/);
    expect(text).toContain('not, and cannot be, proactive');
  });
});

describe('enforcement', () => {
  it('requires specifics rather than volume', () => {
    const text = ENFORCEMENT.join(' ').toLowerCase();
    expect(text).toContain('specific conduct');
    expect(text).toContain('not evidence');
  });

  it('gives a right to respond and a right to appeal', () => {
    const text = ENFORCEMENT.join(' ').toLowerCase();
    expect(text).toContain('respond');
    expect(text).toContain('appeal');
  });

  it('never lets one person remove an organisation', () => {
    const text = ENFORCEMENT.join(' ').toLowerCase();
    expect(text).toContain('two people');
    expect(text).toContain('no single');
  });

  /*
   * Ties the policy to §7. Enforcement counts belong in the transparency
   * report for the same reason subpoena counts do: a power exercised in
   * private is indistinguishable from a power exercised arbitrarily.
   */
  it('commits to publishing enforcement counts', () => {
    const text = ENFORCEMENT.join(' ').toLowerCase();
    expect(text).toContain('/trust');
    expect(text).toMatch(/counts|published/);
  });

  it('gives one contact address', () => {
    expect(ABUSE_CONTACT).toMatch(/^[a-z]+@/);
  });
});
