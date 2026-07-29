import { describe, expect, it } from 'vitest';

import { ABUSE_CONTACT, PROHIBITED } from '../../shared/policy';
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
  it.each(['/', '/pricing', '/why', '/trust', '/acceptable-use'])('renders %s', async (path) => {
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
    for (const path of ['/', '/pricing', '/why', '/trust', '/acceptable-use']) {
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

  /*
   * Hono JSX escapes text children, so `<style>{CSS}</style>` ships a child
   * combinator as `&gt;`. That is not a cosmetic problem: an invalid selector
   * invalidates the whole selector list, so a CSS parser silently discards the
   * entire rule — including the valid selectors sitting next to it. It cost
   * object-fit on the hero and the width cap on the /why portrait, with no
   * error in the console and nothing visibly wrong until an image was real.
   */
  it.each(['/', '/pricing', '/why', '/trust', '/acceptable-use'])('emits unescaped CSS on %s', async (path) => {
    const html = await (await get(path, fakeEnv())).text();
    const styles = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]);

    expect(styles.length).toBeGreaterThan(0);
    for (const css of styles) {
      expect(css).not.toContain('&gt;');
      expect(css).not.toContain('&amp;');
      expect(css).not.toContain('&quot;');
    }
  });

  it('caps the /why portrait so it cannot force horizontal overflow', async () => {
    const html = await (await get('/why', fakeEnv())).text();
    const css = /<style[^>]*>([\s\S]*?)<\/style>/.exec(html)?.[1] ?? '';
    // The rule that constrains the floated image. If the selector is mangled
    // again this is what stops the page scrolling sideways.
    expect(css).toMatch(/\.portrait img[^{]*\{[^}]*width:\s*100%/);
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

describe('/acceptable-use', () => {
  /*
   * The assertion that carries the policy's intent. If a future edit tightens
   * the rules into a ban on militancy, this is what should stop it — the page
   * has to keep saying, in as many words, that unlawful civil disobedience is
   * protected here.
   */
  it('names unlawful civil disobedience as protected', async () => {
    const html = await (await get('/acceptable-use', fakeEnv())).text();
    expect(html).toMatch(/civil disobedience/i);
    expect(html).toMatch(/unlawful/i);
    expect(html).toMatch(/bail fund/i);
  });

  it('puts what is protected before what is prohibited', async () => {
    const html = await (await get('/acceptable-use', fakeEnv())).text();
    expect(html.indexOf('What is welcome here')).toBeLessThan(html.indexOf('What is not'));
  });

  it('renders every rule from the policy module rather than a copy of it', async () => {
    const html = await (await get('/acceptable-use', fakeEnv())).text();
    for (const rule of PROHIBITED) {
      // The page escapes an em dash and apostrophes; compare on the opening
      // clause, which is plain ASCII in every rule.
      expect(html).toContain(rule.text.split(/[—’']/)[0].trim());
    }
  });

  it('states no rule about a cause or a politics', async () => {
    const html = await (await get('/acceptable-use', fakeEnv())).text();
    // "extremist", "radical", "militant" and friends are how this kind of page
    // usually goes wrong.
    for (const rule of PROHIBITED) {
      expect(rule.text).not.toMatch(/\b(extremis|radical|militant)/i);
    }
    expect(html).toContain('about conduct');
  });

  it('is reachable from every page, not just by URL', async () => {
    for (const path of ['/', '/pricing', '/why', '/trust']) {
      const html = await (await get(path, fakeEnv())).text();
      expect(html).toContain('href="/acceptable-use"');
    }
  });

  it('gives a contact that is a person, not a form', async () => {
    const html = await (await get('/acceptable-use', fakeEnv())).text();
    expect(html).toContain(`mailto:${ABUSE_CONTACT}`);
  });
});
