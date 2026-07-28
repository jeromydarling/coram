/** @jsxImportSource hono/jsx */
/**
 * Public routes (§1.1, §8) — the marketing site and /trust.
 *
 * Server-rendered Hono JSX. No second build target, no Astro (§1.2). No
 * external JS, no CDN fonts, no analytics beyond what Cloudflare provides at
 * the edge (§10).
 *
 * What is here and what is not, deliberately:
 *
 *   Here — the routing shape, /trust with live artifact dates and automatic
 *   staleness flagging, pricing, the four commitments, and the comparison
 *   table. These are structural or factual about us.
 *
 *   Not here — the §8.2 imagery, the scroll-driven sequences, and the
 *   §8.4 motion work. Those need a designer and photographs, and shipping
 *   placeholder versions would make the page worse than a plain one.
 *
 * §9 says "Ship 1–3 before writing any marketing copy. The site describes a
 * product that exists." Modules 1–7 exist in code but have never run against a
 * live database, so the copy below describes capabilities rather than results,
 * and /trust states plainly that no artifact has been published. Reading it
 * back before launch, with a working deploy, is a required step rather than a
 * nice-to-have.
 */

import { Hono } from 'hono';

import type { Env, Vars } from '../env';
import { anyOverdue, describe, loadArtifacts, staleness } from '../lib/trust';

export const marketing = new Hono<{ Bindings: Env; Variables: Vars }>();

// ---------------------------------------------------------------------------
// Shell
// ---------------------------------------------------------------------------

/*
 * Palette matches src/app/index.css: muted, desaturated, one warm accent used
 * sparingly (§8.2). Inline because §10 forbids external stylesheets and this is
 * small enough that a separate request would cost more than it saves.
 */
const STYLE = `
  :root {
    color-scheme: light dark;
    --fg: #1c1a17; --bg: #fbfaf7; --muted: #6b6560;
    --line: #e2ddd6; --accent: #c9821f; --warn: #b03a2e;
  }
  @media (prefers-color-scheme: dark) {
    :root { --fg: #ece7df; --bg: #191715; --muted: #9b938a; --line: #333029; }
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--fg);
         font: 17px/1.6 ui-sans-serif, system-ui, -apple-system, sans-serif; }
  main, header, footer { max-width: 46rem; margin: 0 auto; padding: 0 1.25rem; }
  header { padding-top: 2rem; padding-bottom: 1rem; }
  nav a { color: var(--muted); text-decoration: none; margin-right: 1.25rem; font-size: .95rem; }
  nav a:hover { color: var(--fg); }
  h1 { font-size: 2.1rem; line-height: 1.15; letter-spacing: -.02em; margin: 2.5rem 0 .75rem; }
  h2 { font-size: 1.3rem; margin: 3rem 0 .75rem; letter-spacing: -.01em; }
  h3 { font-size: 1rem; margin: 1.75rem 0 .35rem; }
  p { margin: 0 0 1rem; max-width: 34em; }
  .lead { font-size: 1.15rem; color: var(--muted); }
  .muted { color: var(--muted); }
  ul { padding-left: 1.1rem; }
  li { margin-bottom: .4rem; }
  table { border-collapse: collapse; width: 100%; font-size: .9rem; margin: 1rem 0; }
  th, td { text-align: left; padding: .5rem .6rem; border-bottom: 1px solid var(--line); }
  th { font-weight: 600; }
  /* §8.3: sticky first column on mobile. */
  .scroll { overflow-x: auto; }
  .scroll th:first-child, .scroll td:first-child {
    position: sticky; left: 0; background: var(--bg); }
  .card { border: 1px solid var(--line); border-radius: 8px; padding: 1rem 1.1rem; margin: .75rem 0; }
  .flag { border-left: 3px solid var(--warn); padding: .6rem 0 .6rem .9rem; margin: 1.5rem 0; }
  .highlight { border-left: 3px solid var(--accent); padding: .6rem 0 .6rem .9rem; }
  footer { border-top: 1px solid var(--line); margin-top: 4rem; padding-top: 1.5rem;
           padding-bottom: 4rem; font-size: .9rem; color: var(--muted); }
  footer a { color: var(--muted); }
  code { font-size: .9em; }
`;

function Page(props: { title: string; children?: unknown }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{props.title}</title>
        <style>{STYLE}</style>
      </head>
      <body>
        <header>
          <nav>
            <a href="/">Coram</a>
            <a href="/why">Why</a>
            <a href="/pricing">Pricing</a>
            <a href="/trust">Trust</a>
          </nav>
        </header>
        {props.children}
        <footer>
          <p>
            <a href="/canary.txt">Warrant canary</a> ·{' '}
            <a href="/.well-known/security.txt">security.txt</a> ·{' '}
            <a href="/trust">Trust</a>
          </p>
          <p>Coram is closed source. We publish audits instead of code.</p>
        </footer>
      </body>
    </html>
  );
}

// ---------------------------------------------------------------------------
// /
// ---------------------------------------------------------------------------

marketing.get('/', (c) =>
  c.html(
    <Page title="Coram — everything your movement runs on, one place">
      <main>
        <h1>Everything your movement runs on. One place.</h1>
        <p class="lead">
          Replaces your CRM, events tool, texting tool, donation page, spreadsheet, and group
          chat. One login, one shared record of who your people are.
        </p>

        <h2>The problem</h2>
        <p>
          A typical group runs six disconnected tools with no shared data layer. The person who
          came to Tuesday's meeting, gave twenty dollars, and replied to a text is three different
          records in three systems that have never met.
        </p>
        <p>
          The market is fragmented because organizers are poor, not because they prefer variety.
        </p>

        {/* §8.1 section 3 — the emotional centre. Four sentences, no icons, no
            headers on each, generous whitespace. No tradition named (§2). */}
        <h2>What we owe you</h2>
        <p>We do not surveil the people who use this.</p>
        <p>
          Data and decisions stay at the smallest competent level. A coalition does not
          automatically see a chapter's records.
        </p>
        <p>The free tier is not a funnel. It is the point.</p>
        <p>We take nothing from bail funds and mutual aid.</p>

        <h2>What it does</h2>
        <ul>
          <li>Supporter records, tags, segments, import and full export</li>
          <li>One-to-ones, ladders of engagement, turf, follow-up queues</li>
          <li>Events with RSVP, shifts, waitlists, and check-in</li>
          <li>Email, peer-to-peer texting, and a phone bank</li>
          <li>Petitions and legislator lookup</li>
          <li>Fundraising, dues, and escrowed mutual aid and bail funds</li>
          <li>Encrypted internal channels</li>
          <li>Proposals, quorum, and five ways to vote</li>
          <li>Legal observer intake and jail support</li>
          <li>Drafting help from a private model</li>
          <li>Coalitions, where a parent sees totals and nothing more</li>
        </ul>

        <h2>How it compares</h2>
        <div class="scroll">
          <ComparisonTable />
        </div>
        <p class="muted" style="font-size:.85rem">
          Compiled from publicly documented features. Competitors change what they offer; if
          something here is out of date, tell us and we will correct it.
        </p>

        <h2>What it costs</h2>
        <p>
          Free under 250 contacts, with all eleven modules. Not a trial, not feature-gated, no
          card required. <a href="/pricing">Full pricing</a>.
        </p>
      </main>
    </Page>,
  ),
);

/** §8.3, as specified. */
function ComparisonTable() {
  const rows: Array<[string, string, string, string, string, string]> = [
    ['Supporter CRM', 'Yes', 'Yes', 'Yes', 'Partial', 'No'],
    ['Relational organizing', 'Yes', 'Separate product', 'No', 'Partial', 'No'],
    ['Events and shifts', 'Yes', 'Yes', 'No', 'Yes', 'Yes'],
    ['P2P texting and dialer', 'Yes', 'Yes', 'Yes', 'Partial', 'No'],
    ['Petitions, legislator lookup', 'Yes', 'Yes', 'Yes', 'No', 'No'],
    ['Fundraising', 'Yes', 'Yes', 'No', 'No', 'No'],
    ['Encrypted internal comms', 'Yes', 'No', 'No', 'In-app chat only', 'No'],
    ['Governance and voting', 'Yes', 'No', 'No', 'No', 'No'],
    ['Legal and jail support', 'Yes', 'No', 'No', 'No', 'No'],
    ['Published audit + canary', 'Yes', 'No', 'No', 'No', 'No'],
    ['Free tier', 'Full product', 'No', 'No', 'No', 'Partial'],
  ];

  return (
    <table>
      <thead>
        <tr>
          <th />
          <th>Coram</th>
          <th>Action Network</th>
          <th>Quorum</th>
          <th>Reach</th>
          <th>Mobilize</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr>
            {row.map((cell, i) => (i === 0 ? <th scope="row">{cell}</th> : <td>{cell}</td>))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ---------------------------------------------------------------------------
// /pricing
// ---------------------------------------------------------------------------

marketing.get('/pricing', (c) =>
  c.html(
    <Page title="Pricing — Coram">
      <main>
        <h1>Pricing</h1>
        <p class="lead">
          Revenue comes from payment volume and coalitions, not seats. A volunteer group with a
          zero-dollar budget can run the entire product.
        </p>

        <table>
          <thead>
            <tr>
              <th>Tier</th>
              <th>Who</th>
              <th>Price</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">Parish</th>
              <td>Under 250 contacts, single group</td>
              <td>Free — all eleven modules</td>
            </tr>
            <tr>
              <th scope="row">Local</th>
              <td>Under 2,500 contacts</td>
              <td>$29/mo</td>
            </tr>
            <tr>
              <th scope="row">Coalition</th>
              <td>Multi-chapter</td>
              <td>$149/mo</td>
            </tr>
            <tr>
              <th scope="row">Union / Federation</th>
              <td>Unlimited chapters, SSO, DPA, custom retention</td>
              <td>From $500/mo</td>
            </tr>
          </tbody>
        </table>

        {/* §8.1 item 7: the bail-fund waiver gets its own highlighted row. */}
        <div class="highlight">
          <p style="margin:0">
            <strong>1% on fundraising and dues. Zero on bail and mutual aid.</strong>
          </p>
          <p class="muted" style="margin:.35rem 0 0">
            The waiver is permanent and is not configurable. It is written into a database
            function, not a settings page, so changing it would take a migration with somebody's
            name on it.
          </p>
        </div>

        <h2>What the free tier means</h2>
        <ul>
          <li>Every module. It is contact-gated, never feature-gated.</li>
          <li>No credit card to reach it.</li>
          <li>
            Downgrading never deletes anything. It stops new contacts being created and leaves
            everything you have.
          </li>
        </ul>
      </main>
    </Page>,
  ),
);

// ---------------------------------------------------------------------------
// /why
// ---------------------------------------------------------------------------

marketing.get('/why', (c) =>
  c.html(
    <Page title="Why we built this — Coram">
      <main>
        <h1>Why we built this</h1>

        <p>
          Six tools, six logins, six exports, and no answer to the question every organizer
          actually has: what is my relationship with this person? The CRM knows they gave. The
          events tool knows they came. Neither knows the other, and the volunteer holding both
          tabs open is the integration.
        </p>
        <p>
          This is not a market failure that a better product category will fix. Movement tools are
          fragmented because the people who need them cannot pay, so each tool is built for
          whoever can — the professionalised campaign, the well-funded advocacy shop — and sold
          down-market at a price that assumes a budget line.
        </p>
        <p>
          So Coram gives the whole stack away at the bottom of the market and takes a percentage
          of money that moves through it. A group with no budget pays nothing and gets everything.
          A group raising real money pays one percent. A bail fund pays nothing at any size,
          permanently, because taking a cut of somebody's bail is not a business we are willing to
          be in.
        </p>
        <p>
          The other half is what we refuse to store. Organizing data is dangerous data. A list of
          who attended, who gave, who is on which committee, and what an organizer privately
          thinks of them is a map of a movement, and it is exactly what gets subpoenaed. So the
          notes are encrypted with a key we never receive. The check-in is a boolean, not a
          location. The audit log records that someone read a record type, never what it said. The
          burn switch destroys a workspace in under a minute with no backup to restore from.
        </p>
        <p>
          None of that is a policy page. It is the schema. Every one of those decisions is
          something you could verify by reading a migration, which is why we publish audits
          instead of promises.
        </p>
      </main>
    </Page>,
  ),
);

// ---------------------------------------------------------------------------
// /trust — §7
// ---------------------------------------------------------------------------

marketing.get('/trust', async (c) => {
  const artifacts = await loadArtifacts(c.env);
  const canary = artifacts.find((a) => a.kind === 'canary');
  const overdue = anyOverdue(artifacts);
  const published = artifacts.filter((a) => a.publishedAt).length;

  return c.html(
    <Page title="Trust — Coram">
      <main>
        <h1>Trust</h1>
        <p class="lead">
          Coram is closed source. That is a choice, and it costs us something, so here is what we
          publish instead.
        </p>

        {/* §7: the page must visibly flag its own staleness. Automatic, and
            there is no way to suppress this from the application. */}
        {overdue && (
          <div class="flag">
            <p style="margin:0">
              <strong>Something on this page is overdue.</strong> An artifact we promised on a
              schedule has not been published on it. The dates below say which.
            </p>
          </div>
        )}

        {published === 0 && (
          <div class="flag">
            <p style="margin:0">
              <strong>Nothing has been published yet.</strong> Coram is not in use by any group,
              and there is nothing to audit or report on. This page will fill in as that changes.
              We would rather show you an empty page than a promise.
            </p>
          </div>
        )}

        {artifacts.map((artifact) => (
          <div class="card">
            <h3 style="margin-top:0">{artifact.title}</h3>
            <p class="muted" style="margin-bottom:.5rem">
              {artifact.description}
            </p>
            <p style="margin:0">
              <strong
                style={staleness(artifact) === 'overdue' ? 'color:var(--warn)' : undefined}
              >
                {describe(artifact)}
              </strong>{' '}
              <span class="muted">Cadence: {artifact.cadence.toLowerCase()}.</span>
            </p>
            {artifact.url && (
              <p style="margin:.5rem 0 0">
                <a href={artifact.url}>Read it</a>
              </p>
            )}
          </div>
        ))}

        <h2>The canary</h2>
        <p>{canary ? describe(canary) : 'Not published yet.'}</p>
        <p>
          It is a PGP-signed text file at <a href="/canary.txt">/canary.txt</a>, and the signing
          key is at <a href="/.well-known/coram-pgp.asc">/.well-known/coram-pgp.asc</a>. Nothing
          in our codebase generates or signs it. Signing is a manual act by a person, because a
          canary is only worth anything if that person is free to decline.
        </p>

        <h2>What we do not do</h2>
        <ul>
          <li>
            We do not call this open source or source-available. It is neither, and both would be
            false.
          </li>
          <li>
            We do not have SOC 2. Type 1 runs roughly $20k–$45k and Type 2 rather more; grassroots
            groups do not ask for it. We will revisit it when a union or funded coalition makes it
            a condition.
          </li>
          <li>We run no analytics, session recording, or third-party trackers inside the product.</li>
        </ul>

        <h2>Reporting something</h2>
        <p>
          Security contact and PGP key are in{' '}
          <a href="/.well-known/security.txt">security.txt</a>. We will publish findings we have
          not fixed yet, including in the annual audit.
        </p>
      </main>
    </Page>,
  );
});

// ---------------------------------------------------------------------------
// Machine-readable
// ---------------------------------------------------------------------------

/**
 * The canary itself, as text/plain (§7).
 *
 * Held in KV so publishing a newly signed one does not need a deploy. Nothing
 * in this codebase generates or signs it.
 */
marketing.get('/canary.txt', async (c) => {
  const document = await c.env.KV_FLAGS.get('canary:document');

  return c.text(document ?? 'No canary has been published yet.\n', document ? 200 : 404, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': 'public, max-age=300',
  });
});

marketing.get('/.well-known/coram-pgp.asc', async (c) => {
  const key = await c.env.KV_FLAGS.get('canary:pubkey');

  return c.text(key ?? 'No signing key has been published yet.\n', key ? 200 : 404, {
    'Content-Type': 'application/pgp-keys',
    'Cache-Control': 'public, max-age=3600',
  });
});

marketing.get('/.well-known/security.txt', (c) =>
  c.text(
    [
      'Contact: mailto:security@coram.app',
      'Preferred-Languages: en',
      'Encryption: https://coram.app/.well-known/coram-pgp.asc',
      'Policy: https://coram.app/trust',
      `Expires: ${new Date(Date.now() + 365 * 86_400_000).toISOString()}`,
      '',
    ].join('\n'),
    200,
    { 'Content-Type': 'text/plain; charset=utf-8' },
  ),
);
