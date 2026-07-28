import { describe, expect, it } from 'vitest';

import type { Env } from '../env';
import { media } from './media';

/** Records every key the route asks R2 for, so we can assert what it did not ask for. */
function fakeEnv(objects: Record<string, string> = {}) {
  const asked: string[] = [];
  const env = {
    R2_MEDIA: {
      get: async (key: string) => {
        asked.push(key);
        return objects[key]
          ? { body: objects[key], httpEtag: '"etag"' }
          : null;
      },
    },
  } as unknown as Env;
  return { env, asked };
}

const get = (path: string, env: Env) => media.request(path, {}, env);

describe('/media', () => {
  it('serves a declared width and format', async () => {
    const { env } = fakeEnv({ 'hero-hall-1440.avif': 'bytes' });
    const res = await get('/media/hero-hall-1440.avif', env);

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('image/avif');
    expect(res.headers.get('Cache-Control')).toContain('immutable');
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
  });

  it('404s when the object is not in the bucket', async () => {
    const { env } = fakeEnv();
    expect((await get('/media/hero-hall-1440.avif', env)).status).toBe(404);
  });

  /*
   * The guard that matters. Anything not matching the id-width-format shape
   * must be rejected *before* R2 is touched — a path segment reaching
   * R2.get() unvalidated is how a media route becomes a way to enumerate a
   * bucket. Asserting on `asked` rather than just the status is the point:
   * a 404 could also mean "we looked and missed".
   */
  it.each([
    '/media/../../secret',
    '/media/hero-hall-1440.avif/../../etc',
    '/media/HERO-hall-1440.avif',
    '/media/hero-hall.avif',
    '/media/hero-hall-1440.svg',
    '/media/hero-hall-1440.avif%00.txt',
  ])('rejects %s without touching R2', async (path) => {
    const { env, asked } = fakeEnv();
    const res = await get(path, env);

    expect(res.status).toBe(404);
    expect(asked).toEqual([]);
  });

  it('rejects a width the art direction never declared', async () => {
    const { env, asked } = fakeEnv();
    // 1441 is well-formed and plausible, and still must not reach the bucket —
    // otherwise the allowed set is the filename grammar, not the manifest.
    expect((await get('/media/hero-hall-1441.avif', env)).status).toBe(404);
    expect(asked).toEqual([]);
  });

  it('rejects an id that is not in the direction', async () => {
    const { env, asked } = fakeEnv();
    expect((await get('/media/not-an-image-1440.avif', env)).status).toBe(404);
    expect(asked).toEqual([]);
  });
});
