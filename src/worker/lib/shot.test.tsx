/** @jsxImportSource hono/jsx */

/**
 * The screenshot markup, and the one thing it must not do.
 *
 * A shot listed as published but never uploaded serves a 404 on the front page,
 * and a shot uploaded but not listed is invisible. Neither is caught by
 * anything else — the media route would answer, the page would render, and only
 * a person looking at the site would notice a grey rectangle.
 */

import { describe, expect, it } from 'vitest';

import { SHOTS } from '../../shared/shots';
import { PUBLISHED, Shot, ShotFigure } from './shot';

const render = (node: unknown) => String(node);

describe('<Shot>', () => {
  it('offers AVIF and WebP before the PNG floor', () => {
    const html = render(<Shot id="shot-overview" sizes="100vw" />);
    expect(html).toContain('type="image/avif"');
    expect(html).toContain('type="image/webp"');
    // PNG rather than JPEG: these are flat colour, hairlines and small type,
    // and JPEG rings along every letter of it.
    expect(html).toContain('.png');
    expect(html).not.toContain('.jpg');
  });

  it('carries the alt text from the spec, not a marketing line', () => {
    const spec = SHOTS.find((s) => s.id === 'shot-money')!;
    expect(render(<Shot id="shot-money" sizes="100vw" />)).toContain(spec.alt);
  });

  /*
   * A picture that arrives without reserved space shoves the paragraph below it
   * down the screen as it loads, which on a slow connection is the jump that
   * makes a site feel cheap.
   */
  it('reserves its space so the page does not reflow', () => {
    const html = render(<Shot id="shot-overview" sizes="100vw" />);
    expect(html).toContain('width="1280"');
    expect(html).toContain('height="860"');
    expect(html).toContain('aspect-ratio:1280/860');
  });

  it('lazy-loads, because none of these is the LCP element', () => {
    expect(render(<Shot id="shot-advocacy" sizes="100vw" />)).toContain('loading="lazy"');
  });

  /*
   * Chromeless is the whole point. A drawn browser frame, a fake URL bar or a
   * floating laptop would be decoration that dates immediately.
   */
  it('draws no browser chrome around the picture', () => {
    const html = render(<Shot id="shot-studio" sizes="100vw" />);
    expect(html).not.toMatch(/url-bar|browser-frame|traffic-light|address-bar/i);
  });

  /*
   * Both branches, and which one a shot takes is decided by PUBLISHED rather
   * than by this test.
   *
   * The earlier version asserted every spec was published, which was true when
   * it was written and is wrong as a rule: a spec has to exist before CI will
   * photograph it, and the upload happens after that. Asserting the invariant
   * that cannot hold turned the interim into a broken build instead of a
   * labelled placeholder.
   */
  it('renders an image for a published shot and a placeholder for one that is not', () => {
    for (const shot of SHOTS) {
      const html = render(<Shot id={shot.id} sizes="100vw" />);

      if (PUBLISHED.has(shot.id)) {
        expect(html, shot.id).toContain('<img');
        expect(html, shot.id).not.toContain('Screenshot pending');
      } else {
        expect(html, shot.id).toContain('Screenshot pending');
        // Still reserves its space, and still carries the alt text — a pending
        // shot must not reflow the page or go silent to a screen reader.
        expect(html, shot.id).toContain(`aspect-ratio:${shot.viewport.width}/${shot.viewport.height}`);
        expect(html, shot.id).toContain('role="img"');
      }
    }
  });

  it('throws on an unknown id rather than rendering an empty picture', () => {
    expect(() => render(<Shot id={'shot-nope' as never} sizes="100vw" />)).toThrow(/No shot spec/);
  });
});

describe('<ShotFigure>', () => {
  it('prints the caption under the picture', () => {
    const spec = SHOTS.find((s) => s.id === 'shot-safety')!;
    const html = render(<ShotFigure id="shot-safety" sizes="100vw" />);
    expect(html).toContain('<figcaption');
    expect(html).toContain(spec.caption);
  });
});
