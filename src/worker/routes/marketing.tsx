/** @jsxImportSource hono/jsx */
/**
 * Public routes (§1.1, §8) — the marketing site and /trust.
 *
 * Server-rendered Hono JSX. No second build target, no Astro (§1.2). No
 * external JS, no CDN fonts, no analytics beyond what Cloudflare provides at
 * the edge (§10).
 *
 * All nine §8.1 sections are here, with the §8.2 photography served from R2 by
 * routes/media.ts and the §8.4 motion in src/marketing/motion.ts.
 *
 * The invariant that makes the motion safe: **every section below renders in
 * its finished state.** The merge graphic is already merged, the module grid is
 * already visible, the hero is already framed. Motion moves elements away from
 * that state and brings them back, so the page is correct with JavaScript off,
 * with the bundle 404ing, and under `prefers-reduced-motion` — which §8.4
 * requires be "a real static fallback, not a zero-duration transition".
 *
 * Photography degrades the same way. `<Picture>` renders a tone block in the
 * palette when an image has not been generated, so a fresh clone with no
 * Cloudflare credentials looks deliberate rather than broken.
 *
 * §9 says "Ship 1–3 before writing any marketing copy. The site describes a
 * product that exists." Every module exists in code but none has run against a
 * live database, so the copy below describes capabilities rather than results,
 * and /trust states plainly that no artifact has been published. Reading it
 * back before launch, with a working deploy, is a required step rather than a
 * nice-to-have.
 */

import { Hono } from 'hono';

import type { Env, Vars } from '../env';
import { Picture } from '../lib/picture';
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

  /* ---- §8.1 hero: full-bleed, dark scrim, Ken Burns on the frame ---- */
  .hero { position: relative; width: 100%; height: min(82vh, 640px);
          overflow: hidden; background: #14120f; }
  /* The animated element. Scaling this never re-decodes the image inside it. */
  .hero-frame { position: absolute; inset: 0; will-change: transform; }
  .hero-frame img, .hero-frame > div { width: 100%; height: 100%; object-fit: cover; display: block; }
  /*
   * Tuned against the actual photograph, not guessed. The subject of the hero
   * sits in the lower third — which is also where the copy sits — so a scrim
   * heavy enough to guarantee text contrast everywhere turns a crowded hall
   * into an empty dark room. This stays light through the top two thirds and
   * ramps late, and the headline gets a shadow of its own instead of making
   * the whole image pay for its legibility.
   */
  .hero-scrim { position: absolute; inset: 0;
                background: linear-gradient(180deg, rgba(20,18,15,.18) 0%,
                            rgba(20,18,15,.30) 42%, rgba(20,18,15,.62) 72%,
                            rgba(20,18,15,.88) 100%); }
  .hero-copy { position: absolute; left: 0; right: 0; bottom: 0;
               max-width: 46rem; margin: 0 auto; padding: 0 1.25rem 2.75rem; }
  .hero-copy h1 { color: #f8f5f0; margin: 0 0 .6rem; font-size: clamp(2rem, 5.2vw, 3.1rem);
                  text-shadow: 0 1px 24px rgba(12,10,8,.85), 0 1px 3px rgba(12,10,8,.6); }
  .hero-copy p { color: #ddd6cb; margin: 0; max-width: 30em;
                 text-shadow: 0 1px 16px rgba(12,10,8,.9); }

  /* ---- §8.1 "The problem": six tools converge on one mark ---- */
  /* overflow:hidden is structural, not cosmetic — the scattered state of the
     scroll sequence must never reach the copy of the next section. */
  .merge { position: relative; height: 360px; margin: 2rem 0 1.5rem;
           overflow: hidden; border: 1px solid var(--line); border-radius: 8px;
           background: linear-gradient(180deg, transparent, rgba(201,130,31,.04)); }
  .tool { position: absolute; transform-origin: center;
          width: 8.5rem; margin-left: -4.25rem; margin-top: -1.1rem;
          border: 1px solid var(--line); border-radius: 6px; background: var(--bg);
          padding: .4rem .5rem; font-size: .78rem; text-align: center; color: var(--muted);
          will-change: transform; }
  .merge-mark { position: absolute; left: 50%; top: 50%; width: 104px; height: 104px;
                margin: -52px 0 0 -52px; will-change: transform, opacity; }
  @media (max-width: 34rem) {
    .merge { height: 320px; }
    .tool { width: 6.5rem; margin-left: -3.25rem; font-size: .7rem; }
  }

  /* ---- §8.1 module grid ---- */
  .grid { display: grid; gap: .75rem; margin: 1rem 0;
          grid-template-columns: repeat(auto-fill, minmax(14rem, 1fr)); }
  /* Column + auto margin so every demo sits on the card's baseline however
     long the description wraps. Ragged demo positions read as a bug. */
  .module { border: 1px solid var(--line); border-radius: 8px; padding: .85rem .9rem;
            display: flex; flex-direction: column; will-change: transform, opacity; }
  .module h3 { margin: 0 0 .15rem; font-size: .95rem; }
  .module p { margin: 0; font-size: .85rem; color: var(--muted); max-width: none; }
  .module svg { display: block; margin-top: auto; padding-top: .9rem;
                width: 100%; height: 34px; overflow: visible; }
  .module svg [data-demo-part] { transform-origin: center bottom; }

  /* ---- §8.1 "Why we built this": editorial column, 68ch measure ---- */
  .editorial { max-width: 68ch; }
  .editorial p { max-width: none; line-height: 1.75; }
  .portrait { float: right; width: 15rem; margin: .35rem 0 1rem 1.5rem; border-radius: 6px; }
  .portrait img, .portrait > div { width: 100%; border-radius: 6px; display: block; }
  @media (max-width: 40rem) { .portrait { float: none; width: 100%; margin: 1rem 0; } }

  .full { max-width: none; padding: 0; }

  /*
   * §8.4: a real static fallback, not a zero-duration transition. The motion
   * bundle returns early under reduced motion, leaving the server-rendered
   * state — this only stops anything mid-flight and disables hover drift.
   */
  @media (prefers-reduced-motion: reduce) {
    * { animation: none !important; transition: none !important; }
  }
`;

/**
 * The mark at favicon size: eight people around a table, the ring in amber.
 *
 * Hand-written rather than shared with <Mark> because at 16px the detail has to
 * change — the people go larger relative to the ring and the stroke thickens,
 * or it turns to mush in a tab. Same drawing, different optical size.
 */
const FAVICON = `data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">` +
    `<circle cx="50" cy="50" r="19" fill="none" stroke="#c9821f" stroke-width="7"/>` +
    Array.from({ length: 8 }, (_, i) => {
      const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
      const cx = (50 + Math.cos(a) * 36).toFixed(1);
      const cy = (50 + Math.sin(a) * 36).toFixed(1);
      return `<circle cx="${cx}" cy="${cy}" r="8" fill="#8a8079"/>`;
    }).join('') +
    `</svg>`,
)}`;

function Page(props: {
  title: string;
  description?: string;
  /** Loads the §8.4 motion bundle. Only the front page needs it. */
  motion?: boolean;
  children?: unknown;
}) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{props.title}</title>
        {props.description ? <meta name="description" content={props.description} /> : null}
        {/*
         * The mark, inline. An SVG favicon costs no request, scales to every
         * size a browser asks for, and — because `currentColor` is not
         * available here — carries its own two colours so it reads on both a
         * light and a dark tab strip.
         */}
        <link rel="icon" href={FAVICON} type="image/svg+xml" />
        <style>{STYLE}</style>
        {/*
         * defer, not async: this must not compete with the hero image for
         * bandwidth. The page is complete and correct before it arrives, so
         * there is nothing to gain by racing it (§8, 1.5s LCP).
         */}
        {props.motion ? <script type="module" src="/marketing/motion.js" defer /> : null}
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

/** The six tools §8.1 wants merging into one mark. */
const REPLACED = ['CRM', 'Events tool', 'Texting tool', 'Donation page', 'Spreadsheet', 'Group chat'];

/**
 * The Coram mark: a ring of people around a table.
 *
 * Drawn rather than generated. A diffusion model is the wrong instrument for a
 * geometric mark that has to stay identical between the front page, the merge
 * sequence, and eventually a favicon.
 */
function Mark({ size = 104 }: { size?: number }) {
  const people = Array.from({ length: 8 }, (_, i) => {
    const angle = (i / 8) * Math.PI * 2 - Math.PI / 2;
    return { cx: 50 + Math.cos(angle) * 34, cy: 50 + Math.sin(angle) * 34 };
  });

  return (
    <svg viewBox="0 0 100 100" width={size} height={size} role="img" aria-label="Coram">
      <circle cx="50" cy="50" r="17" fill="none" stroke="var(--accent)" stroke-width="2.5" />
      {people.map((p) => (
        <circle cx={p.cx} cy={p.cy} r="5.5" fill="var(--fg)" />
      ))}
    </svg>
  );
}

/**
 * Micro-interaction demos (§8.1: "a three-second looping micro-interaction
 * demo, not a screenshot").
 *
 * Abstract rather than literal. A screenshot of a screen nobody has used yet
 * would be a claim about a product that has not shipped; a moving abstraction
 * of the shape of the work is honest about being an illustration.
 *
 * Rendered static and legible; `motion.ts` animates the parts while in view.
 */
function Demo({ kind }: { kind: 'rows' | 'graph' | 'grid' | 'send' | 'bars' | 'shield' | 'text' }) {
  const bar = (x: number, h: number, o = 1) => (
    <rect data-demo-part x={x} y={30 - h} width="7" height={h} rx="1.5" fill="var(--fg)" opacity={o} />
  );

  switch (kind) {
    case 'bars':
      return (
        <svg data-demo viewBox="0 0 120 32" aria-hidden="true">
          {[6, 14, 10, 22, 17, 27].map((h, i) => bar(i * 12, h, 0.35 + i * 0.11))}
        </svg>
      );
    case 'rows':
      return (
        <svg data-demo viewBox="0 0 120 32" aria-hidden="true">
          {[0, 1, 2, 3].map((i) => (
            <rect
              data-demo-part
              x="0"
              y={i * 8}
              width={104 - i * 18}
              height="4"
              rx="2"
              fill="var(--fg)"
              opacity={0.7 - i * 0.13}
            />
          ))}
        </svg>
      );
    case 'graph':
      return (
        <svg data-demo viewBox="0 0 120 32" aria-hidden="true">
          <path d="M12 16 L44 8 M12 16 L44 26 M44 8 L84 16 M44 26 L84 16" stroke="var(--line)" stroke-width="1.5" fill="none" />
          {[
            [12, 16],
            [44, 8],
            [44, 26],
            [84, 16],
            [108, 16],
          ].map(([cx, cy], i) => (
            <circle data-demo-part cx={cx} cy={cy} r="4.5" fill="var(--fg)" opacity={0.4 + i * 0.14} />
          ))}
        </svg>
      );
    case 'grid':
      return (
        <svg data-demo viewBox="0 0 120 32" aria-hidden="true">
          {Array.from({ length: 14 }, (_, i) => (
            <rect
              data-demo-part
              x={(i % 7) * 17}
              y={i < 7 ? 2 : 18}
              width="13"
              height="11"
              rx="2"
              fill="var(--fg)"
              opacity={0.2 + ((i * 7) % 10) / 14}
            />
          ))}
        </svg>
      );
    case 'send':
      return (
        <svg data-demo viewBox="0 0 120 32" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <rect
              data-demo-part
              x={i * 8}
              y={i * 10 + 2}
              width={70 - i * 8}
              height="8"
              rx="4"
              fill="var(--fg)"
              opacity={0.65 - i * 0.16}
            />
          ))}
          <circle data-demo-part cx="106" cy="16" r="6" fill="var(--accent)" opacity="0.8" />
        </svg>
      );
    case 'shield':
      return (
        <svg data-demo viewBox="0 0 120 32" aria-hidden="true">
          {[26, 19, 12].map((r, i) => (
            <circle
              data-demo-part
              cx="60"
              cy="16"
              r={r}
              fill="none"
              stroke="var(--fg)"
              stroke-width="1.5"
              opacity={0.2 + i * 0.2}
            />
          ))}
        </svg>
      );
    default:
      return (
        <svg data-demo viewBox="0 0 120 32" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <rect data-demo-part x="0" y={i * 11} width={112 - i * 24} height="5" rx="2.5" fill="var(--fg)" opacity="0.55" />
          ))}
          {/* The redaction: §5.10 strips identifying values before inference. */}
          <rect data-demo-part x="42" y="11" width="34" height="5" rx="2.5" fill="var(--accent)" />
        </svg>
      );
  }
}

const MODULES: Array<{ name: string; line: string; demo: Parameters<typeof Demo>[0]['kind'] }> = [
  { name: 'Membra', line: 'Supporter records, tags, segments, import and full export.', demo: 'rows' },
  { name: 'Vinculum', line: 'One-to-ones, ladders of engagement, turf, follow-up queues.', demo: 'graph' },
  { name: 'Convocare', line: 'Events with RSVP, shifts, waitlists, and check-in.', demo: 'grid' },
  { name: 'Nuntius', line: 'Email, peer-to-peer texting, and a phone bank.', demo: 'send' },
  { name: 'Petitio', line: 'Petitions and legislator lookup.', demo: 'rows' },
  { name: 'Thesaurus', line: 'Fundraising, dues, and escrowed mutual aid and bail funds.', demo: 'bars' },
  { name: 'Colloquium', line: 'Encrypted internal channels that expire on their own.', demo: 'send' },
  { name: 'Consilium', line: 'Proposals, quorum, and five ways to vote.', demo: 'bars' },
  { name: 'Custos', line: 'Legal observer intake and jail support.', demo: 'shield' },
  { name: 'Scriba', line: 'Drafting help from a private model, with names stripped first.', demo: 'text' },
  { name: 'Federatio', line: 'Coalitions, where a parent sees totals and nothing more.', demo: 'graph' },
];

marketing.get('/', (c) =>
  c.html(
    <Page
      motion
      title="Coram — everything your movement runs on, one place"
      description="One place for your CRM, events, texting, donations, spreadsheet and group chat. Free under 250 contacts, every module."
    >
      {/* 1. Hero (§8.1) — full-bleed, dark scrim, slow Ken Burns push-in. */}
      <section class="hero">
        <div class="hero-frame" data-motion="ken-burns">
          <Picture id="hero-hall" sizes="100vw" priority />
        </div>
        <div class="hero-scrim" />
        <div class="hero-copy">
          <h1>Everything your movement runs on. One place.</h1>
          <p>
            Replaces your CRM, events tool, texting tool, donation page, spreadsheet, and group
            chat. One login, one shared record of who your people are.
          </p>
        </div>
      </section>

      <main>
        {/* 2. The problem (§8.1) — six tools drift, collide, merge into the mark. */}
        <h2>The problem</h2>
        <p>
          A typical group runs six disconnected tools with no shared data layer. The person who
          came to Tuesday's meeting, gave twenty dollars, and replied to a text is three different
          records in three systems that have never met.
        </p>
        <p>
          The market is fragmented because organizers are poor, not because they prefer variety.
        </p>

        {/*
         * Rendered merged: this is the finished state of the scroll sequence
         * and, unchanged, the static fallback §8.1 asks for under reduced
         * motion or no JavaScript.
         */}
        <div class="merge" data-motion="merge" role="img" aria-label="Six separate tools — CRM, events, texting, donations, spreadsheet, group chat — gathered into one.">
          {REPLACED.map((label, i) => {
            const angle = (i / REPLACED.length) * Math.PI * 2 - Math.PI / 2;
            return (
              <div
                class="tool"
                data-tool
                style={`left:${50 + Math.cos(angle) * 23}%;top:${50 + Math.sin(angle) * 28}%`}
              >
                {label}
              </div>
            );
          })}
          <div class="merge-mark" data-mark>
            <Mark />
          </div>
        </div>

        {/* 3. What we owe you (§8.1, §2) — the emotional centre. Four sentences,
            no icons, no headers on each. No tradition named. */}
        <h2>What we owe you</h2>
        <p>We do not surveil the people who use this.</p>
        <p>
          Data and decisions stay at the smallest competent level. A coalition does not
          automatically see a chapter's records.
        </p>
        <p>The free tier is not a funnel. It is the point.</p>
        <p>We take nothing from bail funds and mutual aid.</p>

        {/* 4. Module grid (§8.1) — staggered fade-up, looping micro-demos. */}
        <h2>What it does</h2>
        <div class="grid" data-motion="stagger">
          {MODULES.map((m) => (
            <div class="module">
              <h3>{m.name}</h3>
              <p>{m.line}</p>
              <Demo kind={m.demo} />
            </div>
          ))}
        </div>

        {/* 5. Comparison (§8.3) — sticky first column on mobile. */}
        <h2>How it compares</h2>
        <div class="scroll">
          <ComparisonTable />
        </div>
        <p class="muted" style="font-size:.85rem">
          Compiled from publicly documented features. Competitors change what they offer; if
          something here is out of date, tell us and we will correct it.
        </p>

        {/* 6. Trust (§8.1) — the four artifacts, live dates, on /trust. */}
        <h2>What we publish</h2>
        <p>
          An annual security audit in full, including what we have not fixed. A semiannual
          transparency report. A quarterly warrant canary. Documentation for taking everything
          with you.
        </p>
        <p>
          Every one carries a live date, and the page flags itself when something is overdue.{' '}
          <a href="/trust">See where they stand</a> — including the ones we have not published
          yet.
        </p>

        {/* 7. Pricing (§8.1) — the bail-fund waiver gets its own row. */}
        <h2>What it costs</h2>
        <p>
          Free under 250 contacts, with all eleven modules. Not a trial, not feature-gated, no
          card required. <a href="/pricing">Full pricing</a>.
        </p>
        <div class="highlight">
          <p style="margin:0">
            <strong>1% on fundraising and dues. Zero on bail and mutual aid.</strong>
          </p>
        </div>
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
    <Page
      title="Why we built this — Coram"
      description="Movement tools are fragmented because organizers cannot pay. Coram gives the stack away and takes a percentage of money that moves through it."
    >
      {/* §8.1 item 8: long-form editorial, measure capped at 68 characters,
          generous line height, one portrait-orientation photograph. */}
      <main class="editorial">
        <h1>Why we built this</h1>

        <div class="portrait">
          <Picture id="why-portrait" sizes="(max-width: 40rem) 100vw, 15rem" />
        </div>

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
