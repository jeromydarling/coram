import { describe, expect, it } from 'vitest';

import { assertRedacted, redact, RedactionError, reinsert, residualRisk } from './redact';

describe('redact — known values', () => {
  it('replaces a name from the workspace roster', () => {
    const { text, map } = redact('Ada is bringing two neighbours on Thursday.', {
      names: ['Ada'],
    });

    expect(text).toBe('[PERSON_1] is bringing two neighbours on Thursday.');
    expect(map['[PERSON_1]']).toBe('Ada');
  });

  /*
   * Longest-first matters. "Ada Okonkwo" split into two placeholders would read
   * to a model as two different people, and the summary that came back would be
   * wrong in a way nobody would catch.
   */
  it('matches the longest known value first', () => {
    const { text } = redact('Ada Okonkwo chaired.', { names: ['Ada', 'Ada Okonkwo'] });
    expect(text).toBe('[PERSON_1] chaired.');
  });

  it('reuses one placeholder for repeats within a call', () => {
    const { text, map } = redact('Ada spoke. Ada then left.', { names: ['Ada'] });
    expect(text).toBe('[PERSON_1] spoke. [PERSON_1] then left.');
    expect(Object.keys(map)).toHaveLength(1);
  });

  it('is case-insensitive but keeps what it found', () => {
    const { map } = redact('ADA spoke.', { names: ['Ada'] });
    expect(map['[PERSON_1]']).toBe('ADA');
  });

  it('does not match inside a longer word', () => {
    // "Ada" must not redact the middle of "Adamant".
    const { text } = redact('Adamant about it.', { names: ['Ada'] });
    expect(text).toBe('Adamant about it.');
  });
});

describe('redact — patterns', () => {
  it('catches an email that is not in the roster', () => {
    const { text, removed } = redact('Write to stranger@example.org about it.');
    expect(text).not.toContain('stranger@example.org');
    expect(removed.EMAIL).toBe(1);
  });

  it.each([
    ['+1 (555) 013-4567', 'PHONE'],
    ['555-013-4567', 'PHONE'],
    ['+442079460000', 'PHONE'],
  ])('catches the phone shape %s', (phone, kind) => {
    const { text, removed } = redact(`Call ${phone} tonight.`);
    expect(text).not.toContain(phone);
    expect(removed[kind as 'PHONE']).toBeGreaterThan(0);
  });

  it('catches government identifiers and card numbers', () => {
    const { removed } = redact('SSN 123-45-6789 and card 4111 1111 1111 1111.');
    expect(removed.GOV_ID).toBe(1);
    expect(removed.CARD).toBe(1);
  });

  it('catches postcodes in both shapes', () => {
    expect(redact('Near 60625.').removed.POSTCODE).toBe(1);
    expect(redact('Near SW1A 1AA.').removed.POSTCODE).toBe(1);
  });

  it('does not redact its own placeholders on a second pass', () => {
    const once = redact('Ada at a@b.org', { names: ['Ada'] });
    const twice = redact(once.text);
    expect(twice.text).toBe(once.text);
  });
});

describe('reinsert', () => {
  it('round-trips', () => {
    const original = 'Ada (ada@example.org, 555-013-4567) is hosting.';
    const { text, map } = redact(original, { names: ['Ada'] });

    expect(text).not.toContain('Ada');
    expect(reinsert(text, map)).toBe(original);
  });

  it('restores every occurrence of a repeated placeholder', () => {
    const { text, map } = redact('Ada and Ada again.', { names: ['Ada'] });
    expect(reinsert(text, map)).toBe('Ada and Ada again.');
  });
});

describe('assertRedacted', () => {
  /*
   * The last line before dispatch. It exists for the case where a caller
   * redacted one field of a prompt and concatenated another in afterwards —
   * which is a mistake that looks completely fine in review.
   */
  it('throws when an email survived', () => {
    expect(() => assertRedacted('Summarise this: leaked@example.org')).toThrow(RedactionError);
  });

  it('throws when a phone survived', () => {
    expect(() => assertRedacted('Ring +1 555 013 4567')).toThrow(RedactionError);
  });

  it('does not put the offending value in the error', () => {
    // The error gets logged. A log line containing the PII we just refused to
    // send would defeat the check that produced it.
    try {
      assertRedacted('leaked@example.org');
      throw new Error('should have thrown');
    } catch (error) {
      expect(String(error)).not.toContain('leaked@example.org');
      expect(String(error)).toContain('EMAIL');
    }
  });

  it('passes redacted text', () => {
    const { text } = redact('Ada at ada@example.org', { names: ['Ada'] });
    expect(() => assertRedacted(text)).not.toThrow();
  });

  it('passes text that never had any', () => {
    expect(() => assertRedacted('Draft a note about the rent strike.')).not.toThrow();
  });
});

describe('residualRisk', () => {
  it('flags a capitalised word that redaction did not know about', () => {
    // The honest limit: no pattern finds a name we were never given.
    const risks = residualRisk('The meeting with Okonkwo went well.');
    expect(risks).toContain('Okonkwo');
  });

  it('ignores days and months', () => {
    expect(residualRisk('We met on Thursday in March.')).toEqual([]);
  });

  it('is bounded, so the warning stays readable', () => {
    const text = Array.from({ length: 50 }, (_, i) => `word Name${i}x`).join(' ');
    expect(residualRisk(text).length).toBeLessThanOrEqual(20);
  });
});

describe('placeholder numbering', () => {
  /*
   * By first appearance in the text, not by the order the caller listed the
   * roster. Stable within a call so a model can tell one person from another,
   * and an ordinal over this text alone — it encodes nothing derived from our
   * own identifiers.
   */
  it('follows first appearance in the text', () => {
    const first = redact('Ada then Ben.', { names: ['Ada', 'Ben'] });
    const second = redact('Ben then Ada.', { names: ['Ada', 'Ben'] });

    expect(first.map['[PERSON_1]']).toBe('Ada');
    expect(second.map['[PERSON_1]']).toBe('Ben');
  });

  it('keeps structured values whole rather than letting a name split them', () => {
    // "Ada" is on the roster and also the local part of the address. The email
    // match owns the span, so the address does not survive in pieces.
    const { text, map } = redact('Mail ada@example.org now.', { names: ['Ada'] });

    expect(text).toBe('Mail [EMAIL_1] now.');
    expect(map['[EMAIL_1]']).toBe('ada@example.org');
  });
});
