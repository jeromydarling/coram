/**
 * Move the SPA shell out of the assets root after the build.
 *
 * Cloudflare serves static assets *before* the Worker runs, so a file at
 * dist/client/index.html claims `/` and the marketing home page becomes
 * unreachable in production — silently, and only in production, because
 * `wrangler dev` and every local render still route through the Worker. Every
 * other page worked; only the one with a file shadowing it did not.
 *
 * Relocating the shell to /app/index.html removes the collision entirely
 * rather than trying to out-configure the precedence rules. The SPA's own
 * asset URLs are absolute (/assets/...), so nothing inside it changes.
 */
import { mkdir, rename, access } from 'node:fs/promises';

const from = 'dist/client/index.html';
const to = 'dist/client/app/index.html';

try {
  await access(from);
} catch {
  console.log('relocate-spa-shell: nothing at', from, '— already moved?');
  process.exit(0);
}

await mkdir('dist/client/app', { recursive: true });
await rename(from, to);
console.log(`relocate-spa-shell: ${from} -> ${to}`);
