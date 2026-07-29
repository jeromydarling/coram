/** @jsxImportSource hono/jsx */
/**
 * Public event pages at /e/<slug> (§5.3).
 *
 * Server-rendered, no session, no JavaScript. Someone finding this link has no
 * account and may be on a borrowed phone on a bad connection, so the page is a
 * plain document and the form is a plain form post.
 *
 * §10 applies here as much as anywhere: no external JS, no fonts from a CDN,
 * no analytics. A page advertising a protest must not phone a third party to
 * tell them who is reading it.
 *
 * What this page never shows: who else is coming. A public attendee list is a
 * roster of who will be at an action, and publishing one would undo everything
 * the rest of this codebase is for. The page shows a count and stops.
 */

import { Hono } from 'hono';

import type { Env, Vars } from '../env';
import { mintOneTimeToken } from '../lib/crypto';
import { clientIp, consume } from '../lib/ratelimit';
import {withoutTenant} from '../lib/rls';
import { db } from '../lib/db';

import { contactHashes } from '../lib/suppression';
import { publicRsvpSchema } from '../../shared/schemas/events';

export const publicEvents = new Hono<{ Bindings: Env; Variables: Vars }>();

/** Public RSVP is unauthenticated and writes rows, so it gets its own limit. */
const RSVP_LIMIT = { limit: 10, windowSeconds: 60 * 60 };

interface EventRow {
  id: string;
  title: string;
  description: string | null;
  starts_at: string;
  ends_at: string | null;
  location_name: string | null;
  location_address: string | null;
  capacity: number | null;
  spots_taken: string;
  access_transit: boolean | null;
  access_step_free: boolean | null;
  access_asl: boolean | null;
  access_quiet_space: boolean | null;
  access_notes: string | null;
  cancelled: boolean;
}

// ---------------------------------------------------------------------------

function Page(props: { title: string; children?: unknown }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{props.title}</title>
        <style>{`
          :root { color-scheme: light dark; --fg: #1c1a17; --bg: #fbfaf7; --muted: #6b6560;
                  --line: #e2ddd6; --accent: #c9821f; }
          @media (prefers-color-scheme: dark) {
            :root { --fg: #ece7df; --bg: #191715; --muted: #9b938a; --line: #333029; }
          }
          * { box-sizing: border-box; }
          body { margin: 0; background: var(--bg); color: var(--fg); padding: 2rem 1.25rem 4rem;
                 font: 16px/1.65 ui-sans-serif, system-ui, -apple-system, sans-serif; }
          main { max-width: 34rem; margin: 0 auto; }
          h1 { font-size: 1.6rem; line-height: 1.25; margin: 0 0 .5rem; }
          h2 { font-size: .8rem; text-transform: uppercase; letter-spacing: .07em;
               color: var(--muted); margin: 2rem 0 .5rem; font-weight: 600; }
          .when { font-size: 1.05rem; margin: 0 0 1.5rem; }
          .muted { color: var(--muted); }
          ul { list-style: none; padding: 0; margin: 0; }
          li { padding: .3rem 0; }
          label { display: block; margin: .9rem 0 .25rem; font-weight: 500; }
          input, textarea { width: 100%; padding: .6rem .7rem; font: inherit; color: inherit;
                            background: transparent; border: 1px solid var(--line); border-radius: 6px; }
          textarea { min-height: 4.5rem; }
          button { margin-top: 1.5rem; padding: .7rem 1.4rem; font: inherit; font-weight: 600;
                   background: var(--fg); color: var(--bg); border: 0; border-radius: 6px;
                   cursor: pointer; }
          .row { display: flex; gap: .5rem; align-items: baseline; }
          .row input { width: 5rem; }
          .notice { border-left: 3px solid var(--accent); padding: .6rem 0 .6rem .9rem;
                    margin: 1.5rem 0; }
          .fine { font-size: .85rem; color: var(--muted); margin-top: 2rem; }
          hr { border: 0; border-top: 1px solid var(--line); margin: 2rem 0; }
        `}</style>
      </head>
      <body>
        <main>{props.children}</main>
      </body>
    </html>
  );
}

/** Three states, three renderings. "Not stated" must not read as "no". */
function Access(props: { label: string; value: boolean | null }) {
  if (props.value === null) {
    return (
      <li class="muted">
        {props.label}: not stated
      </li>
    );
  }
  return (
    <li>
      {props.label}: {props.value ? 'yes' : 'no'}
    </li>
  );
}

function formatWhen(startsAt: string, endsAt: string | null): string {
  const start = new Date(startsAt);
  const date = start.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
  const time = start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const until = endsAt
    ? ` – ${new Date(endsAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
    : '';
  return `${date}, ${time}${until}`;
}

// ---------------------------------------------------------------------------
// GET /e/:slug
// ---------------------------------------------------------------------------

publicEvents.get('/e/:slug', async (c) => {
  const sql = db(c);

  const [event] = (await withoutTenant(
    sql,
    (tx) => tx`SELECT * FROM coram.public_event(${c.req.param('slug')})`,
  )) as unknown as EventRow[];

  if (!event) {
    return c.html(
      <Page title="Not found">
        <h1>No such event</h1>
        <p class="muted">This link may have expired, or the event may have been taken down.</p>
      </Page>,
      404,
    );
  }

  const taken = Number(event.spots_taken);
  const full = event.capacity !== null && taken >= event.capacity;
  const posted = c.req.query('rsvp');

  return c.html(
    <Page title={event.title}>
      <h1>{event.title}</h1>
      <p class="when">{formatWhen(event.starts_at, event.ends_at)}</p>

      {event.cancelled && (
        <div class="notice">
          <strong>This event was cancelled.</strong>
        </div>
      )}

      {posted === 'going' && (
        <div class="notice">
          <strong>You have a place.</strong> Nothing else to do — just come.
        </div>
      )}
      {posted === 'waitlist' && (
        <div class="notice">
          <strong>You are on the waitlist.</strong> We will be in touch if a place opens.
        </div>
      )}

      {event.location_name && (
        <>
          <h2>Where</h2>
          <p>
            {event.location_name}
            {event.location_address && (
              <>
                <br />
                <span class="muted">{event.location_address}</span>
              </>
            )}
          </p>
        </>
      )}

      {event.description && (
        <>
          <h2>What</h2>
          <p>{event.description}</p>
        </>
      )}

      <h2>Getting in</h2>
      <ul>
        <Access label="Reachable by transit" value={event.access_transit} />
        <Access label="Step-free access" value={event.access_step_free} />
        <Access label="ASL interpretation" value={event.access_asl} />
        <Access label="Quiet space available" value={event.access_quiet_space} />
      </ul>
      {event.access_notes && <p class="muted">{event.access_notes}</p>}

      {event.capacity !== null && (
        <p class="muted" style="margin-top:1.5rem">
          {taken} of {event.capacity} places taken.
        </p>
      )}

      {!event.cancelled && (
        <>
          <hr />
          <h2>{full ? 'Join the waitlist' : 'Come along'}</h2>

          {/* A plain form post. No JavaScript, so this works on any phone. */}
          <form method="post" action={`/e/${c.req.param('slug')}/rsvp`}>
            <label for="displayName">Your name</label>
            <input id="displayName" name="displayName" autocomplete="name" />

            <label for="email">Email</label>
            <input id="email" name="email" type="email" autocomplete="email" />

            <label for="phone">Phone (if you would rather)</label>
            <input id="phone" name="phone" type="tel" autocomplete="tel" />

            <label for="postalCode">Postcode</label>
            <input id="postalCode" name="postalCode" autocomplete="postal-code" />

            <div class="row">
              <label for="guestCount" style="margin:.9rem 0 .25rem">
                Bringing anyone?
              </label>
              <input id="guestCount" name="guestCount" type="number" min="0" max="20" value="0" />
            </div>

            <div class="row">
              <label for="childcareChildren" style="margin:.9rem 0 .25rem">
                Children needing childcare
              </label>
              <input
                id="childcareChildren"
                name="childcareChildren"
                type="number"
                min="0"
                max="20"
                value="0"
              />
            </div>

            <label>
              <input type="checkbox" name="needsRide" value="1" style="width:auto" /> I need a lift
            </label>

            <label for="accessNeeds">Anything you need to be there?</label>
            <textarea id="accessNeeds" name="accessNeeds" />

            <button type="submit">{full ? 'Join the waitlist' : 'Count me in'}</button>
          </form>

          <p class="fine">
            We keep your name and how to reach you, so we can tell you if this changes. We do not
            keep your location, and we do not share any of it. Anything you write above is visible
            to the organizers.
          </p>
        </>
      )}
    </Page>,
  );
});

// ---------------------------------------------------------------------------
// POST /e/:slug/rsvp
// ---------------------------------------------------------------------------

publicEvents.post('/e/:slug/rsvp', async (c) => {
  const slug = c.req.param('slug');

  const rate = await consume(c.env, 'public-rsvp', clientIp(c.req.raw), RSVP_LIMIT);
  if (!rate.allowed) {
    return c.html(
      <Page title="Too many">
        <h1>Too many sign-ups from here</h1>
        <p class="muted">Try again a little later.</p>
      </Page>,
      429,
    );
  }

  const form = await c.req.parseBody();
  const parsed = publicRsvpSchema.safeParse({
    displayName: str(form.displayName),
    email: str(form.email),
    phone: str(form.phone),
    postalCode: str(form.postalCode),
    guestCount: num(form.guestCount),
    needsRide: form.needsRide === '1',
    childcareChildren: num(form.childcareChildren),
    accessNeeds: str(form.accessNeeds),
  });

  if (!parsed.success) {
    return c.html(
      <Page title="Check that again">
        <h1>Almost</h1>
        <p>{parsed.error.issues[0].message}</p>
        <p>
          <a href={`/e/${slug}`}>Back to the event</a>
        </p>
      </Page>,
      400,
    );
  }
  const input = parsed.data;

  // The QR token for the door. Only its hash is stored.
  const { hash } = await mintOneTimeToken();

  // The opt-out ledger's keys. Computed here because the pepper is a Worker
  // secret and public_rsvp — being SQL — cannot derive them. Passing them in
  // is what lets that function refuse to re-acquire a contact on someone who
  // has opted out, and what gives any new contact row a working hash.
  const { emailHash, phoneHash } = await contactHashes(c.env, input);

  const sql = db(c);

  try {
    const [result] = await withoutTenant(
      sql,
      (tx) => tx`
        SELECT * FROM coram.public_rsvp(
          ${slug}, ${input.displayName ?? null}, ${input.email ?? null},
          ${input.phone ?? null}, ${input.postalCode ?? null},
          ${input.guestCount}, ${input.needsRide}, ${input.childcareChildren},
          ${input.accessNeeds ?? null}, ${hash},
          ${emailHash}, ${phoneHash}
        )
      `,
    );

    // Redirect after post, so a refresh does not sign someone up twice.
    return c.redirect(`/e/${slug}?rsvp=${result.status}`, 303);
  } catch {
    return c.html(
      <Page title="Something went wrong">
        <h1>That did not go through</h1>
        <p class="muted">Nothing was saved. Try again, or get in touch with the organizers.</p>
        <p>
          <a href={`/e/${slug}`}>Back to the event</a>
        </p>
      </Page>,
      500,
    );
  }
});

function str(value: unknown): string | undefined {
  const text = typeof value === 'string' ? value.trim() : '';
  return text === '' ? undefined : text;
}

function num(value: unknown): number {
  const parsed = Number(typeof value === 'string' ? value : 0);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
}
