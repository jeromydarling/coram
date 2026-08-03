/**
 * Derive and upload the marketing screenshots.
 *
 *   npx tsx scripts/upload-shots.ts            # derive + upload
 *   npx tsx scripts/upload-shots.ts --dry-run  # derive only, look at them first
 *
 * Takes the PNGs capture-shots.ts produced and emits, for each declared width,
 * an AVIF and a WebP plus a PNG fallback, then puts them in R2 under the same
 * flat key scheme the photography uses.
 *
 * PNG rather than JPEG for the fallback, and that is not the usual advice.
 * These are screenshots: large flat areas of one colour, hairline borders, and
 * type at small sizes. JPEG puts ringing along every letter and every 1px rule,
 * which on a picture whose entire job is "this looks well made" is the one
 * artefact you cannot afford. PNG is bigger and correct; AVIF handles it well
 * and covers most browsers anyway.
 *
 * Uploading is a separate step from capturing for the same reason the
 * photography pipeline splits them: somebody should look at the output before
 * it becomes a picture on the front page. A bad screenshot is not obviously bad
 * at thumbnail size.
 */

import { spawn } from 'node:child_process';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';

import sharp from 'sharp';

import { SHOTS, shotKey } from '../src/shared/shots';

const IN = 'shots/marketing';
const OUT = 'shots/derived';
const BUCKET = 'coram-media';

const DRY = process.argv.includes('--dry-run');

/** AVIF at this quality is visually lossless on flat UI and roughly a third of the PNG. */
const AVIF_QUALITY = 62;
const WEBP_QUALITY = 88;

function wrangler(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn('npx', ['wrangler', ...args], { stdio: ['ignore', 'pipe', 'pipe'] });
    let err = '';
    child.stderr.on('data', (d) => (err += String(d)));
    child.on('close', (code) =>
      code === 0 ? resolve() : reject(new Error(`wrangler ${args[0]} failed: ${err.slice(0, 400)}`)),
    );
  });
}

async function main() {
  const present = new Set(await readdir(IN).catch(() => []));
  if (!present.size) {
    throw new Error(
      `No captures in ${IN}. Run the Screenshots workflow, download the artifact, and unzip it there.`,
    );
  }

  await mkdir(OUT, { recursive: true });

  const derived: { key: string; bytes: number }[] = [];

  for (const shot of SHOTS) {
    const file = `${shot.id}.png`;
    if (!present.has(file)) {
      throw new Error(`Missing ${file}. A partial set would leave stale pictures on the site.`);
    }

    const source = await readFile(`${IN}/${file}`);
    const meta = await sharp(source).metadata();

    for (const width of shot.widths) {
      // The capture is 2x, so a declared width of 1280 comes from a 2560px
      // source. Never upscale — a blurred screenshot reads as a cheap product.
      if ((meta.width ?? 0) < width) {
        throw new Error(`${shot.id} was captured at ${meta.width}px, narrower than ${width}px.`);
      }

      const resized = sharp(source).resize({ width, withoutEnlargement: true });

      for (const [format, buffer] of [
        ['avif', await resized.clone().avif({ quality: AVIF_QUALITY }).toBuffer()],
        ['webp', await resized.clone().webp({ quality: WEBP_QUALITY }).toBuffer()],
        // effort 9 / palette on: screenshots are mostly flat colour and this
        // roughly halves the fallback nobody should have to download anyway.
        ['png', await resized.clone().png({ compressionLevel: 9, palette: true }).toBuffer()],
      ] as const) {
        const key = shotKey(shot.id, width, format);
        await writeFile(`${OUT}/${key}`, buffer);
        derived.push({ key, bytes: buffer.length });
      }
    }
  }

  const total = derived.reduce((n, d) => n + d.bytes, 0);
  console.log(`Derived ${derived.length} files, ${(total / 1024 / 1024).toFixed(1)} MB, in ${OUT}/.`);

  if (DRY) {
    console.log('Dry run. Look at them, then run again without --dry-run.');
    return;
  }

  for (const { key } of derived) {
    await wrangler(['r2', 'object', 'put', `${BUCKET}/${key}`, '--file', `${OUT}/${key}`, '--remote']);
    process.stdout.write('.');
  }

  console.log(`\nUploaded ${derived.length} objects to ${BUCKET}.`);
}

await main();
