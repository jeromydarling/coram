/** @jsxImportSource hono/jsx */
/**
 * /u/:token — unsubscribing (§5.4).
 *
 * One click, no account, no "are you sure you want to miss out", no preference
 * centre with eleven checkboxes pre-ticked. Someone arriving here has already
 * decided.
 *
 * §5.4: "one unsubscribe stops everything, forever, tenant-wide." So this
 * writes an `all`-channel suppression rather than only the channel the link
 * arrived on. Honouring it for email alone and then texting them would be the
 * same loophole wearing a different hat.
 */

import { Hono } from 'hono';

import type { Env, Vars } from '../env';
import { sha256Hex } from '../lib/crypto';
import { clientIp, consume } from '../lib/ratelimit';
import {withoutTenant} from '../lib/rls';
import { db } from '../lib/db';


export const publicUnsubscribe = new Hono<{ Bindings: Env; Variables: Vars }>();

const UNSUB_LIMIT = { limit: 30, windowSeconds: 60 * 60 };

function Page(props: { title: string; children?: unknown }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{props.title}</title>
        {/* Email clients prefetch links. noindex keeps this out of search results. */}
        <meta name="robots" content="noindex, nofollow" />
        <style>{`
          :root { color-scheme: light dark; }
          body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 2rem;
                 font: 16px/1.65 ui-sans-serif, system-ui, -apple-system, sans-serif; }
          main { max-width: 30rem; }
          h1 { font-size: 1.35rem; margin: 0 0 .75rem; }
          p { margin: 0 0 .75rem; }
          .muted { opacity: .7; }
          button { margin-top: 1.25rem; padding: .7rem 1.4rem; font: inherit; font-weight: 600;
                   cursor: pointer; border: 1px solid currentColor; border-radius: 6px;
                   background: transparent; color: inherit; }
        `}</style>
      </head>
      <body>
        <main>{props.children}</main>
      </body>
    </html>
  );
}

/**
 * GET shows a confirm button rather than unsubscribing outright.
 *
 * Not a dark pattern — the opposite. Mail clients and security scanners fetch
 * every link in a message, and a GET that unsubscribed on sight would opt
 * people out of things they never asked to leave. The POST below is the act.
 */
publicUnsubscribe.get('/u/:token', (c) =>
  c.html(
    <Page title="Unsubscribe">
      <h1>Stop hearing from this group?</h1>
      <p>
        This stops email, texts and calls from them. Not just this list — everything, from now
        on.
      </p>
      <p class="muted">You can always sign up again later if you change your mind.</p>
      <form method="post" action={`/u/${c.req.param('token')}`}>
        <button type="submit">Unsubscribe me</button>
      </form>
    </Page>,
  ),
);

publicUnsubscribe.post('/u/:token', async (c) => {
  const rate = await consume(c.env, 'unsubscribe', clientIp(c.req.raw), UNSUB_LIMIT);
  if (!rate.allowed) {
    return c.html(
      <Page title="Try again shortly">
        <h1>Too many requests from here</h1>
        <p class="muted">Try again in a little while.</p>
      </Page>,
      429,
    );
  }

  const sql = db(c);

  const tokenHash = await sha256Hex(c.req.param('token'));

  const [result] = await withoutTenant(
    sql,
    (tx) => tx`SELECT coram.unsubscribe_by_token(${tokenHash}, 'email') AS done`,
  );

  // Same page whether the token was live or already spent. People click twice,
  // and telling someone "that link is invalid" after they have just
  // unsubscribed reads as though it did not work.
  void result;

  return c.html(
    <Page title="Done">
      <h1>Done. You will not hear from them again.</h1>
      <p class="muted">
        We have recorded this without keeping your address — it is stored as a one-way hash, so
        the record survives even if the rest of your details are deleted.
      </p>
    </Page>,
  );
});
