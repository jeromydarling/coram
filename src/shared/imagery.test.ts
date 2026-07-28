import { describe, expect, it } from 'vitest';

import {
  BANNED,
  DirectionError,
  FACE_CLAUSES,
  IMAGES,
  MAX_ACCENT_SHARE,
  assertOnDirection,
  objectKey,
  prompt,
  type ImageSpec,
} from './imagery';

describe('§8.2 direction', () => {
  it.each(IMAGES.map((i) => [i.id, i] as const))('%s is on direction', (_id, spec) => {
    expect(() => assertOnDirection(spec)).not.toThrow();
  });

  it('every prompt carries the style preamble', () => {
    for (const spec of IMAGES) {
      expect(prompt(spec)).toContain('35mm film photograph');
      expect(prompt(spec)).toContain('muted desaturated color palette');
    }
  });

  /*
   * §8.2: "Every image obscures faces ... This is a rule, not a preference."
   * So it is a test, not a review comment.
   */
  it('no image shows a face', () => {
    for (const spec of IMAGES) {
      expect(FACE_CLAUSES.some((c) => prompt(spec).includes(c))).toBe(true);
    }
  });

  it('uses the amber accent sparingly', () => {
    const share = IMAGES.filter((i) => i.accent).length / IMAGES.length;
    expect(share).toBeLessThanOrEqual(MAX_ACCENT_SHARE);
  });

  it('gives every image real alt text, not a restated headline', () => {
    for (const spec of IMAGES) {
      expect(spec.alt.length).toBeGreaterThan(20);
      expect(spec.alt).not.toMatch(/coram|movement|organiz(e|ing) with/i);
    }
  });

  it('has no duplicate ids', () => {
    expect(new Set(IMAGES.map((i) => i.id)).size).toBe(IMAGES.length);
  });
});

describe('assertOnDirection', () => {
  const base: ImageSpec = {
    id: 'hero-hall',
    subject: 'a room',
    faceClause: 'seen entirely from behind, no faces visible',
    accent: false,
    width: 100,
    height: 100,
    widths: [100],
    alt: 'A room with chairs in it, photographed from the doorway.',
  };

  it('rejects a banned subject', () => {
    expect(() => assertOnDirection({ ...base, subject: 'a crowd with raised fists' })).toThrow(
      DirectionError,
    );
    expect(() => assertOnDirection({ ...base, subject: 'someone with a megaphone' })).toThrow(
      DirectionError,
    );
  });

  it('rejects a prompt that does not say how faces are obscured', () => {
    expect(() =>
      assertOnDirection({ ...base, faceClause: 'looking right at us' as never }),
    ).toThrow(/obscure faces/);
  });

  it('rejects useless alt text', () => {
    expect(() => assertOnDirection({ ...base, alt: 'photo' })).toThrow(/alt text/);
  });

  /*
   * "flagship" must not trip the ban on "flags". A ban list that fires on
   * substrings gets disabled the first time it blocks something innocent, and
   * a disabled rule protects nothing.
   */
  it('matches whole words, so ordinary language survives', () => {
    expect(() =>
      assertOnDirection({ ...base, subject: 'a flagship store window and a signpost' }),
    ).not.toThrow();
  });

  it('bans the words it says it bans', () => {
    for (const pattern of BANNED) {
      expect(pattern.flags).toContain('i');
      expect(pattern.source).toContain('\\b');
    }
  });
});

describe('objectKey', () => {
  it('maps jpeg to .jpg and leaves the modern formats alone', () => {
    expect(objectKey('hero-hall', 1440, 'jpeg')).toBe('hero-hall-1440.jpg');
    expect(objectKey('hero-hall', 1440, 'avif')).toBe('hero-hall-1440.avif');
    expect(objectKey('hero-hall', 1440, 'webp')).toBe('hero-hall-1440.webp');
  });
});
