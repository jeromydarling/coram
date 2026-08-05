import { describe, expect, it } from 'vitest';

import { ABSENT, CONTROLS, DISCLOSURE } from './security';

const everything = [
  ...CONTROLS.flatMap((c) => [c.title, c.claim, c.check]),
  ...ABSENT.flatMap((g) => [g.title, g.claim, g.instead]),
  ...DISCLOSURE.commitments,
].join('\n');

/**
 * The one exemption, named by id rather than by softening the sentence.
 *
 * The closed-source admission has to use the word "repository" — that is the
 * thing a reader cannot have, and any synonym is a dodge. The denylist below
 * would eat it, and the wrong fix would be to reword the most important
 * sentence on the page until a regex stopped objecting. So the line is
 * exempted here, in the open, and asserted separately further down.
 */
const EXEMPT = new Set([ABSENT.find((g) => g.id === 'not-open-source')?.instead]);

const scanned = everything
  .split('\n')
  .filter((line) => !EXEMPT.has(line))
  .join('\n');

/**
 * Words that belong in a design document and not on a public page.
 *
 * Two separate problems, one list, because the fix for both is the same edit.
 *
 * The readability problem: the page is for a tenant organizer deciding whether
 * to move their group's records here. Every term below is one they would skip,
 * and a skipped sentence is a sentence that failed regardless of how true it is.
 *
 * The disclosure problem, which is the one with teeth: Coram's customers are
 * people a state has an active interest in. Naming the exact mechanism each
 * boundary rests on — and worse, naming which path holds the privileged
 * credential — publishes a starting map, written by us and kept current by us.
 * The first version of this file did all of that, in the `verify` field, in
 * good faith. The commitments stay public and specific. The wiring is for an
 * auditor under NDA.
 *
 * This test exists because the person editing security.ts next will be someone
 * who knows exactly how it works, and they will not notice themselves
 * explaining it. It has to be a machine that objects.
 */
const NOT_ON_A_PUBLIC_PAGE: Array<[RegExp, string]> = [
  // The isolation boundary, and what it rests on not having.
  [/\brow[- ]level security\b|\bRLS\b|\bBYPASSRLS\b/i, 'names the isolation mechanism'],
  [/\bpostgres\b|\bsql\b|\bschema\b|\btable owner\b/i, 'names the datastore'],
  [/\bgrant(ed|s)? [a-z ]*\b(privilege|role)\b|\bleast[- ]privilege\b/i, 'names privilege plumbing'],

  // Which path is the valuable one to compromise. This was the worst of them:
  // the old copy said in plain English that the privileged connection is bound
  // to the scheduled jobs.
  [/\bcron\b|\bqueue consumer|\bnightly (job|sweep)\b|\bscheduled job/i, 'points at the privileged path'],
  [/\bservice[- ]role\b|\bprivileged (connection|credential|role)\b/i, 'points at the privileged path'],

  // Cryptographic parameters. A reader cannot check an iteration count, and an
  // attacker sizing a guessing budget very much can use one.
  [/\bPBKDF2\b|\bHMAC\b|\bSHA-?\d|\bAES\b|\bbcrypt\b|\bscrypt\b|\bargon2\b/i, 'names a primitive'],
  [/\b\d{2,3},?\d{3} iterations\b|\biteration count\b|\bper-user salt\b|\bsalt\b/i, 'names KDF parameters'],
  [/\bwrapped key\b|\bdata key\b|\bderives? a key\b|\bkey hierarchy\b/i, 'describes the key hierarchy'],

  // How the redaction pass works is how you would design a way past it.
  [/\btwo passes?\b|\bexact match\b|\bregex\b|\bpattern match/i, 'describes the redaction algorithm'],
  [/\bsystem prompt\b|\btoken\b|\binference endpoint\b/i, 'describes the model plumbing'],

  // Infrastructure and vendors. Which cloud we are on is a procurement answer,
  // not a landing-page one, and every name here narrows a search.
  [/\bcloudflare\b|\bworkers?\b|\bneon\b|\bhyperdrive\b|\bR2\b|\bKV\b|\bdurable object/i, 'names a vendor or binding'],
  [/\bcoram_(app|cron|refdata)\b|\bconnection string\b|\bmigration\b/i, 'names internals'],

  // Ordinary engineering vocabulary that reads as noise to the actual audience.
  [/\bAPI\b|\bendpoint\b|\bmiddleware\b|\bcontinuous integration\b|\bCI\b|\brepository\b/i, 'jargon'],
  [/\bciphertext\b|\bplaintext\b|\bhash(ed|ing)?\b|\bverifier\b|\bentropy\b/i, 'jargon'],
];

describe('the security page copy', () => {
  it.each(NOT_ON_A_PUBLIC_PAGE)('does not use %s — %s', (pattern, why) => {
    const offenders = scanned
      .split('\n')
      .filter((line) => pattern.test(line))
      .map((line) => `  ${why}: "${line.slice(0, 110)}…"`);

    expect(offenders.join('\n'), `\n${offenders.join('\n')}\n`).toBe('');
  });

  /* The other half of the exemption at the top of this file. */
  it('still admits, in those words, that the code cannot be read', () => {
    const gap = ABSENT.find((g) => g.id === 'not-open-source');
    expect(gap?.claim).toMatch(/closed source/i);
    expect(gap?.instead).toMatch(/repository/i);
  });
});

describe('every control', () => {
  /*
   * The rename from `verify` to `check` is the whole point of this file's
   * rewrite. The old field held our own assertion about our own internals
   * wearing the costume of proof — an iteration count is not something a reader
   * can confirm. A check is something they can do, or a dated artifact that
   * will say. Both shapes are allowed; neither is "trust us".
   */
  it('offers something the reader can actually do, or an artifact that will say', () => {
    for (const ctl of CONTROLS) {
      const doable =
        /\b(ask|change|draft|export|try|read|watch|write)\b/i.test(ctl.check) ||
        /\breview\b/i.test(ctl.check);
      expect(doable, `${ctl.id}: "${ctl.check}"`).toBe(true);
      expect(ctl.check, ctl.id).not.toMatch(/\btrust us\b/i);
    }
  });

  /*
   * A rough legibility floor. Not a style rule — the failure mode being caught
   * is a true, careful, sixty-word sentence that nobody finishes, which is what
   * every one of these was before.
   */
  it('says it in sentences a person finishes', () => {
    for (const ctl of CONTROLS) {
      for (const sentence of `${ctl.claim} ${ctl.check}`.split(/(?<=[.?!])\s+/)) {
        const words = sentence.trim().split(/\s+/).length;
        expect(words, `${ctl.id}: "${sentence}"`).toBeLessThanOrEqual(45);
      }
      expect(ctl.claim.split(/(?<=[.?!])\s+/).length, ctl.id).toBeLessThanOrEqual(3);
    }
  });

  it('has a title that says what the reader gets', () => {
    for (const ctl of CONTROLS) {
      expect(ctl.title.length, ctl.id).toBeLessThanOrEqual(60);
      // No colon-and-a-noun-phrase headings — "Isolation: row-level security".
      expect(ctl.title, ctl.id).not.toContain(':');
    }
  });
});

describe('the gaps', () => {
  /*
   * Ordering, asserted rather than trusted to a code review. The absence of a
   * penetration test is the largest thing missing, and a page that opens its
   * honest section with the cheapest admission has arranged the honesty.
   */
  it('leads with the biggest one', () => {
    expect(ABSENT[0]?.id).toBe('pentest');
  });

  it('claims no certification it does not hold', () => {
    const text = `${everything}`;
    expect(text).not.toMatch(/\b(SOC ?2 (certified|compliant)|ISO ?27001|pen[- ]?tested)\b/i);
  });

  /*
   * The four that a reader would otherwise find on their own, which is the
   * expensive way to find them.
   */
  it('keeps all four admissions', () => {
    expect(ABSENT.map((g) => g.id).sort()).toEqual([
      'metadata',
      'not-open-source',
      'pentest',
      'soc2',
    ]);
  });
});
