import { describe, expect, it } from 'vitest';

import type { Env } from '../env';
import { marketing } from './marketing';

/**
 * A KV stand-in. Only `get` and `put` are exercised by these routes; the rest
 * of the KVNamespace surface is absent on purpose so a route that reaches for
 * `list` or `getWithMetadata` fails here rather than in production.
 */
function fakeEnv(seed: Record<string, string> = {}): Env {
  const store = new Map(Object.entries(seed));
  return {
    KV_FLAGS: {
      get: async (k: string) => store.get(k) ?? null,
      put: async (k: string, v: string) => void store.set(k, v),
    },
  } as unknown as Env;
}

const get = (path: string, env: Env) => marketing.request(path, {}, env);

describe('marketing pages', () => {
  it.each(['/', '/pricing', '/why', '/trust'])('renders %s', async (path) => {
    const res = await get(path, fakeEnv());
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('<html lang="en">');
    expect(html).toContain('</html>');
    // A JSX mistake that renders a component reference instead of markup
    // typecheck-passes and looks fine until you read the page.
    expect(html).not.toContain('[object Object]');
    expect(html).not.toContain('function ');
  });

  /*
   * CLAUDE.md's hardest copy rule: never describe this product as open source
   * or source-available. Both are false and both would be the kind of claim
   * that costs exactly the trust §7 exists to build.
   */
  it('never claims to be open source anywhere on the site', async () => {
    for (const path of ['/', '/pricing', '/why', '/trust']) {
      const html = await (await get(path, fakeEnv())).text();

      // The phrase may appear, but only inside a denial — /trust says "we do
      // not call this open source or source-available". So check each sentence
      // that mentions it, rather than banning the words outright.
      const sentences = html.split(/(?<=[.!?])\s+/);
      for (const sentence of sentences) {
        if (!/open[- ]source|source[- ]available/i.test(sentence)) continue;
        expect(sentence).toMatch(/\b(do not|don't|not|never|neither)\b/i);
      }
    }
  });

  it('says plainly that it is closed source', async () => {
    const html = await (await get('/', fakeEnv())).text();
    expect(html).toContain('closed source');
  });
});

describe('/trust', () => {
  it('admits that nothing has been published, rather than showing an empty list', async () => {
    const html = await (await get('/trust', fakeEnv())).text();
    expect(html).toContain('Nothing has been published yet.');
    expect(html).not.toMatch(/coming soon|in progress/i);
  });

  it('names all four artifacts even when none exist yet', async () => {
    const html = await (await get('/trust', fakeEnv())).text();
    for (const title of [
      'Independent security audit',
      'Transparency report',
      'Warrant canary',
      'Export and self-host documentation',
    ]) {
      expect(html).toContain(title);
    }
  });

  it('flags an overdue artifact without being asked to', async () => {
    const old = new Date(Date.now() - 400 * 86_400_000).toISOString().slice(0, 10);
    const env = fakeEnv({
      'trust:canary': JSON.stringify({ publishedAt: old, url: '/canary.txt' }),
    });

    const html = await (await get('/trust', env)).text();
    expect(html).toContain('Something on this page is overdue.');
    expect(html).toContain('Overdue.');
    // One artifact published means the never-published banner must go.
    expect(html).not.toContain('Nothing has been published yet.');
  });

  /*
   * The canary appears twice on the page — once as one of the four cards, once
   * in its own section explaining that signing is manual. They read from the
   * same record, so a published canary must not be able to show as overdue in
   * one place and current in the other.
   */
  it('does not contradict itself about the canary', async () => {
    const env = fakeEnv({
      'trust:canary': JSON.stringify({ publishedAt: '2026-07-01', url: '/canary.txt' }),
    });

    const html = await (await get('/trust', env)).text();
    // Once in the artifact card, once in the section below it. The other three
    // artifacts stay unpublished, which is why this counts rather than asserting
    // the page is free of "Not published yet."
    expect(html.match(/Published 2026-07-01\./g)).toHaveLength(2);
    expect(html).not.toContain('Nothing has been published yet.');
  });
});

describe('machine-readable endpoints', () => {
  it('404s /canary.txt when no canary has been signed', async () => {
    const res = await get('/canary.txt', fakeEnv());
    expect(res.status).toBe(404);
    expect(res.headers.get('Content-Type')).toContain('text/plain');
  });

  it('serves the signed canary verbatim', async () => {
    const signed = '-----BEGIN PGP SIGNED MESSAGE-----\nNo secret subpoena.\n';
    const res = await get('/canary.txt', fakeEnv({ 'canary:document': signed }));
    expect(res.status).toBe(200);
    expect(await res.text()).toBe(signed);
  });

  it('404s the signing key until one is published', async () => {
    expect((await get('/.well-known/coram-pgp.asc', fakeEnv())).status).toBe(404);
  });

  it('serves security.txt with a contact and an expiry', async () => {
    const res = await get('/.well-known/security.txt', fakeEnv());
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toMatch(/^Contact: mailto:/m);
    // RFC 9116 requires Expires, and a security.txt that has lapsed is
    // treated by scanners as no security.txt at all.
    const expires = body.match(/^Expires: (.+)$/m)?.[1];
    expect(expires).toBeTruthy();
    expect(Date.parse(expires!)).toBeGreaterThan(Date.now());
  });
});
