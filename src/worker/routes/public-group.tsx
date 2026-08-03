/** @jsxImportSource hono/jsx */
/**
 * The page a group chooses to have, at /g/<slug>.
 *
 * Sibling of public-events.tsx and built to the same rules, because it is
 * served to the same person: somebody who found a link, has no account, and may
 * be on a borrowed phone. Server-rendered, no JavaScript at all, no external
 * font, no analytics. §10 is not negotiable on a page that tells a stranger a
 * political group exists — a page advertising a tenants' union must not phone a
 * third party to say who is reading it.
 *
 * ---------------------------------------------------------------------------
 * A 404 that says nothing
 * ---------------------------------------------------------------------------
 *
 * A workspace that has not published looks exactly like a slug nobody has
 * taken, because `coram.public_group` returns no row in both cases and this
 * file renders one wording for both. Somebody walking a list of likely names —
 * eastside-tenants, eastside-tenants-union, eastsidetenants — learns whether a
 * page is published and nothing whatsoever about who exists and has chosen not
 * to publish. That distinction is the entire security property of the page.
 *
 * ---------------------------------------------------------------------------
 * What is on it
 * ---------------------------------------------------------------------------
 *
 * Four pieces of text a steward wrote, and the events that were already public
 * in their own right. No member is nameable, no count of members, no photos of
 * anybody. The group's own words are the only content, which is also why they
 * are rendered as text rather than markup: there is no reason to accept HTML
 * here and every reason not to.
 */

import { Hono } from 'hono';

import type { Env, Vars } from '../env';
import { db } from '../lib/db';
import { withoutTenant } from '../lib/rls';

export const publicGroup = new Hono<{ Bindings: Env; Variables: Vars }>();

interface GroupRow {
  tenant_id: string;
  name: string;
  tagline: string | null;
  about: string | null;
  contact: string | null;
  get_involved: string | null;
}

interface EventRow {
  title: string;
  starts_at: string;
  ends_at: string | null;
  location_name: string | null;
  public_slug: string;
  spots_taken: string;
  capacity: number | null;
}

function Page(props: { title: string; children?: unknown }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{props.title}</title>
        {/*
          No index directive either way. A group that publishes a page has
          decided it may be read; whether a search engine lists it is their
          business and not something to decide on their behalf in either
          direction, so nothing here says robots anything.
        */}
        <style>{`
          :root { color-scheme: light dark; --fg: #1c1a17; --bg: #fbfaf7; --muted: #6b6560;
                  --line: #e2ddd6; --accent: #c9821f; }
          @media (prefers-color-scheme: dark) {
            :root { --fg: #ece7df; --bg: #191715; --muted: #9b938a; --line: #333029; }
          }
          * { box-sizing: border-box; }
          body { margin: 0; background: var(--bg); color: var(--fg); padding: 2.5rem 1.25rem 4rem;
                 font: 16px/1.65 ui-sans-serif, system-ui, -apple-system, sans-serif; }
          main { max-width: 34rem; margin: 0 auto; }
          h1 { font-size: 1.9rem; line-height: 1.2; margin: 0 0 .4rem; }
          h2 { font-size: .8rem; text-transform: uppercase; letter-spacing: .07em;
               color: var(--muted); margin: 2.5rem 0 .6rem; font-weight: 600; }
          .tagline { font-size: 1.1rem; margin: 0 0 2rem; color: var(--muted); }
          .about p { margin: 0 0 1rem; }
          ul { list-style: none; padding: 0; margin: 0; }
          .event { border-top: 1px solid var(--line); padding: .9rem 0; }
          .event:last-child { border-bottom: 1px solid var(--line); }
          .event a { color: inherit; font-weight: 600; text-decoration: none;
                     border-bottom: 2px solid var(--accent); }
          .event .when { display: block; color: var(--muted); font-size: .95rem; margin-top: .15rem; }
          .muted { color: var(--muted); }
          .fine { font-size: .85rem; color: var(--muted); margin-top: 3rem;
                  border-top: 1px solid var(--line); padding-top: 1rem; }
          .fine a { color: inherit; }
        `}</style>
      </head>
      <body>
        <main>{props.children}</main>
      </body>
    </html>
  );
}

function formatWhen(startsAt: string, endsAt: string | null): string {
  const start = new Date(startsAt);
  const date = start.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const time = start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const until = endsAt
    ? ` – ${new Date(endsAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
    : '';
  return `${date}, ${time}${until}`;
}

/**
 * Blank-line-separated text becomes paragraphs, and nothing else happens to it.
 *
 * Deliberately not a markdown renderer. The value of one here would be a few
 * bold words; the cost is a parser standing between a stranger's browser and
 * text stored in a database, on the one route in the product that is served
 * without a session. JSX escapes every string it renders, so this stays text.
 */
function paragraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .slice(0, 12);
}

publicGroup.get('/g/:slug', async (c) => {
  const slug = c.req.param('slug');
  const sql = db(c);

  const [group] = (await withoutTenant(
    sql,
    (tx) => tx`SELECT * FROM coram.public_group(${slug})`,
  )) as unknown as GroupRow[];

  /*
   * One wording for two states. See the header: an unpublished workspace and a
   * name nobody took must be indistinguishable from out here, so this must not
   * grow a branch that says "this group has not published a page".
   */
  if (!group) {
    return c.html(
      <Page title="Not found">
        <h1>Nothing here</h1>
        <p class="muted">There is no page at this address.</p>
      </Page>,
      404,
    );
  }

  const events = (await withoutTenant(
    sql,
    (tx) => tx`SELECT * FROM coram.public_group_events(${slug})`,
  )) as unknown as EventRow[];

  return c.html(
    <Page title={group.name}>
      <h1>{group.name}</h1>
      {group.tagline && <p class="tagline">{group.tagline}</p>}

      {group.about && (
        <div class="about">
          {paragraphs(group.about).map((p) => (
            <p>{p}</p>
          ))}
        </div>
      )}

      <h2>What is coming up</h2>
      {events.length === 0 ? (
        <p class="muted">
          Nothing is scheduled publicly at the moment. That does not mean nothing is happening —
          ask.
        </p>
      ) : (
        <ul>
          {events.map((event) => {
            const taken = Number(event.spots_taken);
            const full = event.capacity !== null && taken >= event.capacity;
            return (
              <li class="event">
                <a href={`/e/${event.public_slug}`}>{event.title}</a>
                <span class="when">
                  {formatWhen(event.starts_at, event.ends_at)}
                  {event.location_name ? ` · ${event.location_name}` : ''}
                  {/*
                    A count, never the people — the same rule the event page
                    keeps. "Full" rather than a number when it is full, because
                    the useful fact at that point is that turning up needs a
                    conversation first.
                  */}
                  {full ? ' · full, ask about the waitlist' : taken > 0 ? ` · ${taken} going` : ''}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {group.get_involved && (
        <>
          <h2>Getting involved</h2>
          {paragraphs(group.get_involved).map((p) => (
            <p>{p}</p>
          ))}
        </>
      )}

      {group.contact && (
        <>
          <h2>Reaching us</h2>
          <p>{group.contact}</p>
        </>
      )}

      <p class="fine">
        This page is published by {group.name} and shows only what they chose to publish. It sets
        no cookies, loads nothing from anywhere else, and there is no analytics on it — nobody is
        told that you read it.
      </p>
    </Page>,
  );
});
