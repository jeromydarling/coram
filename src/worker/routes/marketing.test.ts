import { describe, expect, it } from 'vitest';

import { IMAGES } from '../../shared/imagery';
import { DEMO_EMAIL, DEMO_PASSWORD } from '../../shared/demo';
import { ABSENT, CONTROLS } from '../../shared/security';

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
  it.each(['/', '/pricing', '/why', '/trust', '/terms'])('renders %s', async (path) => {
    const res = await get(path, fakeEnv());
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('<html lang="en">');
    expect(html).toContain('</html>');
    /*
     * A JSX mistake that renders a component reference instead of markup
     * typecheck-passes and looks fine until you read the page.
     *
     * The second assertion used to be `not.toContain('function ')`, which is a
     * substring of ordinary English — "written into a database function rather
     * than a settings page" failed it. A stringified function always has a
     * parameter list, so requiring the parenthesis matches the mistake and not
     * the prose.
     */
    expect(html).not.toContain('[object Object]');
    expect(html).not.toMatch(/function\s*\w*\s*\(/);
    expect(html).not.toMatch(/=>\s*\{/);
  });

  /*
   * CLAUDE.md's hardest copy rule: never describe this product as open source
   * or source-available. Both are false and both would be the kind of claim
   * that costs exactly the trust §7 exists to build.
   */
  it('never claims to be open source anywhere on the site', async () => {
    for (const path of ['/', '/pricing', '/why', '/trust', '/terms']) {
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
  it.each(['/', '/pricing', '/why', '/trust', '/terms'])('emits unescaped CSS on %s', async (path) => {
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

/*
 * The acceptable-use page is the one an adversary reads before deciding whether
 * a complaint is worth filing. These assert the parts that make it answerable
 * rather than decorative.
 */
describe('/terms', () => {
  it('publishes the protections, not only the prohibitions', async () => {
    const html = await (await get('/terms', fakeEnv())).text();
    expect(html).toContain('What we will not remove you for');
    for (const phrase of ['civil disobedience', 'Bail funds', 'Mutual aid', 'Strikes']) {
      expect(html.toLowerCase()).toContain(phrase.toLowerCase());
    }
  });

  it('says plainly that sealed content is unreadable to us', async () => {
    const html = await (await get('/terms', fakeEnv())).text();
    expect(html).toContain('do not read your channel messages');
    expect(html).not.toMatch(/we (scan|monitor) (your )?(content|messages)/i);
  });

  it('states the two-person requirement for removing an organisation', async () => {
    const html = await (await get('/terms', fakeEnv())).text();
    expect(html).toContain('two people');
  });

  it('is reachable from every page footer', async () => {
    for (const path of ['/', '/pricing', '/why', '/trust', '/terms']) {
      const html = await (await get(path, fakeEnv())).text();
      expect(html).toContain('href="/terms"');
    }
  });
});

describe('the photography actually reaches a page', () => {
  /*
   * Nine frames were generated, uploaded to R2, and served correctly — and only
   * four of them appeared anywhere on the site. Everything downstream was
   * working, so nothing failed and nothing warned; the images simply were not
   * referenced. Generating a photograph nobody sees is the most expensive kind
   * of dead code in this repo.
   */
  it('renders every image in the shot list somewhere', async () => {
    const pages = ['/', '/pricing', '/why', '/trust', '/terms'];
    const html = (await Promise.all(pages.map(async (p) => (await get(p, fakeEnv())).text()))).join(
      '\n',
    );

    const missing = IMAGES.filter((spec) => !html.includes(`/media/${spec.id}-`)).map((s) => s.id);
    expect(missing).toEqual([]);
  });

  it('gives every rendered image its alt text', async () => {
    const html = await (await get('/', fakeEnv())).text();
    for (const spec of IMAGES) {
      if (!html.includes(`/media/${spec.id}-`)) continue;
      expect(html).toContain(spec.alt);
    }
  });
});

describe('the stylesheet', () => {
  /*
   * Every custom property that gets used has to be one that exists.
   *
   * `--warn` was referenced in two places and defined in none. CSS does not
   * complain about that; it does something quieter and worse. `color:
   * var(--warn)` falls back to inherited body ink, so the headings for conduct
   * that gets an organisation removed rendered in the same colour as everything
   * around them. And `border-top: 2px solid var(--warn)` is invalid at computed
   * value time, which throws away the entire shorthand — the rule computed to
   * `0px none` and was simply not drawn.
   *
   * Both are invisible failures. Nothing errors, nothing warns, the markup is
   * correct, and the emphasis a reader was supposed to get is just absent. A
   * typo in a token name would do exactly the same thing, which is why this
   * checks the whole set rather than the one that was wrong.
   */
  it('defines every custom property it uses', async () => {
    const html = await (await get('/', fakeEnv())).text();
    const style = /<style[^>]*>([\s\S]*?)<\/style>/.exec(html)?.[1] ?? '';
    expect(style.length).toBeGreaterThan(1000);

    const defined = new Set([...style.matchAll(/(--[a-z0-9-]+)\s*:/gi)].map((m) => m[1]));
    // A var() with a fallback — var(--x, #fff) — degrades gracefully by design.
    const used = [...style.matchAll(/var\(\s*(--[a-z0-9-]+)\s*\)/gi)].map((m) => m[1]);

    expect([...new Set(used.filter((name) => !defined.has(name)))]).toEqual([]);
  });

  /*
   * The near miss version of the same bug.
   *
   * The check above scans the whole sheet, so a token defined only inside the
   * dark-scheme block counts as defined — and it is, for half the readers. The
   * other half get the silent fallback, on a page nobody tests in light mode
   * because their own machine is dark. Every colour the dark block overrides
   * must have a light value to override.
   */
  it('gives every dark-scheme colour a light one to override', async () => {
    const html = await (await get('/', fakeEnv())).text();
    const style = /<style[^>]*>([\s\S]*?)<\/style>/.exec(html)?.[1] ?? '';

    const dark = /prefers-color-scheme:\s*dark\s*\)\s*\{([\s\S]*?)\n\s*\}/.exec(style)?.[1] ?? '';
    expect(dark, 'no dark-scheme block found').toContain('--fg');

    const light = style.slice(0, style.indexOf('@media')).match(/(--[a-z0-9-]+)\s*:/gi) ?? [];
    const lightNames = new Set(light.map((d) => d.replace(/\s*:$/, '')));

    const orphans = [...dark.matchAll(/(--[a-z0-9-]+)\s*:/gi)]
      .map((m) => m[1]!)
      .filter((name) => !lightNames.has(name));
    expect(orphans).toEqual([]);
  });

  /*
   * The same check over the inline style attributes in the markup, which is
   * where the original --warn reference lived. It is a separate assertion
   * because the two are separate places to make the mistake, and the acceptable
   * use page was the one that had it.
   */
  it('defines every custom property the markup reaches for', async () => {
    // Every page, and each one asserted to have actually rendered. The first
    // version of this list carried '/acceptable-use', which does not exist —
    // that content is under /terms. A 404 body has no var() in it, so the entry
    // passed while testing nothing, which is the failure mode a list of route
    // strings has.
    const pages = ['/', '/pricing', '/why', '/trust', '/terms', '/security', '/demo'];
    const responses = await Promise.all(pages.map((p) => get(p, fakeEnv())));
    for (const [i, res] of responses.entries()) expect(res.status, pages[i]).toBe(200);
    const htmls = await Promise.all(responses.map((r) => r.text()));

    const style = /<style[^>]*>([\s\S]*?)<\/style>/.exec(htmls[0]!)?.[1] ?? '';
    const defined = new Set([...style.matchAll(/(--[a-z0-9-]+)\s*:/gi)].map((m) => m[1]));

    const missing = new Set<string>();
    for (const [i, html] of htmls.entries()) {
      const body = html.replace(/<style[^>]*>[\s\S]*?<\/style>/, '');
      for (const m of body.matchAll(/var\(\s*(--[a-z0-9-]+)\s*\)/gi)) {
        if (!defined.has(m[1]!)) missing.add(`${pages[i]}: ${m[1]}`);
      }
    }
    expect([...missing]).toEqual([]);
  });
});

describe('/security', () => {
  /*
   * The whole security surface used to be a footer link to security.txt — a
   * file that tells a researcher where to send a report and tells a prospective
   * customer nothing at all.
   */
  it('is reachable from the nav on every page, not just the footer', async () => {
    for (const path of ['/', '/pricing', '/why', '/trust']) {
      const html = await (await get(path, fakeEnv())).text();
      expect(html).toContain('href="/security"');
    }
  });

  /*
   * The check line used to say "How you would check:" and then describe our
   * internals — an iteration count, which privilege the isolation rests on not
   * having. That is not something a reader can check, it is an assertion in the
   * costume of proof, and it published a map besides. security.test.ts governs
   * the wording; this only asserts every control still reaches the page with
   * its check attached, since a claim rendered without one is the regression
   * that matters here.
   */
  it('gives every control a way to check it, not just a claim', async () => {
    const html = await (await get('/security', fakeEnv())).text();
    for (const ctl of CONTROLS) {
      expect(html).toContain(ctl.title);
      expect(html, ctl.id).toContain(ctl.check);
    }
    expect(html).toContain('Check it yourself');
  });

  /*
   * The half that makes the rest credible. A page listing only strengths is
   * marketing; a reader who finds a gap themselves stops believing everything
   * above it.
   */
  it('says what we do not have, including the awkward ones', async () => {
    const html = await (await get('/security', fakeEnv())).text();
    for (const gap of ABSENT) expect(html).toContain(gap.title);
    expect(html).toMatch(/no independent penetration test/i);
    expect(html).toMatch(/closed source/i);
  });

  /*
   * The SOC 2 line is the one most likely to drift, because there is now
   * something real to point at and pointing at it is flattering.
   *
   * We did run a review against the criteria, control by control, and it found
   * things that are now fixed. It is a self-assessment. Nobody independent
   * signed it, and the distance between those two is the entire difference
   * between a claim and a certification — which is exactly the distance a
   * security page is tempted to close with a well-chosen verb.
   *
   * So both halves are asserted: that the work is admitted, and that its limit
   * is admitted in the same breath.
   */
  it('says the SOC 2 work happened and that it was our own', async () => {
    const html = await (await get('/security', fakeEnv())).text();
    expect(html).toMatch(/SOC 2 criteria ourselves/i);
    expect(html).toMatch(/nobody independent has signed/i);
    expect(html).toMatch(/no badge/i);
    // The exact phrasings that would turn a self-assessment into a credential.
    expect(html).not.toMatch(/\b(SOC ?2 (certified|compliant|audited)|we are SOC ?2)\b/i);
  });

  it('does not claim an audit it has not had', async () => {
    const html = await (await get('/security', fakeEnv())).text();
    expect(html).not.toMatch(/\b(SOC ?2 (certified|compliant)|ISO ?27001|pen[- ]?tested)\b/i);
  });

  it('promises not to threaten a researcher', async () => {
    const html = await (await get('/security', fakeEnv())).text();
    expect(html).toMatch(/will not threaten a researcher/i);
  });
});

describe('/demo', () => {
  it('publishes the credentials it actually seeds', async () => {
    const html = await (await get('/demo', fakeEnv())).text();
    expect(html).toContain(DEMO_EMAIL);
    expect(html).toContain(DEMO_PASSWORD);
  });

  /*
   * The demo used to sign in as an observer, which sees no contact records at
   * all, and the page had to spend a paragraph explaining that the empty list
   * was the access control working. It is an organizer now — the role most
   * people evaluating this would hold — so the page's job changed: say what
   * this account can do, and name the two things it deliberately cannot reach
   * so nobody reads a boundary as a missing feature.
   */
  it('names the role the demo actually signs in as', async () => {
    const html = await (await get('/demo', fakeEnv())).text();
    expect(html).toMatch(/organizer/i);
    expect(html).not.toMatch(/signs in as an observer/i);
  });

  it('says which screens the demo account cannot reach, and why', async () => {
    const html = await (await get('/demo', fakeEnv())).text();
    expect(html).toMatch(/legal role/i);
    expect(html).toMatch(/Turf and role scoping happen in the database/i);
  });

  it('says plainly that everyone in it is invented', async () => {
    const html = await (await get('/demo', fakeEnv())).text();
    expect(html).toMatch(/do not exist|fictional/i);
  });

  /*
   * The demo cannot show sealed content, and the reason is the strongest thing
   * about the product. Saying "coming soon" here would waste it.
   */
  it('explains why there are no messages rather than hiding it', async () => {
    const html = await (await get('/demo', fakeEnv())).text();
    expect(html).toMatch(/encrypted in your browser/i);
    expect(html).not.toMatch(/coming soon/i);
  });

  it('is reachable from the front page', async () => {
    const html = await (await get('/', fakeEnv())).text();
    expect(html).toContain('href="/demo"');
  });
});
