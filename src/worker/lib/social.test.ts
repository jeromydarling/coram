/**
 * The rules a generated image must not be able to break.
 *
 * Most of this file is about the two ways a studio quietly produces something
 * harmful: a card whose type is unreadable because a photograph went behind it,
 * and a backdrop prompt that was talked into drawing a person. Both are one
 * careless edit away and neither is visible in a screenshot of the happy path.
 */

import { describe, expect, it } from 'vitest';

import {
  BACKDROP_NEGATIVE,
  BACKDROP_STYLES,
  DEFAULT_BRAND,
  SOCIAL_SIZES,
  backdropPrompt,
} from '../../shared/brand';
import { renderSocial } from './social';

const size = SOCIAL_SIZES[0];
const base = { brand: DEFAULT_BRAND, size, headline: 'The rent board meets Tuesday' };

describe('renderSocial', () => {
  it('draws a card at the size it was asked for', () => {
    const svg = renderSocial(base);
    expect(svg).toContain(`width="${size.width}"`);
    expect(svg).toContain(`height="${size.height}"`);
    expect(svg).toContain('The rent board meets Tuesday');
  });

  /*
   * An image of words that carries no words is unreadable to anyone using a
   * screen reader — which, on a post meant to reach a whole neighbourhood, is
   * a meaningful share of the audience.
   */
  it('carries the words in the label, not only in the picture', () => {
    const svg = renderSocial({ ...base, when: 'Tue 6.30pm', where: 'City Hall' });
    const label = /aria-label="([^"]*)"/.exec(svg)?.[1] ?? '';
    expect(label).toContain('The rent board meets Tuesday');
    expect(label).toContain('City Hall');
  });

  it('escapes text rather than letting it close a tag', () => {
    const svg = renderSocial({ ...base, headline: 'Rent & repairs <now>' });
    expect(svg).toContain('&amp;');
    expect(svg).not.toContain('<now>');
  });

  /*
   * The contrast gate in brand.ts checks ink against surface. Put a photograph
   * behind the surface and the ratio it verified is no longer the ratio on the
   * page, so a floor on the scrim is what keeps the check meaningful. Asking
   * for none must not give you none.
   */
  it('keeps a floor of surface over a backdrop, however low you ask', () => {
    const svg = renderSocial({ ...base, backdrop: 'data:image/png;base64,AAAA', backdropScrim: 0 });
    const opacity = Number(/opacity="([\d.]+)"/.exec(svg)?.[1]);
    expect(opacity).toBeGreaterThanOrEqual(0.45);
  });

  it('uses no scrim at all when there is no backdrop', () => {
    expect(renderSocial(base)).not.toContain('<image');
  });

  it('crops a backdrop to fill rather than letterboxing it', () => {
    const svg = renderSocial({ ...base, backdrop: 'data:image/png;base64,AAAA' });
    expect(svg).toContain('preserveAspectRatio="xMidYMid slice"');
  });

  /* A headline nobody bounded is the normal case, not the exceptional one. */
  it('shrinks a long headline instead of overflowing or throwing', () => {
    const svg = renderSocial({
      ...base,
      headline:
        'The rent board is meeting on Tuesday evening to decide whether landlords in this ' +
        'district must fix habitability defects within thirty days of written notice',
    });
    const sizes = [...svg.matchAll(/font-size="(\d+)"/g)].map((m) => Number(m[1]));
    expect(Math.max(...sizes)).toBeLessThan(size.width * 0.105);
  });

  /*
   * The bug a screenshot found and no assertion had.
   *
   * "Tuesday 5 August, 6.30pm · City Hall, chamber B" is an ordinary line for a
   * meeting, and drawn as one <text> it ran off the right edge — clipped in the
   * preview and, worse, clipped in the file somebody downloads and posts. SVG
   * does not wrap, so the renderer has to.
   */
  it('wraps a long detail line instead of running it off the card', () => {
    const svg = renderSocial({
      ...base,
      when: 'Tuesday 5 August, 6.30pm',
      where: 'City Hall, chamber B',
    });

    // Every drawn string must fit the inner width at the size it is drawn at,
    // using the same 0.54em estimate the layout does.
    const margin = Math.round(size.width * 0.075);
    const inner = size.width - margin * 2;

    for (const [, fontSize, text] of svg.matchAll(
      /font-size="(\d+)"[^>]*>([^<]+)</g,
    ) as unknown as Iterable<[string, string, string]>) {
      const estimated = text.length * Number(fontSize) * 0.54;
      expect(estimated, `"${text}" at ${fontSize}px`).toBeLessThanOrEqual(inner * 1.02);
    }
  });

  it('hard-wraps a single word too long for the card rather than overflowing', () => {
    const svg = renderSocial({ ...base, headline: 'A'.repeat(400) });
    const longest = Math.max(
      ...[...svg.matchAll(/>([^<]+)</g)].map((m) => m[1].length),
    );
    // 400 unbroken characters cannot fit on one line at any legible size.
    expect(longest).toBeLessThan(400);
  });

  /*
   * The second half of the wrap bug.
   *
   * Fixing the overflow made the detail wrap to two lines, and the second line
   * landed on top of the call to action — because the two were positioned
   * independently, one from the headline downward and one from the bottom up.
   * Two things laid out from opposite ends of the same region will eventually
   * meet in the middle.
   */
  it('never lets the detail collide with the call to action', () => {
    const svg = renderSocial({
      ...base,
      when: 'Tuesday 5 August, 6.30pm',
      where: 'City Hall, chamber B',
      callToAction: 'eastsidetenants.org',
    });

    const drawn = [...svg.matchAll(/<text[^>]*y="(\d+)"[^>]*font-size="(\d+)"[^>]*>([^<]+)</g)].map(
      (m) => ({ y: Number(m[1]), size: Number(m[2]), text: m[3] }),
    );

    const cta = drawn.find((d) => d.text.includes('eastsidetenants.org'))!;
    const detailLines = drawn.filter((d) => /City Hall|chamber|August/.test(d.text));

    expect(cta, 'the call to action is drawn').toBeDefined();
    expect(detailLines.length, 'the detail wrapped').toBeGreaterThan(1);

    // Every detail baseline must clear the call to action's ascender.
    for (const line of detailLines) {
      expect(line.y, `"${line.text}" sits above the call to action`).toBeLessThan(cta.y - cta.size);
    }
  });

  it('keeps everything inside the card, top and bottom', () => {
    const svg = renderSocial({
      ...base,
      when: 'Tuesday 5 August, 6.30pm',
      where: 'City Hall, chamber B',
      callToAction: 'eastsidetenants.org',
    });

    for (const m of svg.matchAll(/<text[^>]*y="(\d+)"/g)) {
      expect(Number(m[1])).toBeGreaterThan(0);
      expect(Number(m[1])).toBeLessThanOrEqual(size.height);
    }
  });

  it('renders every shape without throwing', () => {
    for (const s of SOCIAL_SIZES) {
      expect(() => renderSocial({ ...base, size: s })).not.toThrow();
    }
  });

  /* Self-contained or it stops working the moment it is emailed. */
  it('references nothing off the machine it is opened on', () => {
    const svg = renderSocial({ ...base, backdrop: 'data:image/png;base64,AAAA' });
    expect(svg).not.toMatch(/href="https?:/);
    expect(svg).not.toContain('<script');
  });
});

describe('backdrop prompts', () => {
  /*
   * The rule this file exists for.
   *
   * A flyer for a real union carrying an invented photorealistic "member" is a
   * claim somebody has to defend on a doorstep, and it is the first thing an
   * opponent points at once they notice. Every style says so, and the negative
   * prompt says so again.
   */
  it('every style forbids people in the prompt itself', () => {
    for (const style of BACKDROP_STYLES) {
      expect(backdropPrompt(style), style.id).toMatch(/no people/i);
    }
  });

  it('the negative prompt leads with faces and covers the §8.2 clichés', () => {
    for (const banned of ['face', 'crowd', 'silhouette', 'raised fists', 'tear gas', 'megaphones']) {
      expect(BACKDROP_NEGATIVE).toContain(banned);
    }
  });

  /*
   * The group's own words are appended, never substituted. Someone typing
   * "a smiling family on the steps" gets their words *and* the no-people
   * clause, and the negative prompt besides — the rule cannot be prompted away
   * by the text box.
   */
  it('appends the operator’s words without dropping the rule', () => {
    const prompt = backdropPrompt(BACKDROP_STYLES[0], 'a smiling family on the steps');
    expect(prompt).toContain('a smiling family on the steps');
    expect(prompt).toMatch(/no people/i);
    expect(prompt.indexOf('no people, no text')).toBeGreaterThan(
      prompt.indexOf('a smiling family'),
    );
  });

  it('bounds what the operator can add, so the style cannot be buried', () => {
    const prompt = backdropPrompt(BACKDROP_STYLES[0], 'x'.repeat(5_000));
    expect(prompt.length).toBeLessThan(1_000);
    expect(prompt).toMatch(/no people/i);
  });

  it('no style asks for text, which models render as convincing gibberish', () => {
    for (const style of BACKDROP_STYLES) {
      expect(style.prompt, style.id).toMatch(/no text|no readable letters/i);
    }
  });
});
