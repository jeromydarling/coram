import { describe, expect, it } from 'vitest';

import { DEFAULT_BRAND, FLYER_H, FLYER_W, type FlyerContent } from '../../shared/brand';
import { renderFlyer } from './flyer';

const content: FlyerContent = {
  headline: 'Rent strike meeting',
  when: 'Thursday 12 March, 7pm',
  where: 'Pearl Street Community Hall',
  detail: 'Childcare and food provided. Bring your lease if you have it.',
  callToAction: 'coram.app/pearl',
};

const render = (over: Partial<Parameters<typeof renderFlyer>[0]> = {}) =>
  renderFlyer({ brand: DEFAULT_BRAND, content, template: 'meeting', ...over });

describe('renderFlyer', () => {
  it('emits a letter-sized SVG document', () => {
    const svg = render();
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).toContain(`viewBox="0 0 ${FLYER_W} ${FLYER_H}"`);
    expect(svg.trimEnd().endsWith('</svg>')).toBe(true);
  });

  it('puts the facts people came for on the page', () => {
    const svg = render();
    expect(svg).toContain('Rent strike meeting');
    expect(svg).toContain('Pearl Street Community Hall');
    expect(svg).toContain('WHEN');
    expect(svg).toContain('WHERE');
  });

  it('carries an alt description for screen readers', () => {
    const svg = render();
    expect(svg).toContain('role="img"');
    expect(svg).toMatch(/aria-label="[^"]*Rent strike meeting[^"]*"/);
  });

  /*
   * Everything on a flyer is typed by a person, and an apostrophe in a hall
   * name would otherwise close an attribute and produce a broken document —
   * or worse, let markup through into a file people download and open.
   */
  it('escapes text rather than letting it into the markup', () => {
    const svg = renderFlyer({
      brand: { ...DEFAULT_BRAND, name: 'Tenants & Neighbours' },
      content: {
        ...content,
        headline: '<script>alert(1)</script>',
        where: "St Mary's Hall \"annexe\"",
      },
      template: 'notice',
    });

    expect(svg).not.toContain('<script>');
    expect(svg).toContain('&lt;script&gt;');
    expect(svg).toContain('Tenants &amp; Neighbours');
    expect(svg).toContain('&apos;');
    // The double quotes in the hall name must arrive as entities. A raw one
    // inside aria-label would close the attribute and split the tag.
    expect(svg).toContain('&quot;annexe&quot;');
    const label = /aria-label="([^"]*)"/.exec(svg)![1];
    expect(label).not.toContain('<');
    expect(label).not.toContain('>');
  });

  it('refuses a palette that would print unreadably', () => {
    expect(() =>
      render({ brand: { ...DEFAULT_BRAND, ink: '#8a8a8a', surface: '#9a9a9a' } }),
    ).toThrow(/not be readable/);
  });

  /*
   * A long headline should look deliberate rather than clipped. The type steps
   * down until the block fits its band, which is what a designer would do.
   */
  it('shrinks a long headline instead of overflowing the band', () => {
    const short = render({ content: { ...content, headline: 'Strike' } });
    const long = render({
      content: {
        ...content,
        headline:
          'Emergency meeting about the proposed rent increase and the landlord response to our petition',
      },
    });

    const sizeOf = (svg: string) => Number(/font-size="(\d+)" font-weight="600"/.exec(svg)![1]);
    expect(sizeOf(long)).toBeLessThan(sizeOf(short));
  });

  it('never lets the headline block exceed its band', () => {
    const svg = render({
      content: { ...content, headline: 'A '.repeat(80) },
      template: 'rally',
    });
    // Every headline baseline must sit inside the band the renderer drew.
    const band = Number(/<rect width="816" height="(\d+)"/.exec(svg.split('fill=')[1] ? svg : svg)![1]);
    const baselines = [...svg.matchAll(/<text x="64" y="([\d.]+)"[^>]*font-weight="600"/g)].map(
      (m) => Number(m[1]),
    );
    expect(baselines.length).toBeGreaterThan(0);
    expect(Math.max(...baselines)).toBeLessThanOrEqual(band);
  });

  it('gives each template a distinct headline scale', () => {
    const sizeOf = (t: 'notice' | 'rally' | 'meeting') =>
      Number(/font-size="(\d+)" font-weight="600"/.exec(render({ template: t }))![1]);
    expect(sizeOf('rally')).toBeGreaterThan(sizeOf('meeting'));
    expect(sizeOf('meeting')).toBeGreaterThan(sizeOf('notice'));
  });

  /*
   * A short headline in a fixed band leaves a third of the page as dead
   * colour. The band sizes to its content, so this must actually differ.
   */
  it('sizes the colour band to the rendered headline block', () => {
    const bandOf = (svg: string) =>
      Number(/<rect width="816" height="([\d.]+)" fill="#1f5f4f"/.exec(svg)![1]);

    const short = bandOf(render({ content: { ...content, headline: 'Strike' } }));
    const long = bandOf(
      render({
        content: {
          ...content,
          headline: 'Emergency meeting about the proposed rent increase and the response',
        },
      }),
    );

    // Tracks the block, not the string: a longer headline shrinks the type, so
    // the difference is real but modest. What matters is that a one-word
    // headline no longer sits in a slab of dead colour.
    expect(long).toBeGreaterThan(short);
    expect(short).toBeLessThan(280);
    expect(long).toBeLessThanOrEqual(460);
  });

  it('omits the call to action cleanly when there is not one', () => {
    const svg = render({ content: { ...content, callToAction: undefined, detail: undefined } });
    expect(svg).not.toContain('text-anchor="end"');
    expect(svg).toContain('Rent strike meeting');
  });

  it('chooses headline ink that is readable on the primary colour', () => {
    // A light primary must get dark headline ink, and vice versa.
    const light = render({ brand: { ...DEFAULT_BRAND, primary: '#ffe9a8' } });
    expect(light).toMatch(/fill="#111111"[^>]*>|font-weight="600" fill="#111111"/);

    const dark = render({ brand: { ...DEFAULT_BRAND, primary: '#101820' } });
    expect(dark).toContain('fill="#ffffff"');
  });
});
