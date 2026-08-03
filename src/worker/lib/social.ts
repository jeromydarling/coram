/**
 * A social card, in the group's own colours.
 *
 * Same job as flyer.ts and deliberately a separate file: a flyer is a US Letter
 * sheet that will be printed and stapled to a pole, and a social card is a
 * fixed-ratio image that will be scrolled past in half a second. They want
 * opposite things from type, and one renderer trying to do both would serve
 * neither.
 *
 * What they share is the discipline. Everything is drawn in SVG with no
 * external reference, so the file a group downloads works on a machine that has
 * never heard of Coram; the brand's contrast is checked before a pixel is
 * drawn; and a generated backdrop is always covered by enough surface that the
 * ratio the gate verified still roughly holds.
 *
 * Rasterizing to PNG happens in the browser. A Worker has no canvas, and the
 * two candidates for doing it server-side — a WASM renderer or an image service
 * — are respectively a large dependency and a third party looking at a group's
 * unpublished material. Neither is worth it when every browser already has the
 * decoder built in.
 */

import {
  assertLegible,
  readableInk,
  type BrandProfile,
  type SocialSize,
} from '../../shared/brand';

export interface SocialOptions {
  brand: BrandProfile;
  size: SocialSize;
  headline: string;
  /** Date and time, already formatted by the caller in the group's locale. */
  when?: string;
  where?: string;
  /** Where to send people. Rendered small, never as a clickable link. */
  callToAction?: string;
  /** Full-bleed `data:` URI. See FlyerOptions.backdrop for why not a URL. */
  backdrop?: string;
  backdropScrim?: number;
}

function esc(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Break a headline to fit a width, then shrink until it fits the lines given.
 *
 * The same approach flyer.ts takes, and for the same reason: an organizer types
 * whatever the event is called, and a renderer that assumes a length produces
 * either a card with three words on it or one with the last word cut off.
 *
 * Character-width estimation rather than measurement, because a Worker cannot
 * measure text. 0.54em is a reasonable mean for a system sans at weight 700;
 * it errs small, so lines wrap early rather than overflowing.
 */
function layout(headline: string, width: number, maxLines: number, start: number) {
  const words = headline.split(/\s+/).filter(Boolean);

  // Floor at a quarter of the requested size rather than a fixed 20px: a
  // detail line starts around 43px and must be allowed to shrink below the
  // floor a headline needs, or it goes back to overflowing.
  const floor = Math.max(12, Math.round(start * 0.55));

  for (let size = start; size >= floor; size -= 2) {
    const perLine = Math.max(1, Math.floor(width / (size * 0.54)));
    const lines: string[] = [];
    let line = '';

    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (next.length <= perLine) {
        line = next;
      } else {
        if (line) lines.push(line);
        line = word;
      }
    }
    if (line) lines.push(line);

    if (lines.length <= maxLines && lines.every((l) => l.length <= perLine)) {
      return { lines, size };
    }
  }

  /*
   * Nothing fit even at the floor. Break on characters rather than words and
   * accept a hard wrap — a cramped card is recoverable by editing the words,
   * and a line running off the edge of a file somebody prints is not.
   */
  const perLine = Math.max(8, Math.floor(width / (floor * 0.54)));
  const hard: string[] = [];
  for (let i = 0; i < headline.length && hard.length < maxLines; i += perLine) {
    hard.push(headline.slice(i, i + perLine));
  }
  return { lines: hard, size: floor };
}

export function renderSocial({
  brand,
  size,
  headline,
  when,
  where,
  callToAction,
  backdrop,
  backdropScrim,
}: SocialOptions): string {
  assertLegible(brand);

  const { width, height } = size;
  const margin = Math.round(width * 0.075);
  const inner = width - margin * 2;

  // See renderFlyer: the contrast gate checked ink against surface, and a
  // photograph behind that surface invalidates the ratio it verified.
  const scrim = backdrop ? Math.min(1, Math.max(0.45, backdropScrim ?? 0.72)) : 1;

  /*
   * A story is read at arm's length while someone's thumb is already moving,
   * so it gets fewer words at a larger size. A wide card is usually a link
   * preview beside other text and can carry more.
   */
  const spec = {
    square: { start: Math.round(width * 0.105), maxLines: 4, band: 0.34 },
    landscape: { start: Math.round(width * 0.075), maxLines: 3, band: 0.3 },
    story: { start: Math.round(width * 0.1), maxLines: 5, band: 0.22 },
  }[size.id];

  const { lines, size: fontSize } = layout(headline, inner, spec.maxLines, spec.start);
  const onPrimary = readableInk(brand.primary);

  const parts: string[] = [];

  if (backdrop) {
    parts.push(
      `<image href="${esc(backdrop)}" x="0" y="0" width="${width}" height="${height}" ` +
        `preserveAspectRatio="xMidYMid slice"/>`,
      `<rect width="${width}" height="${height}" fill="${brand.surface}" opacity="${scrim}"/>`,
    );
  } else {
    parts.push(`<rect width="${width}" height="${height}" fill="${brand.surface}"/>`);
  }

  // A band in the group's primary along the top, so a card is recognisable as
  // theirs at thumbnail size before a word of it is legible.
  const band = Math.round(height * spec.band * 0.28);
  parts.push(`<rect width="${width}" height="${band}" fill="${brand.primary}"/>`);
  parts.push(
    `<text x="${margin}" y="${Math.round(band * 0.66)}" font-family="system-ui, sans-serif" ` +
      `font-size="${Math.round(band * 0.42)}" font-weight="700" letter-spacing="1.5" ` +
      `fill="${onPrimary}">${esc(brand.name.toUpperCase())}</text>`,
  );

  const lineHeight = Math.round(fontSize * 1.12);
  const blockHeight = lines.length * lineHeight;
  // Optically centred in the space below the band, biased up: a card with the
  // text dead-centre reads as lower than it is once the band is there.
  let y = band + Math.round((height - band - blockHeight) * 0.42) + fontSize;

  for (const line of lines) {
    parts.push(
      `<text x="${margin}" y="${y}" font-family="system-ui, sans-serif" ` +
        `font-size="${fontSize}" font-weight="700" fill="${brand.ink}">${esc(line)}</text>`,
    );
    y += lineHeight;
  }

  const detail = [when, where].filter(Boolean).join(' · ');
  if (detail) {
    /*
     * Wrapped and shrunk to fit, not drawn at a fixed size and hoped for.
     *
     * "Tuesday 5 August, 6.30pm · City Hall, chamber B" is an ordinary line for
     * a meeting and it is 46 characters. Drawn as one <text> at 0.4 of the
     * headline it ran off the right edge of the card — clipped in the preview
     * and clipped in the file somebody downloads and posts, which is worse.
     * SVG does not wrap text, so the fitting has to happen here.
     */
    y += Math.round(fontSize * 0.5);
    parts.push(
      `<rect x="${margin}" y="${y - Math.round(fontSize * 0.55)}" width="${Math.round(inner * 0.18)}" ` +
        `height="${Math.max(3, Math.round(width * 0.005))}" fill="${brand.accent}"/>`,
    );

    const detailLayout = layout(detail, inner, 2, Math.round(fontSize * 0.4));
    let dy = y + Math.round(detailLayout.size * 1.25);
    for (const line of detailLayout.lines) {
      parts.push(
        `<text x="${margin}" y="${dy}" font-family="system-ui, sans-serif" ` +
          `font-size="${detailLayout.size}" font-weight="500" fill="${brand.ink}">${esc(line)}</text>`,
      );
      dy += Math.round(detailLayout.size * 1.25);
    }
  }

  if (callToAction) {
    parts.push(
      `<text x="${margin}" y="${height - margin}" font-family="system-ui, sans-serif" ` +
        `font-size="${Math.round(fontSize * 0.36)}" font-weight="600" ` +
        `fill="${brand.primary}">${esc(callToAction)}</text>`,
    );
  }

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" ` +
    `viewBox="0 0 ${width} ${height}" role="img" ` +
    // The alt text a screen reader reads, and the caption a person should keep
    // when they post it. An image of words that carries no words is unreadable
    // to anyone using a screen reader, which on a community post is most of the
    // point of posting it.
    `aria-label="${esc([headline, detail].filter(Boolean).join('. '))}">` +
    parts.join('') +
    `</svg>`
  );
}
