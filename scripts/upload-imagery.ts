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

import { readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

const DERIVED_DIR = 'media/derived';
const BUCKET = 'coram-media';

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

  console.log(`\nUploaded ${files.length} objects to ${BUCKET}.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
