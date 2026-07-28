/**
 * Generate the §8.2 marketing photography with Workers AI, then derive the
 * responsive AVIF/WebP/JPEG set and the blur-up placeholders.
 *
 *   npm run imagery:generate            # everything missing
 *   npm run imagery:generate hero-hall  # one image
 *   npm run imagery:generate -- --force # regenerate even if present
 *
 * Needs CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN (Workers AI: Read).
 *
 * Generation is a build-time step on purpose. Nine photographs do not change
 * between deploys, and generating them per-request would mean a marketing page
 * whose LCP depends on an inference queue — §8 sets a 1.5s LCP target. It also
 * keeps the art direction reviewable: the PNGs land in the tree, a person looks
 * at them, and only then do they ship.
 *
 * The originals go to media/original/ (gitignored — they are large and
 * reproducible). The derived set goes to media/derived/ and is uploaded to R2
 * by `npm run imagery:upload`.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import sharp from 'sharp';

import {
  IMAGES,
  assertOnDirection,
  objectKey,
  prompt,
  type ImageSpec,
} from '../src/shared/imagery';

const MODEL = process.env.IMAGERY_MODEL ?? '@cf/black-forest-labs/flux-2-dev';

/**
 * Sampling steps. flux-2-dev is not step-distilled, so this is the main lever
 * for the film-grain, available-light look §8.2 asks for — more steps resolve
 * the falloff in a dim room instead of flattening it.
 *
 * Overridable because the ceiling here is shared capacity rather than the
 * model: a busy account answers a long generation with a 424 or 429, and
 * dropping steps is the difference between a run that finishes and one that
 * spends its whole budget on retries.
 */
const STEPS = Number(process.env.IMAGERY_STEPS ?? 20);
const ORIGINAL_DIR = 'media/original';
const DERIVED_DIR = 'media/derived';
const MANIFEST = 'src/shared/imagery-manifest.json';

/** Wide enough to carry the grain, small enough to inline in the HTML. */
const LQIP_WIDTH = 20;

interface ManifestEntry {
  id: string;
  width: number;
  height: number;
  /** base64 WebP, ~400 bytes, inlined as a background while the real one loads. */
  lqip: string;
  bytes: Record<string, number>;
}

function env(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} is not set. Workers AI needs an account id and a token with Workers AI: Read.`,
    );
  }
  return value;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function attempt(spec: ImageSpec): Promise<Buffer> {
  const form = new FormData();
  form.append('prompt', prompt(spec));
  form.append('width', String(spec.width));
  form.append('height', String(spec.height));
  form.append('steps', String(STEPS));

  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${env('CLOUDFLARE_ACCOUNT_ID')}/ai/run/${MODEL}`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${env('CLOUDFLARE_API_TOKEN')}` },
      body: form,
    },
  );

  if (!res.ok) {
    throw new Error(`Workers AI ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }

  // The image models return raw bytes on some routes and a base64 field on
  // others. Handle both rather than guessing and failing at 3am.
  const type = res.headers.get('content-type') ?? '';
  if (type.startsWith('image/')) {
    return Buffer.from(await res.arrayBuffer());
  }

  const body = (await res.json()) as { result?: { image?: string } };
  const b64 = body.result?.image;
  if (!b64) {
    throw new Error(`Workers AI returned no image: ${JSON.stringify(body).slice(0, 300)}`);
  }
  return Buffer.from(b64, 'base64');
}

/**
 * Generate one image, retrying transient routing failures.
 *
 * Workers AI answers a busy model with 424 `could not route request to AI
 * model`, which is capacity rather than anything wrong with the request — the
 * identical call succeeds a minute later. Without a retry a nine-image run dies
 * on whichever one happened to land badly, having already paid for the ones
 * before it.
 */
async function generate(spec: ImageSpec): Promise<Buffer> {
  // Check before spending an inference, not after.
  assertOnDirection(spec);

  let lastError: unknown;

  for (let i = 0; i < 4; i++) {
    try {
      return await attempt(spec);
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      // A prompt the model rejects will be rejected identically every time.
      // Only back off for the failures that are worth waiting out.
      if (!/\b(424|429|500|502|503|504)\b|could not route/.test(message)) throw error;
      const wait = 2000 * 2 ** i;
      console.log(`  ↻ ${spec.id} — ${message.slice(0, 80)}; retrying in ${wait / 1000}s`);
      await sleep(wait);
    }
  }

  throw lastError;
}

async function derive(spec: ImageSpec, original: Buffer): Promise<ManifestEntry> {
  await mkdir(DERIVED_DIR, { recursive: true });
  const bytes: Record<string, number> = {};

  for (const width of spec.widths) {
    const resized = sharp(original).resize({ width, withoutEnlargement: true });

    // AVIF first (§8.2), WebP as the fallback, JPEG as the floor for anything
    // that negotiates neither.
    const outputs = [
      { format: 'avif' as const, buffer: await resized.clone().avif({ quality: 55 }).toBuffer() },
      { format: 'webp' as const, buffer: await resized.clone().webp({ quality: 72 }).toBuffer() },
      {
        format: 'jpeg' as const,
        buffer: await resized.clone().jpeg({ quality: 78, mozjpeg: true }).toBuffer(),
      },
    ];

    for (const { format, buffer } of outputs) {
      const key = objectKey(spec.id, width, format);
      await writeFile(join(DERIVED_DIR, key), buffer);
      bytes[key] = buffer.length;
    }
  }

  const lqip = await sharp(original)
    .resize({ width: LQIP_WIDTH })
    .blur(1.2)
    .webp({ quality: 30 })
    .toBuffer();

  const meta = await sharp(original).metadata();

  return {
    id: spec.id,
    width: meta.width ?? spec.width,
    height: meta.height ?? spec.height,
    lqip: `data:image/webp;base64,${lqip.toString('base64')}`,
    bytes,
  };
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const force = args.includes('--force');
  const only = args.filter((a) => !a.startsWith('--'));
  const targets = only.length ? IMAGES.filter((i) => only.includes(i.id)) : IMAGES;

  if (!targets.length) throw new Error(`No image matches ${only.join(', ')}`);

  await mkdir(ORIGINAL_DIR, { recursive: true });

  const manifest: Record<string, ManifestEntry> = existsSync(MANIFEST)
    ? JSON.parse(await readFile(MANIFEST, 'utf8'))
    : {};

  for (const spec of targets) {
    const originalPath = join(ORIGINAL_DIR, `${spec.id}.png`);
    let original: Buffer;

    if (existsSync(originalPath) && !force) {
      console.log(`· ${spec.id} — original present, re-deriving only`);
      original = await readFile(originalPath);
    } else {
      console.log(`⟳ ${spec.id} — generating ${spec.width}×${spec.height}`);
      original = await generate(spec);
      await writeFile(originalPath, original);
    }

    manifest[spec.id] = await derive(spec, original);
    console.log(`✓ ${spec.id} — ${Object.keys(manifest[spec.id].bytes).length} derived files`);
  }

  await writeFile(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`\nWrote ${MANIFEST}. Review media/original/ before uploading.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
