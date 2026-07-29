import { describe, expect, it } from 'vitest';

import {
  AA_LARGE,
  AA_NORMAL,
  BrandError,
  CHANNELS,
  DEFAULT_BRAND,
  assertLegible,
  contrastRatio,
  fitToChannel,
  fitsChannel,
  legibilityIssues,
  luminance,
  normaliseHex,
  paletteFrom,
  parseHex,
  postLength,
  readableInk,
} from './brand';

describe('contrast', () => {
  /*
   * The two anchors of WCAG 2.1. If these drift, every legibility guarantee
   * built on them is wrong, and the failure is invisible until a flyer comes
   * back from the copy shop unreadable.
   */
  it('is 21:1 for black on white', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
  });

  it('is 1:1 for a colour against itself', () => {
    expect(contrastRatio('#7f7f7f', '#7f7f7f')).toBeCloseTo(1, 10);
  });

  it('is symmetric', () => {
    expect(contrastRatio('#1f5f4f', '#fffaf2')).toBeCloseTo(
      contrastRatio('#fffaf2', '#1f5f4f'),
      10,
    );
  });

  it('puts white luminance at 1 and black at 0', () => {
    expect(luminance('#ffffff')).toBeCloseTo(1, 10);
    expect(luminance('#000000')).toBeCloseTo(0, 10);
  });

  it('accepts hex with or without the hash', () => {
    expect(normaliseHex('1F5F4F')).toBe('#1f5f4f');
    expect(normaliseHex('#1f5f4f')).toBe('#1f5f4f');
  });

  it('rejects anything that is not six hex digits', () => {
    for (const bad of ['#fff', 'rebeccapurple', '#12345g', '', '#1234567']) {
      expect(() => normaliseHex(bad)).toThrow(BrandError);
    }
  });
});

describe('readableInk', () => {
  it('picks dark ink on a light ground and light ink on a dark one', () => {
    expect(readableInk('#fffaf2')).toBe('#111111');
    expect(readableInk('#161310')).toBe('#ffffff');
  });

  it('always returns something that clears AA large', () => {
    // Mid-tones are the hard case: neither black nor white is comfortable, but
    // one of them must still be legible at display size.
    for (const bg of ['#808080', '#1f5f4f', '#d1642a', '#6d8cf0', '#7a7a3d']) {
      expect(contrastRatio(readableInk(bg), bg)).toBeGreaterThanOrEqual(AA_LARGE);
    }
  });
});

describe('legibility gate', () => {
  it('passes the shipped default brand', () => {
    expect(legibilityIssues(DEFAULT_BRAND)).toEqual([]);
    expect(() => assertLegible(DEFAULT_BRAND)).not.toThrow();
  });

  it('refuses grey-on-grey body text', () => {
    const brand = { ...DEFAULT_BRAND, ink: '#8a8a8a', surface: '#9a9a9a' };
    const issues = legibilityIssues(brand);
    expect(issues.some((i) => i.pair === 'body text on surface')).toBe(true);
    expect(() => assertLegible(brand)).toThrow(/not be readable/);
  });

  it('reports the actual ratio so the studio can show it', () => {
    const brand = { ...DEFAULT_BRAND, ink: '#777777', surface: '#ffffff' };
    const issue = legibilityIssues(brand).find((i) => i.pair === 'body text on surface');
    expect(issue).toBeDefined();
    expect(issue!.ratio).toBeGreaterThan(1);
    expect(issue!.ratio).toBeLessThan(AA_NORMAL);
    expect(issue!.required).toBe(AA_NORMAL);
  });

  /*
   * The headline is checked against ink chosen *for* the primary colour, not
   * against a fixed colour. A group should be able to pick a mid-tone brand
   * colour without being told it is invalid.
   */
  it('lets a mid-tone primary through by choosing its own headline ink', () => {
    expect(() => assertLegible({ ...DEFAULT_BRAND, primary: '#7a2f8f' })).not.toThrow();
    expect(() => assertLegible({ ...DEFAULT_BRAND, primary: '#d1642a' })).not.toThrow();
  });
});

describe('social channels', () => {
  const x = CHANNELS.find((c) => c.id === 'x')!;
  const mastodon = CHANNELS.find((c) => c.id === 'mastodon')!;

  it('charges X a flat 23 characters for any link', () => {
    const short = postLength('hello', 'https://a.co', x);
    const long = postLength('hello', `https://example.org/${'a'.repeat(200)}`, x);
    expect(short).toBe(long);
  });

  it('charges Mastodon the real link length', () => {
    const short = postLength('hello', 'https://a.co', mastodon);
    const long = postLength('hello', 'https://example.org/a-much-longer-path', mastodon);
    expect(long).toBeGreaterThan(short);
  });

  it('knows when a draft does not fit', () => {
    expect(fitsChannel('a'.repeat(400), undefined, x)).toBe(false);
    expect(fitsChannel('a'.repeat(400), undefined, mastodon)).toBe(true);
  });

  it('trims on a word boundary rather than mid-word', () => {
    const body = 'Tenants meeting Thursday at seven in the community hall on Pearl Street '.repeat(8);
    const fitted = fitToChannel(body, 'https://ex.co/a', x)!;
    expect(fitted).not.toBeNull();
    expect(fitsChannel(fitted, 'https://ex.co/a', x)).toBe(true);
    expect(fitted.endsWith('…')).toBe(true);
    // The character before the ellipsis should not be a half-word.
    expect(fitted.slice(-2, -1)).not.toBe(' ');
  });

  it('returns null rather than emitting a stub when nothing useful fits', () => {
    // A link long enough that fewer than 40 characters of body would survive.
    // Truncating to "Tenants me…" is worse than telling someone it cannot be
    // made, so the function refuses instead of emitting a stub.
    const link = `https://example.org/${'a'.repeat(470)}`;
    expect(fitToChannel('Anything at all', link, mastodon)).toBeNull();
  });

  it('leaves a draft alone when it already fits', () => {
    const body = 'Meeting Thursday, 7pm, Pearl Street hall.';
    expect(fitToChannel(body, undefined, mastodon)).toBe(body);
  });

  it('has no duplicate channel ids', () => {
    const ids = CHANNELS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('paletteFrom', () => {
  /*
   * The whole point of generating rather than proposing: the result cannot be
   * something the contrast gate then rejects. This sweeps the hue wheel and
   * every saturation/lightness corner, including the ones that break naive
   * palette generators — near-black, near-white, and fully desaturated seeds.
   */
  const seeds: string[] = [];
  for (let h = 0; h < 360; h += 15) {
    for (const [s, l] of [
      [90, 50],
      [30, 70],
      [100, 20],
      [10, 95],
      [0, 50],
      [80, 8],
    ] as const) {
      // Cheap HSL -> hex for test input only.
      const a = (s / 100) * Math.min(l / 100, 1 - l / 100);
      const f = (n: number) => {
        const k = (n + h / 30) % 12;
        const v = l / 100 - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
        return Math.round(255 * v)
          .toString(16)
          .padStart(2, '0');
      };
      seeds.push(`#${f(0)}${f(8)}${f(4)}`);
    }
  }

  it.each(seeds.map((s) => [s]))('produces a legible palette from %s', (seed) => {
    expect(legibilityIssues(paletteFrom(seed))).toEqual([]);
  });

  it('is deterministic', () => {
    expect(paletteFrom('#1f5f4f')).toEqual(paletteFrom('#1f5f4f'));
  });

  it('keeps the seed hue recognisable in the primary', () => {
    // A green seed must not come back with a red primary. Hue is what a group
    // recognises as "our colour"; lightness and saturation are ours to move.
    const hueOf = (hex: string) => {
      const { r, g, b } = parseHex(hex);
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      if (max === min) return 0;
      const d = max - min;
      const h =
        max === r ? ((g - b) / d + (g < b ? 6 : 0)) / 6 : max === g ? ((b - r) / d + 2) / 6 : ((r - g) / d + 4) / 6;
      return h * 360;
    };
    for (const seed of ['#1f5f4f', '#7a2f8f', '#c0392b', '#1e3a8f']) {
      const delta = Math.abs(hueOf(paletteFrom(seed).primary) - hueOf(seed));
      expect(Math.min(delta, 360 - delta)).toBeLessThan(12);
    }
  });

  it('gives the accent a visibly different hue from the primary', () => {
    const p = paletteFrom('#1f5f4f');
    expect(p.accent).not.toBe(p.primary);
    expect(contrastRatio(p.accent, p.surface)).toBeGreaterThanOrEqual(AA_LARGE);
  });

  it('carries the name through', () => {
    expect(paletteFrom('#1f5f4f', 'Riverside Mutual Aid').name).toBe('Riverside Mutual Aid');
  });
});
