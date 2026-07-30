import { describe, expect, it } from 'vitest';

import {
  BANNED,
  DirectionError,
  EFFECT_CLAUSES,
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
      expect(prompt(spec)).toContain('35mm');
      // The direction was rewritten away from "muted desaturated" after the
      // first set came back as nine dim empty rooms. Colour and daylight are
      // the point now, and these assertions exist so a future edit cannot
      // quietly drift back.
      expect(prompt(spec)).toContain('rich saturated colour');
      expect(prompt(spec)).toContain('bright natural daylight');
      /*
       * The global turned-away clause. Per-image face clauses describe the
       * named subject, and the model routinely adds people the prompt never
       * mentioned — the /why frame asked for one figure and got a cheering
       * crowd, one of whom came back as a sharp profile. This covers the
       * whole frame rather than the subject.
       */
      expect(prompt(spec)).toContain('every person in the frame is turned away');
      expect(prompt(spec)).not.toContain('muted desaturated');
    }
  });

  it('puts people in almost every frame', () => {
    // The old set was mostly furniture. A page about people turning up
    // together should show people turning up together.
    const peopled = IMAGES.filter((i) => /people|hands|person|callers|someone/.test(i.subject));
    expect(peopled.length / IMAGES.length).toBeGreaterThanOrEqual(0.8);
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

/*
 * Both effect-based clauses have now failed in production the same way: shallow
 * focus left two phone-bank callers sharp, and motion blur left a dozen faces
 * sharp in the middle of a crowd. An effect only covers the subjects it happens
 * to reach. This is the rule that stops the next crowd scene relying on one.
 */
describe('effect clauses versus crowds', () => {
  it('refuses motion blur when the scene contains a crowd', () => {
    expect(() =>
      assertOnDirection({
        ...IMAGES[0],
        subject: 'a packed hall with dozens of people, hands raised',
        faceClause: 'faces blurred by motion, features not discernible',
      }),
    ).toThrow(/camera position/);
  });

  it('still allows an effect for a single subject', () => {
    expect(() =>
      assertOnDirection({
        ...IMAGES[0],
        subject: 'a lone clipboard on a chair beside one figure at a window',
        faceClause: 'faces fully out of focus and unrecognizable',
      }),
    ).not.toThrow();
  });

  it('no crowd scene in the shipped set leans on an effect', () => {
    for (const spec of IMAGES) {
      if (EFFECT_CLAUSES.has(spec.faceClause)) {
        expect(spec.subject).not.toMatch(/\b(crowd|crowded|packed|dozens|people)\b/i);
      }
    }
  });
});

describe('a room needs something to look at', () => {
  /*
   * The third distinct way the face rule has bitten, after the chair circle and
   * the blur clauses. A speaker addressing a room faces the camera, so the rule
   * silently forbids the one element that gives the shot a subject — and the
   * model obliges with sixty people staring at a table of coffee urns. No
   * reroll fixes it: the prompt asked for an audience and no performance.
   */
  it('refuses an audience with nothing at the far end', () => {
    expect(() =>
      assertOnDirection({
        id: 'folding-chairs',
        subject: 'rows of chairs in a hall, everyone facing the front, backs of heads',
        faceClause: 'seen entirely from behind, no faces visible',
        accent: true,
        width: 1600,
        height: 1000,
        widths: [1024],
        alt: 'test',
      }),
    ).toThrow(/staring at empty space/i);
  });

  it('accepts an audience that has a speaker or a board to face', () => {
    expect(() =>
      assertOnDirection({
        id: 'folding-chairs',
        subject:
          'rows of seated people from behind, one person at the front writing on a paper easel ' +
          'with their back to the room',
        faceClause: 'seen entirely from behind, no faces visible',
        accent: true,
        width: 1600,
        height: 1000,
        widths: [1024],
        alt: 'Rows of seated people watching someone write on an easel at the front.',
      }),
    ).not.toThrow();
  });

  /*
   * The correction that matters. The first version of this rule failed the
   * hero — a hall mid-vote, a forest of raised hands — which is one of the best
   * frames we have. The fault is never "an audience facing forward"; it is an
   * audience doing nothing, facing nothing. A room in the act of voting is its
   * own subject.
   */
  it('accepts a room that is itself doing something', () => {
    expect(() =>
      assertOnDirection({
        id: 'hero-hall',
        subject: 'a packed hall mid-vote, a forest of raised hands, rows of the backs of heads',
        faceClause: 'seen entirely from behind, no faces visible',
        accent: true,
        width: 1600,
        height: 1000,
        widths: [1024],
        alt: 'A packed hall mid-vote with a forest of raised hands.',
      }),
    ).not.toThrow();
  });

  it('keeps the hero on direction, since it is the case that caught the bug', () => {
    const hero = IMAGES.find((i) => i.id === 'hero-hall')!;
    expect(() => assertOnDirection(hero)).not.toThrow();
  });
});

describe('alt text describes the photograph that exists', () => {
  /*
   * folding-chairs kept "A circle of folding chairs" in its alt text after the
   * circle became rows — the geometry was fixed and the description was not.
   * Alt text is the only version of an image a screen reader user ever gets, so
   * a stale one is not a cosmetic problem.
   */
  it('does not describe a circle where the subject says rows', () => {
    for (const spec of IMAGES) {
      if (/\brows of\b/i.test(spec.subject)) {
        expect(spec.alt).not.toMatch(/\bcircle\b/i);
      }
    }
  });

  it('gives every image alt text that is a sentence, not a label', () => {
    for (const spec of IMAGES) {
      expect(spec.alt.length).toBeGreaterThan(25);
      expect(spec.alt.endsWith('.')).toBe(true);
    }
  });
});
