/** @jsxImportSource hono/jsx */
/**
 * Public routes.
 *
 * §9 is explicit that the marketing site is step 8, after modules 1–3 ship:
 * "The site describes a product that exists." So this file deliberately does
 * not contain marketing copy yet. It holds the routing shape from §1.1 and a
 * plain holding page, and it will be replaced wholesale when there is a
 * product to describe.
 *
 * Server-rendered with Hono JSX. No second build target, no Astro (§1.2).
 */

import { Hono } from 'hono';

import type { Env, Vars } from '../env';
import { canaryStatus } from '../cron/canary';

export const marketing = new Hono<{ Bindings: Env; Variables: Vars }>();

function Holding(props: { children?: unknown }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Coram</title>
        {/* No external stylesheet, no external font, no CDN (§10). */}
        <style>{`
          :root { color-scheme: light dark; }
          body {
            margin: 0; min-height: 100vh; display: grid; place-items: center;
            font: 16px/1.6 ui-sans-serif, system-ui, -apple-system, sans-serif;
            padding: 2rem;
          }
          main { max-width: 34rem; }
          h1 { font-size: 1.25rem; font-weight: 600; margin: 0 0 .75rem; }
          p { margin: 0 0 .75rem; opacity: .8; }
          a { color: inherit; }
        `}</style>
      </head>
      <body>
        <main>{props.children}</main>
      </body>
    </html>
  );
}

marketing.get('/', (c) =>
  c.html(
    <Holding>
      <h1>Coram</h1>
      <p>The operating system for grassroots organizing.</p>
      <p>Not open yet.</p>
    </Holding>,
  ),
);

/**
 * §7: the trust page shows a live date for each artifact and must visibly flag
 * its own staleness. Only the canary has a real source today; the audit,
 * transparency report and export docs land with step 8.
 */
marketing.get('/trust', async (c) => {
  const canary = await canaryStatus(c.env);

  return c.html(
    <Holding>
      <h1>Trust</h1>
      <p>
        Warrant canary:{' '}
        {canary.state === 'never_signed'
          ? 'not yet published.'
          : canary.state === 'overdue'
            ? `This canary is overdue. Last signed ${canary.lastSignedAt}, ${canary.ageDays} days ago.`
            : `last signed ${canary.lastSignedAt}, ${canary.ageDays} days ago.`}
      </p>
      <p>
        <a href="/canary.txt">/canary.txt</a>
      </p>
    </Holding>,
  );
});

/**
 * The canary itself, as text/plain (§7).
 *
 * Held in KV rather than in the bundle so publishing a newly signed canary does
 * not require a deploy. Nothing in this codebase generates or signs it; the
 * value is put there by hand, which is the point.
 */
marketing.get('/canary.txt', async (c) => {
  const document = await c.env.KV_FLAGS.get('canary:document');

  return c.text(document ?? 'No canary has been published yet.\n', document ? 200 : 404, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': 'public, max-age=300',
  });
});

marketing.get('/.well-known/security.txt', (c) =>
  c.text(
    [
      'Contact: mailto:security@coram.app',
      'Preferred-Languages: en',
      `Encryption: https://coram.app/.well-known/coram-pgp.asc`,
      'Policy: https://coram.app/trust',
      '',
    ].join('\n'),
    200,
    { 'Content-Type': 'text/plain; charset=utf-8' },
  ),
);
