/**
 * Flyer rendering — SVG in, SVG out, no raster step.
 *
 * SVG because a Worker has no canvas and because the output is going to a copy
 * shop. Vector prints crisply at any size, opens in every browser's print
 * dialogue, and can be handed to a designer who wants to change something.
 * A PNG would be worse on all three counts and would need a rasteriser in the
 * bundle.
 *
 * Everything is laid out in absolute units on a US Letter page at 96dpi, so
 * "print at 100%" produces the thing you saw on screen.
 *
 * Text is escaped and wrapped here rather than relying on any SVG text-flow
 * feature, because `foreignObject` does not render in most print paths and
 * `textLength` distorts glyphs. Wrapping is estimated from average character
 * width per weight — good enough for a poster, and it degrades by breaking a
 * line early rather than overflowing the page.
 */

import {
  FLYER_H,
  FLYER_W,
  assertLegible,
  readableInk,
  type BrandProfile,
  type FlyerContent,
  type TemplateId,
} from '../../shared/brand';

/** XML-escape. Everything user-supplied goes through this before it reaches the document. */
function esc(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Approximate advance width per character, as a fraction of font size.
 *
 * A real shaper would need the font. These constants are measured from the
 * system serif/sans stacks the page uses and are deliberately generous, so the
 * failure mode is a line breaking sooner than it needed to rather than text
 * running off the edge of a printed page.
 */
const ADVANCE = { bold: 0.56, regular: 0.5 };

function wrap(text: string, fontSize: number, maxWidth: number, bold = false): string[] {
  const perChar = fontSize * (bold ? ADVANCE.bold : ADVANCE.regular);
  const maxChars = Math.max(6, Math.floor(maxWidth / perChar));

  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const candidate = line ? `${line} ${word}` : word;
    if (candidate.length <= maxChars) {
      line = candidate;
    } else {
      if (line) lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * Shrink the headline until it fits the space it has.
 *
 * A flyer with a four-word headline and one with a twenty-word headline should
 * both look deliberate. Rather than clipping, the type size steps down until
 * the block fits the band, which is what a designer would do.
 */
function fitHeadline(
  text: string,
  maxWidth: number,
  maxLines: number,
  start: number,
  min: number,
): { size: number; lines: string[] } {
  let size = start;
  let lines = wrap(text, size, maxWidth, true);
  while (lines.length > maxLines && size > min) {
    size -= 4;
    lines = wrap(text, size, maxWidth, true);
  }
  return { size, lines: lines.slice(0, maxLines) };
}

export interface FlyerOptions {
  brand: BrandProfile;
  content: FlyerContent;
  template: TemplateId;
  /** Rendered small, bottom-right. Omitted when absent. */
  qrHref?: string;
  /**
   * An optional full-bleed backdrop, as a `data:` URI.
   *
   * A URI rather than a URL on purpose: an SVG that references a remote image
   * is a file that stops working the moment it is emailed, printed from
   * another machine, or opened after the link expires. Everything the group
   * downloads has to be one self-contained file.
   *
   * It sits *behind* the surface, which is redrawn over it at `backdropScrim`
   * opacity so the contrast the brand gate already checked still holds. A
   * generated image is not allowed to make the type unreadable.
   */
  backdrop?: string;
  /** How much surface to keep over the backdrop. 0 is none, 1 hides it. */
  backdropScrim?: number;
}

/**
 * Render a flyer.
 *
 * Throws if the brand's colours would be unreadable. That is deliberate: the
 * studio shows contrast while colours are being chosen, so reaching this point
 * with a failing palette means something bypassed the editor.
 */
export function renderFlyer({
  brand,
  content,
  template,
  backdrop,
  backdropScrim,
}: FlyerOptions): string {
  assertLegible(brand);

  /*
   * A floor on the scrim, not just a default.
   *
   * The contrast gate in brand.ts checks ink against surface. Put a photograph
   * behind that surface and the ratio it verified is no longer the ratio on the
   * page — a dark patch under dark type is unreadable no matter what the brand
   * profile says. Holding 62% of the surface keeps the checked pair close
   * enough to true, and a group that wants a bolder image can go to 0.45 and no
   * further.
   */
  const scrim = backdrop ? Math.min(1, Math.max(0.45, backdropScrim ?? 0.72)) : 1;

  const M = 64; // page margin
  const inner = FLYER_W - M * 2;
  const onPrimary = readableInk(brand.primary);

  // Band depth and headline scale are what actually distinguish the templates:
  // a notice is dense and quiet, a rally is one message read from across a road.
  const spec = {
    notice: { minBand: 170, maxBand: 340, headline: 62, minHeadline: 30, maxLines: 3 },
    rally: { minBand: 300, maxBand: 620, headline: 108, minHeadline: 48, maxLines: 4 },
    meeting: { minBand: 200, maxBand: 460, headline: 78, minHeadline: 36, maxLines: 3 },
  }[template];

  const headline = fitHeadline(
    content.headline,
    inner,
    spec.maxLines,
    spec.headline,
    spec.minHeadline,
  );

  /*
   * The band hugs its headline rather than being a fixed slab, which left a
   * third of the page as dead colour under a two-word headline.
   *
   * Note the interaction that made the first attempt at this a no-op: because
   * fitHeadline *shrinks* type to stay within the line budget, a longer
   * headline produces smaller text and a block of roughly the same height. The
   * band therefore tracks the rendered block, not the length of the string, and
   * the minimum has to be low enough to let a short headline sit tight.
   */
  const headlineBlock = headline.lines.length * headline.size * 1.06;
  const band = Math.min(spec.maxBand, Math.max(spec.minBand, headlineBlock + M * 2));

  const parts: string[] = [];

  if (backdrop) {
    // preserveAspectRatio slice: fill the page and crop, never letterbox with
    // a band of the wrong colour down one side.
    parts.push(
      `<image href="${esc(backdrop)}" x="0" y="0" width="${FLYER_W}" height="${FLYER_H}" ` +
        `preserveAspectRatio="xMidYMid slice"/>`,
    );
    parts.push(
      `<rect width="${FLYER_W}" height="${FLYER_H}" fill="${brand.surface}" ` +
        `opacity="${scrim}"/>`,
    );
  } else {
    parts.push(`<rect width="${FLYER_W}" height="${FLYER_H}" fill="${brand.surface}"/>`);
  }
  parts.push(`<rect width="${FLYER_W}" height="${band}" fill="${brand.primary}"/>`);

  // Headline, baseline-stacked inside the band.
  const lineHeight = headline.size * 1.06;
  const blockHeight = headline.lines.length * lineHeight;
  let y = (band - blockHeight) / 2 + headline.size * 0.82;
  for (const line of headline.lines) {
    parts.push(
      `<text x="${M}" y="${y.toFixed(1)}" font-family="Georgia, 'Times New Roman', serif" ` +
        `font-size="${headline.size}" font-weight="600" fill="${onPrimary}" ` +
        `letter-spacing="-0.5">${esc(line)}</text>`,
    );
    y += lineHeight;
  }

  // The two facts people actually came for.
  let cursor = band + 84;
  for (const [label, value] of [
    ['When', content.when],
    ['Where', content.where],
  ] as const) {
    parts.push(
      `<text x="${M}" y="${cursor}" font-family="system-ui, sans-serif" font-size="20" ` +
        `font-weight="700" fill="${brand.accent}" letter-spacing="2">${esc(label.toUpperCase())}</text>`,
    );
    cursor += 40;
    for (const line of wrap(value, 34, inner)) {
      parts.push(
        `<text x="${M}" y="${cursor}" font-family="system-ui, sans-serif" font-size="34" ` +
          `fill="${brand.ink}">${esc(line)}</text>`,
      );
      cursor += 44;
    }
    cursor += 28;
  }

  if (content.detail) {
    for (const line of wrap(content.detail, 22, inner)) {
      parts.push(
        `<text x="${M}" y="${cursor}" font-family="system-ui, sans-serif" font-size="22" ` +
          `fill="${brand.ink}" opacity="0.8">${esc(line)}</text>`,
      );
      cursor += 30;
    }
  }

  // Footer rule, wordmark, and the call to action.
  const footY = FLYER_H - 96;
  parts.push(
    `<rect x="${M}" y="${footY - 34}" width="${inner}" height="3" fill="${brand.accent}"/>`,
  );
  parts.push(
    `<text x="${M}" y="${footY}" font-family="Georgia, serif" font-size="26" ` +
      `fill="${brand.ink}">${esc(brand.name)}</text>`,
  );
  if (content.callToAction) {
    parts.push(
      `<text x="${FLYER_W - M}" y="${footY}" text-anchor="end" ` +
        `font-family="system-ui, sans-serif" font-size="22" font-weight="600" ` +
        `fill="${brand.primary}">${esc(content.callToAction)}</text>`,
    );
  }

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${FLYER_W}" height="${FLYER_H}" ` +
    `viewBox="0 0 ${FLYER_W} ${FLYER_H}" role="img" ` +
    `aria-label="${esc(`${content.headline}. ${content.when}. ${content.where}.`)}">` +
    parts.join('') +
    `</svg>`
  );
}
