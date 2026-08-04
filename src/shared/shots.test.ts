/**
 * The rule worth a test file of its own: no real group is ever in a screenshot.
 *
 * Every picture on the marketing site comes from the demo workspace, which is
 * fictional down to the street names. The failure mode this guards is not
 * hypothetical — somebody capturing a shot while signed into a real workspace
 * would put actual organizers' names on a public page, to sell a product whose
 * whole argument is that we hold as little about them as possible.
 *
 * The capture script signs in as the demo account and nothing else. These
 * assertions are the second lock.
 */

import { describe, expect, it } from 'vitest';

import { DEMO_SLUG } from './demo';
import { SHOTS, shotById, shotKey } from './shots';

describe('screenshot specs', () => {
  /*
   * Two shapes are allowed and no others.
   *
   * `/app/**` is the signed-in product, and the capture script signs in as the
   * demo account and nothing else. `/g/<demo slug>` is the demo workspace's own
   * published page — which satisfies the rule this file exists for more tightly
   * than /app does, because the workspace is named in the URL rather than
   * implied by whoever happens to be signed in.
   *
   * The relaxation is written as an exact slug rather than a `/g/` prefix on
   * purpose. `/g/` in general belongs to a real group the moment one publishes.
   */
  it('only ever photograph the demo workspace', () => {
    for (const shot of SHOTS) {
      expect(shot.route, shot.id).toMatch(
        new RegExp(`^(/app(/|$)|/g/${DEMO_SLUG}(/|$|\\?))`),
      );
    }
  });

  /*
   * A public event page or a giving page belongs to a real group the moment
   * one exists. Those routes are deliberately out of bounds here, and so is
   * any /g/ that is not the demo's.
   */
  it('never point at a public tenant route', () => {
    for (const shot of SHOTS) {
      expect(shot.route, shot.id).not.toMatch(/^\/(e|f)\//);
      if (shot.route.startsWith('/g/')) {
        expect(shot.route, shot.id).toMatch(new RegExp(`^/g/${DEMO_SLUG}(/|$|\\?)`));
      }
    }
  });

  it('give every shot alt text that describes the screen', () => {
    for (const shot of SHOTS) {
      expect(shot.alt.length, shot.id).toBeGreaterThan(40);
      // Alt text is for somebody who cannot see it, not a second caption.
      expect(shot.alt, shot.id).not.toMatch(/coram (is|does|makes)/i);
    }
  });

  /*
   * §2's copy rule. The site does not shout, and a caption is the easiest
   * place for an exclamation point to sneak back in.
   */
  it('write captions in the site’s voice', () => {
    for (const shot of SHOTS) {
      expect(shot.caption, shot.id).not.toContain('!');
      expect(shot.caption, shot.id).not.toMatch(/empower|amplify|disrupt|revolutioni[sz]e/i);
    }
  });

  /*
   * A screenshot taken mid-load is a picture of skeletons, and at thumbnail
   * size it looks plausible enough that nobody notices until it ships.
   */
  it('name something that only exists once the data has arrived', () => {
    for (const shot of SHOTS) {
      expect(shot.settled.length, shot.id).toBeGreaterThan(2);
    }
  });

  it('emit descending widths, so the srcset is ordered', () => {
    for (const shot of SHOTS) {
      const sorted = [...shot.widths].sort((a, b) => b - a);
      expect(shot.widths, shot.id).toEqual(sorted);
      // Never upscale: the capture is the largest width.
      expect(Math.max(...shot.widths), shot.id).toBeLessThanOrEqual(shot.viewport.width);
    }
  });

  it('have unique ids', () => {
    expect(new Set(SHOTS.map((s) => s.id)).size).toBe(SHOTS.length);
  });

  it('build a key the media route can parse back', () => {
    expect(shotKey('shot-overview', 960, 'avif')).toBe('shot-overview-960.avif');
    // The media route parses /^([a-z0-9-]+)-(\d+)\.([a-z]+)$/ and re-derives
    // the key rather than trusting the path, so an id with an underscore or a
    // capital would 404 in a way that is tedious to diagnose.
    for (const shot of SHOTS) {
      expect(shot.id, shot.id).toMatch(/^[a-z0-9-]+$/);
    }
  });

  it('throws on an unknown id rather than returning undefined', () => {
    expect(() => shotById('nope' as never)).toThrow(/No shot spec/);
  });
});
