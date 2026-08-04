/** @jsxImportSource hono/jsx */

/**
 * <Shot> — a product screenshot as markup.
 *
 * Sibling of <Picture> and deliberately not the same component. A photograph
 * and a screenshot want different things: a photograph gets a blur-up
 * placeholder and a JPEG floor, a screenshot gets a PNG floor because JPEG
 * rings along every hairline and every letter of small type, which on a picture
 * whose whole job is "this looks well made" is the one artefact you cannot
 * afford.
 *
 * Chromeless. No drawn browser frame, no floating laptop, no fake URL bar — a
 * window around a screenshot is decoration that dates immediately and the
 * product is the picture. A hairline and a shadow, which is what the app's own
 * `.paper` is, and nothing else.
 *
 * Until the shots have been captured and uploaded this renders a labelled
 * placeholder rather than a broken image. That state is real: capture runs in
 * CI and upload is a deliberate human step, so between adding a shot and
 * publishing it the site has to look considered rather than broken.
 */

import { SHOTS, shotKey, type ShotId } from '../../shared/shots';

/**
 * Which shots have actually been uploaded to R2.
 *
 * Hand-maintained rather than generated, because the upload is a human step and
 * this is the record of that decision. Adding an id here without running
 * scripts/upload-shots.ts publishes a 404.
 */
export const PUBLISHED = new Set<ShotId>([
  'shot-overview',
  'shot-advocacy',
  'shot-studio',
  'shot-watch',
  /*
   * 'shot-public' and 'shot-facilitate' are captured in CI but not uploaded
   * yet, so they render the labelled placeholder. That interim is the reason
   * the placeholder exists: a spec has to be in the registry before CI will
   * photograph it, and the upload is a deliberate step afterwards.
   */
  'shot-relationships',
  'shot-money',
  'shot-safety',
  'shot-mobile',
]);

const srcset = (id: ShotId, widths: number[], format: 'avif' | 'webp' | 'png') =>
  widths.map((w) => `/media/${shotKey(id, w, format)} ${w}w`).join(', ');

interface ShotProps {
  id: ShotId;
  /** Maps viewport to rendered width. Wrong sizes costs more than wrong format. */
  sizes: string;
  className?: string;
}

export function Shot({ id, sizes, className }: ShotProps) {
  const spec = SHOTS.find((s) => s.id === id);
  if (!spec) throw new Error(`No shot spec: ${id}`);

  const ratio = `${spec.viewport.width}/${spec.viewport.height}`;

  if (!PUBLISHED.has(id)) {
    return (
      <div
        class={`shot ${className ?? ''}`}
        role="img"
        aria-label={spec.alt}
        style={`aspect-ratio:${ratio};display:grid;place-items:center;background:var(--line);color:var(--muted);font-size:.8rem`}
      >
        Screenshot pending
      </div>
    );
  }

  return (
    <picture>
      <source type="image/avif" srcset={srcset(id, spec.widths, 'avif')} sizes={sizes} />
      <source type="image/webp" srcset={srcset(id, spec.widths, 'webp')} sizes={sizes} />
      <img
        class={`shot ${className ?? ''}`}
        src={`/media/${shotKey(id, spec.widths[0], 'png')}`}
        srcset={srcset(id, spec.widths, 'png')}
        sizes={sizes}
        // Intrinsic size from the spec, so the page does not reflow when the
        // bytes land. These are 2x captures served at their declared width.
        width={spec.viewport.width}
        height={spec.viewport.height}
        alt={spec.alt}
        loading="lazy"
        decoding="async"
        style={`aspect-ratio:${ratio}`}
      />
    </picture>
  );
}

/** A shot with its caption, which is how they appear everywhere on the site. */
export function ShotFigure({ id, sizes, className }: ShotProps) {
  const spec = SHOTS.find((s) => s.id === id);
  if (!spec) throw new Error(`No shot spec: ${id}`);

  return (
    <figure class={`shot-figure ${className ?? ''}`}>
      <Shot id={id} sizes={sizes} />
      <figcaption>{spec.caption}</figcaption>
    </figure>
  );
}
