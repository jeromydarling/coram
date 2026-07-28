/**
 * /media/* — the §8.2 marketing photography, out of R2.
 *
 * The set is generated at build time by `scripts/generate-imagery.ts` and
 * uploaded by `scripts/upload-imagery.ts`. Nothing here calls a model, and
 * nothing here reads Postgres: these bytes are public, identical for every
 * visitor, and must not put an inference or a database round-trip on the
 * critical path of a page with a 1.5s LCP target (§8).
 *
 * Format negotiation happens in the URL rather than by Vary: Accept, because
 * the markup already emits a <picture> with explicit AVIF and WebP sources and
 * the browser picks. Varying on Accept as well would fragment the cache for no
 * gain.
 */

import { Hono } from 'hono';

import type { Env, Vars } from '../env';
import { IMAGES, type ImageId } from '../../shared/imagery';

export const media = new Hono<{ Bindings: Env; Variables: Vars }>();

const EXTENSIONS = new Set(['avif', 'webp', 'jpg']);

const CONTENT_TYPE: Record<string, string> = {
  avif: 'image/avif',
  webp: 'image/webp',
  jpg: 'image/jpeg',
};

/** Only widths the direction actually declares. */
const ALLOWED = new Map<ImageId, Set<number>>(
  IMAGES.map((spec) => [spec.id, new Set(spec.widths)]),
);

media.get('/media/:file', async (c) => {
  const file = c.req.param('file');

  /*
   * Parse and re-derive the key rather than passing the path through. An
   * unvalidated segment reaching R2.get() is how a media route turns into a
   * way to probe for other objects in the bucket.
   */
  const match = /^([a-z0-9-]+)-(\d+)\.([a-z]+)$/.exec(file);
  if (!match) return c.notFound();

  const [, id, widthText, ext] = match;
  const width = Number(widthText);

  if (!EXTENSIONS.has(ext)) return c.notFound();
  if (!ALLOWED.get(id as ImageId)?.has(width)) return c.notFound();

  const object = await c.env.R2_MEDIA.get(`${id}-${width}.${ext}`);
  if (!object) return c.notFound();

  return new Response(object.body, {
    headers: {
      'Content-Type': CONTENT_TYPE[ext],
      // Immutable: a regenerated photograph is a new review step and a new
      // deploy, not a silent swap behind the same URL.
      'Cache-Control': 'public, max-age=31536000, immutable',
      ETag: object.httpEtag,
      'X-Content-Type-Options': 'nosniff',
    },
  });
});
