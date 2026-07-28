/**
 * Upload the derived image set to R2.
 *
 *   npm run imagery:upload            # to the dev bucket
 *   npm run imagery:upload -- --remote --env production
 *
 * Separate from generation on purpose: generation is cheap to redo and its
 * output needs a human to look at it before it becomes the picture on the front
 * page. Nothing here calls a model.
 */

import { copyFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

const DERIVED_DIR = 'media/derived';
const BUCKET = 'coram-media';

/** Written by generate-imagery.ts. Gitignored. */
const STAGED_MANIFEST = 'media/manifest.json';

/**
 * Imported by the Worker, and the switch that makes <Picture> emit a real
 * <img> instead of its fallback tone block. Promoted here, as the last step,
 * and nowhere else — a committed manifest whose objects are not in the bucket
 * puts broken images on the site, which is worse than the placeholder it
 * replaced. Making the upload the only writer means the two cannot drift.
 */
const PUBLISHED_MANIFEST = 'src/shared/imagery-manifest.json';

const CONTENT_TYPE: Record<string, string> = {
  avif: 'image/avif',
  webp: 'image/webp',
  jpg: 'image/jpeg',
};

async function main(): Promise<void> {
  const passthrough = process.argv.slice(2);
  let files: string[];

  try {
    files = await readdir(DERIVED_DIR);
  } catch {
    throw new Error(`No ${DERIVED_DIR}. Run \`npm run imagery:generate\` first.`);
  }

  if (!files.length) throw new Error(`${DERIVED_DIR} is empty.`);

  for (const file of files) {
    const ext = file.split('.').pop() ?? '';
    const contentType = CONTENT_TYPE[ext];
    if (!contentType) {
      console.log(`· skipping ${file} — not an image we serve`);
      continue;
    }

    const result = spawnSync(
      'npx',
      [
        'wrangler',
        'r2',
        'object',
        'put',
        `${BUCKET}/${file}`,
        '--file',
        join(DERIVED_DIR, file),
        '--content-type',
        contentType,
        // Content-addressed by width and format, and regenerating produces a
        // new review step rather than a silent swap, so a year is safe.
        '--cache-control',
        'public, max-age=31536000, immutable',
        ...passthrough,
      ],
      { stdio: 'inherit' },
    );

    if (result.status !== 0) throw new Error(`Upload failed for ${file}`);
  }

  /*
   * Only now. If any upload above threw we never reach this line, so the
   * committed manifest keeps describing whatever is actually in the bucket
   * rather than what we hoped to put there.
   */
  if (!existsSync(STAGED_MANIFEST)) {
    throw new Error(
      `Uploaded ${files.length} objects but ${STAGED_MANIFEST} is missing, so there is ` +
        `nothing to publish. Run \`npm run imagery:generate\` and upload again.`,
    );
  }

  await copyFile(STAGED_MANIFEST, PUBLISHED_MANIFEST);

  console.log(
    `\nUploaded ${files.length} objects to ${BUCKET}.` +
      `\nPromoted ${STAGED_MANIFEST} → ${PUBLISHED_MANIFEST}; commit it to ship the images.`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
