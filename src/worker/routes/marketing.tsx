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

import { ABUSE_CONTACT, ENFORCEMENT, PROHIBITED, PROTECTED } from '../../shared/policy';
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
    /* Ink and paper, warmed. */
    --fg: #1b1410; --bg: #fffaf4; --muted: #6f6259; --line: #eadfd2;
    --ink: #17110d; --ink-fg: #fff6ec;

    /*
     * A real palette rather than one amber accent. Organizing is loud and
     * collective; a page about it that runs on beige argues the opposite.
     * Vermillion leads, gold and teal answer it, ultramarine anchors.
     */
    --flame: #e2452a;
    --gold:  #f0a52c;
    --teal:  #12857a;
    --deep:  #1e3a8f;
    --accent: var(--flame);

    --measure: 34rem;
    --display: ui-serif, Iowan Old Style, Palatino Linotype, Georgia, serif;
    --body: ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif;
  }
  @media (prefers-color-scheme: dark) {
    :root { --fg: #f6ece0; --bg: #120e0b; --muted: #a3968a; --line: #302620;
            --ink: #0c0908; --ink-fg: #fff6ec;
            --flame: #ff6144; --gold: #ffbe4d; --teal: #2bb3a3; --deep: #6d8cf0; }
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--fg);
         font: 400 17px/1.65 var(--body); -webkit-font-smoothing: antialiased;
         overflow-x: hidden; }

  .col { max-width: 46rem; margin: 0 auto; padding: 0 1.5rem; }
  .wide { max-width: 72rem; margin: 0 auto; padding: 0 1.5rem; }

  header { padding: 1.5rem 0 .4rem; position: relative; z-index: 3; }
  nav { display: flex; align-items: center; gap: 1.4rem; }
  nav .wordmark { font-family: var(--display); font-size: 1.2rem; color: var(--fg);
                  text-decoration: none; margin-right: auto; display: flex;
                  align-items: center; gap: .55rem; }
  nav .wordmark svg { display: block; }
  nav a { color: var(--muted); text-decoration: none; font-size: .93rem; }
  nav a:hover { color: var(--flame); }

  h1, h2, h3 { font-family: var(--display); font-weight: 500; letter-spacing: -.018em; }
  h1 { font-size: clamp(2.6rem, 7vw, 4.4rem); line-height: 1.0; margin: 0 0 1.1rem; }
  h2 { font-size: clamp(1.7rem, 4vw, 2.6rem); line-height: 1.1; margin: 0 0 1rem; }
  h3 { font-size: 1.05rem; margin: 0 0 .2rem; letter-spacing: -.005em; }
  .section { margin: 6rem 0; }
  p { margin: 0 0 1.15rem; max-width: var(--measure); }
  .lead { font-size: 1.25rem; line-height: 1.5; color: var(--muted); max-width: 32ch; }
  .muted { color: var(--muted); }
  .small { font-size: .87rem; }
  a { color: inherit; text-underline-offset: .18em; }
  ul { padding-left: 1.1rem; } li { margin-bottom: .4rem; }

  /* A hand-drawn underline under the phrase that carries the page. */
  .mark-under { position: relative; white-space: nowrap; }
  .mark-under svg { position: absolute; left: 0; right: 0; bottom: -.18em;
                    width: 100%; height: .38em; overflow: visible; }
  .mark-under path { fill: none; stroke: var(--flame); stroke-width: 7;
                     stroke-linecap: round;
                     stroke-dasharray: var(--len, 600); stroke-dashoffset: var(--len, 600); }

  /* ---- hero ---- */
  .hero { position: relative; width: 100%; min-height: min(94vh, 780px);
          display: flex; align-items: flex-end; overflow: hidden; background: var(--ink); }
  .hero-frame { position: absolute; inset: 0; will-change: transform; }
  .hero-frame img, .hero-frame > div { width: 100%; height: 100%; object-fit: cover; display: block; }
  .hero-scrim { position: absolute; inset: 0;
                background:
                  radial-gradient(70% 60% at 18% 82%, rgba(226,69,42,.32), transparent 70%),
                  linear-gradient(180deg, rgba(23,17,13,.10) 0%, rgba(23,17,13,.30) 45%,
                                  rgba(23,17,13,.80) 100%); }
  .hero-copy { position: relative; z-index: 2; width: 100%; padding-bottom: 3.5rem; }
  .hero-copy h1 { color: #fffaf4; max-width: 16ch; text-shadow: 0 2px 50px rgba(10,6,4,.55); }
  .hero-copy p { color: #f0e3d6; max-width: 34ch; margin: 0 0 1.6rem;
                 font-size: 1.15rem; text-shadow: 0 1px 24px rgba(10,6,4,.8); }
  .cta { display: inline-flex; align-items: center; gap: .5rem; background: var(--flame);
         color: #fff; padding: .8rem 1.4rem; border-radius: 999px; font-weight: 600;
         font-size: .98rem; text-decoration: none;
         box-shadow: 0 10px 30px rgba(226,69,42,.35); }
  .cta:hover { background: #c93a20; }
  .cta-ghost { color: #fffaf4; text-decoration: none; font-size: .95rem;
               margin-left: 1.1rem; border-bottom: 1px solid rgba(255,250,244,.45); }

  /* ---- full-bleed photographic bands ---- */
  .band { position: relative; width: 100%; margin: 5rem 0; overflow: hidden; background: var(--ink); }
  .band img, .band > div { width: 100%; display: block; max-height: 64vh; object-fit: cover; }
  .band figcaption { color: var(--muted); font-size: .85rem; padding: .75rem 1.5rem 0;
                     max-width: 72rem; margin: 0 auto; }

  /* ---- the commitments ---- */
  .creed { background: var(--ink); color: var(--ink-fg); padding: 6rem 0; margin: 6rem 0;
           position: relative; overflow: hidden; }
  .creed::before { content: ''; position: absolute; inset: -20% -10% auto -10%; height: 60%;
                   background: radial-gradient(50% 60% at 20% 30%, rgba(240,165,44,.18), transparent 70%),
                               radial-gradient(45% 55% at 80% 10%, rgba(18,133,122,.20), transparent 70%);
                   pointer-events: none; }
  .creed .col { position: relative; }
  .creed h2 { color: var(--ink-fg); margin-bottom: 2.5rem; }
  .creed li { font-family: var(--display); font-size: clamp(1.4rem, 3.4vw, 2.1rem);
              line-height: 1.35; max-width: 22ch; margin: 0 0 2.2rem; list-style: none;
              padding-left: 1.6rem; position: relative; }
  .creed ul { padding: 0; margin: 0; }
  .creed li::before { content: ''; position: absolute; left: 0; top: .55em;
                      width: .7rem; height: .7rem; border-radius: 999px; }
  .creed li:nth-child(1)::before { background: var(--flame); }
  .creed li:nth-child(2)::before { background: var(--gold); }
  .creed li:nth-child(3)::before { background: var(--teal); }
  .creed li:nth-child(4)::before { background: var(--deep); }

  /* ---- the six tools converging ---- */
  .merge { position: relative; height: 400px; margin: 2.5rem 0 1rem; overflow: hidden;
           border-radius: 14px;
           background: radial-gradient(75% 70% at 50% 50%, rgba(240,165,44,.14), transparent 72%); }
  .tool { position: absolute; transform-origin: center; width: 8.6rem; margin-left: -4.3rem;
          margin-top: -1.05rem; border-radius: 999px; padding: .42rem .7rem; font-size: .78rem;
          text-align: center; font-weight: 600; color: #fff; will-change: transform; }
  .tool:nth-child(1) { background: var(--flame); }
  .tool:nth-child(2) { background: var(--gold); color: #3a2a06; }
  .tool:nth-child(3) { background: var(--teal); }
  .tool:nth-child(4) { background: var(--deep); }
  .tool:nth-child(5) { background: #8b3fb5; }
  .tool:nth-child(6) { background: #d4356f; }
  .merge-mark { position: absolute; left: 50%; top: 50%; width: 124px; height: 124px;
                margin: -62px 0 0 -62px; will-change: transform, opacity; }
  @media (max-width: 34rem) {
    .merge { height: 330px; }
    .tool { width: 6.6rem; margin-left: -3.3rem; font-size: .7rem; }
  }

  /* ---- module grid ---- */
  .grid { display: grid; gap: .9rem; margin: 2.5rem 0 0;
          grid-template-columns: repeat(auto-fill, minmax(15rem, 1fr)); }
  .module { background: var(--bg); padding: 1.1rem 1.15rem 1rem; border: 1px solid var(--line);
            border-radius: 12px; display: flex; flex-direction: column; position: relative;
            overflow: hidden; will-change: transform, opacity;
            transition: transform .22s cubic-bezier(.2,.9,.3,1), box-shadow .22s, border-color .22s; }
  .module::after { content: ''; position: absolute; left: 0; right: 0; top: 0; height: 3px;
                   background: var(--tone, var(--flame)); transform: scaleX(0);
                   transform-origin: left; transition: transform .28s cubic-bezier(.2,.9,.3,1); }
  .module:hover { transform: translateY(-3px); border-color: transparent;
                  box-shadow: 0 14px 34px rgba(27,20,16,.12); }
  .module:hover::after { transform: scaleX(1); }
  .module h3 { color: var(--tone, var(--fg)); }
  .module p { margin: 0; font-size: .88rem; color: var(--muted); max-width: none; }
  .module svg.demo { display: block; margin-top: auto; padding-top: 1.1rem;
                     width: 100%; height: 42px; overflow: visible; }
  .module svg.demo [data-demo-part] { transform-origin: center bottom; }

  /* ---- numbers ---- */
  .figures { display: grid; gap: 1.5rem; margin: 2.5rem 0 0;
             grid-template-columns: repeat(auto-fit, minmax(11rem, 1fr)); }
  .figure .n { font-family: var(--display); font-size: clamp(2.4rem, 6vw, 3.4rem);
               line-height: 1; color: var(--tone, var(--flame)); }
  .figure p { font-size: .92rem; color: var(--muted); margin: .5rem 0 0; max-width: 24ch; }

  /* ---- comparison ---- */
  .scroll { overflow-x: auto; margin: 1.5rem 0; }
  table { border-collapse: collapse; width: 100%; font-size: .89rem; min-width: 40rem; }
  th, td { text-align: left; padding: .66rem .75rem; border-bottom: 1px solid var(--line); }
  thead th { font-family: var(--body); font-weight: 700; font-size: .74rem;
             text-transform: uppercase; letter-spacing: .08em; color: var(--muted); }
  tbody th { font-weight: 500; }
  .compare th:nth-child(2), .compare td:nth-child(2) {
    background: linear-gradient(180deg, rgba(226,69,42,.10), rgba(240,165,44,.08));
    font-weight: 700; color: var(--fg); }
  .compare thead th:nth-child(2) { color: var(--flame); }
  .scroll th:first-child, .scroll td:first-child { position: sticky; left: 0; background: var(--bg); }

  .card { border: 1px solid var(--line); border-radius: 12px; padding: 1.1rem 1.2rem; margin: .8rem 0; }
  .flag { border-left: 3px solid var(--flame); padding: .6rem 0 .6rem 1rem; margin: 1.75rem 0; }
  .highlight { border-radius: 12px; padding: 1.1rem 1.25rem; margin: 1.5rem 0;
               background: linear-gradient(120deg, rgba(226,69,42,.10), rgba(240,165,44,.12));
               border: 1px solid rgba(226,69,42,.22); }

  footer { border-top: 1px solid var(--line); margin-top: 5rem; padding-top: 2rem;
           padding-bottom: 4rem; font-size: .9rem; color: var(--muted); }
  footer a { color: var(--muted); }

  /* ---- /why editorial ---- */
  .editorial { max-width: 40rem; }
  .editorial p { max-width: none; line-height: 1.78; }
  .editorial p:first-of-type { font-size: 1.18rem; }
  .portrait { float: right; width: 16rem; margin: .4rem 0 1.25rem 2rem; }
  .portrait img, .portrait > div { width: 100%; height: auto; border-radius: 12px; display: block; }
  .portrait figcaption { font-size: .8rem; color: var(--muted); margin-top: .5rem; }
  @media (max-width: 42rem) { .portrait { float: none; width: 100%; margin: 1.5rem 0; } }

  @media (prefers-reduced-motion: reduce) {
    * { animation: none !important; transition: none !important; }
    .mark-under path { stroke-dashoffset: 0; }
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
        {/*
         * dangerouslySetInnerHTML, not {STYLE}, and it is load-bearing.
         * Hono JSX escapes text children, so a child combinator inside the
         * stylesheet ships as `.portrait &gt; div` — an invalid selector,
         * which makes a CSS parser drop the *entire* rule including the valid
         * selectors beside it. That silently killed object-fit on the hero and
         * the width cap on the portrait, with no error anywhere.
         *
         * Safe here because STYLE is a module constant we author. Nothing
         * user-supplied reaches it, and marketing.test.ts fails if any `&gt;`
         * appears in an emitted stylesheet again.
         */}
        <style dangerouslySetInnerHTML={{ __html: STYLE }} />
        {/*
         * defer, not async: this must not compete with the hero image for
         * bandwidth. The page is complete and correct before it arrives, so
         * there is nothing to gain by racing it (§8, 1.5s LCP).
         */}
        {props.motion ? <script type="module" src="/marketing/motion.js" defer /> : null}
      </head>
      <body>
        <header class="col">
          <nav>
            <a class="wordmark" href="/">
              <Mark size={22} />
              Coram
            </a>
            <a href="/why">Why</a>
            <a href="/pricing">Pricing</a>
            <a href="/trust">Trust</a>
          </nav>
        </header>
        {props.children}
        <footer class="col">
          <p>
            <a href="/canary.txt">Warrant canary</a> ·{' '}
            <a href="/.well-known/security.txt">security.txt</a> ·{' '}
            <a href="/trust">Trust</a> · <a href="/acceptable-use">Acceptable use</a>
          </p>
          <p class="small">Coram is closed source. We publish audits instead of code.</p>
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
        <circle cx={p.cx} cy={p.cy} r="5.5" fill="var(--tone, var(--fg))" />
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
    <rect data-demo-part x={x} y={30 - h} width="7" height={h} rx="1.5" fill="var(--tone, var(--fg))" opacity={o} />
  );

  switch (kind) {
    case 'bars':
      return (
        <svg class="demo" data-demo viewBox="0 0 120 32" aria-hidden="true">
          {[6, 14, 10, 22, 17, 27].map((h, i) => bar(i * 12, h, 0.5 + i * 0.09))}
        </svg>
      );
    case 'rows':
      return (
        <svg class="demo" data-demo viewBox="0 0 120 32" aria-hidden="true">
          {[0, 1, 2, 3].map((i) => (
            <rect
              data-demo-part
              x="0"
              y={i * 8}
              width={104 - i * 18}
              height="4"
              rx="2"
              fill="var(--tone, var(--fg))"
              opacity={0.85 - i * 0.13}
            />
          ))}
        </svg>
      );
    case 'graph':
      return (
        <svg class="demo" data-demo viewBox="0 0 120 32" aria-hidden="true">
          <path d="M12 16 L44 8 M12 16 L44 26 M44 8 L84 16 M44 26 L84 16" stroke="var(--tone, var(--muted))" stroke-width="1.5" fill="none" opacity="0.35" />
          {[
            [12, 16],
            [44, 8],
            [44, 26],
            [84, 16],
            [108, 16],
          ].map(([cx, cy], i) => (
            <circle data-demo-part cx={cx} cy={cy} r="5" fill="var(--tone, var(--fg))" opacity={0.55 + i * 0.11} />
          ))}
        </svg>
      );
    case 'grid':
      return (
        <svg class="demo" data-demo viewBox="0 0 120 32" aria-hidden="true">
          {Array.from({ length: 14 }, (_, i) => (
            <rect
              data-demo-part
              x={(i % 7) * 17}
              y={i < 7 ? 2 : 18}
              width="13"
              height="11"
              rx="2"
              fill="var(--tone, var(--fg))"
              opacity={0.38 + ((i * 7) % 10) / 13}
            />
          ))}
        </svg>
      );
    case 'send':
      return (
        <svg class="demo" data-demo viewBox="0 0 120 32" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <rect
              data-demo-part
              x={i * 8}
              y={i * 10 + 2}
              width={70 - i * 8}
              height="8"
              rx="4"
              fill="var(--tone, var(--fg))"
              opacity={0.8 - i * 0.15}
            />
          ))}
          <circle data-demo-part cx="106" cy="16" r="6.5" fill="var(--gold)" />
        </svg>
      );
    case 'shield':
      return (
        <svg class="demo" data-demo viewBox="0 0 120 32" aria-hidden="true">
          {[26, 19, 12].map((r, i) => (
            <circle
              data-demo-part
              cx="60"
              cy="16"
              r={r}
              fill="none"
              stroke="var(--tone, var(--fg))"
              stroke-width="1.5"
              opacity={0.35 + i * 0.22}
            />
          ))}
        </svg>
      );
    default:
      return (
        <svg class="demo" data-demo viewBox="0 0 120 32" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <rect data-demo-part x="0" y={i * 11} width={112 - i * 24} height="5" rx="2.5" fill="var(--tone, var(--fg))" opacity="0.72" />
          ))}
          {/* The redaction: §5.10 strips identifying values before inference. */}
          <rect data-demo-part x="42" y="11" width="34" height="5" rx="2.5" fill="var(--gold)" />
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
      {/* 1. Hero — full-bleed, colour-lit scrim, slow Ken Burns push-in. */}
      <section class="hero">
        <div class="hero-frame" data-motion="ken-burns">
          <Picture id="hero-hall" sizes="100vw" priority />
        </div>
        <div class="hero-scrim" />
        <div class="hero-copy">
          <div class="wide">
            <h1>
              Everything your movement runs on.{' '}
              <span class="mark-under">
                One place.
                <Underline />
              </span>
            </h1>
            <p>
              Replaces your CRM, events tool, texting tool, donation page, spreadsheet, and
              group chat. One login, one shared record of who your people are.
            </p>
            <a class="cta" href="/app">
              Start free <span aria-hidden="true">→</span>
            </a>
            <a class="cta-ghost" href="/why">
              Why we built this
            </a>
          </div>
        </div>
      </section>

      {/* 2. The problem — six tools drift, collide, merge into the mark. */}
      <div class="col section">
        <h2>Six tools that have never met</h2>
        <p class="lead">
          The person who came to Tuesday's meeting, gave twenty dollars, and replied to a text
          is three different records in three systems.
        </p>
        <p>
          The market is fragmented because organizers are poor, not because they prefer variety.
          Every tool is built for whoever can pay and sold down-market at a price that assumes a
          budget line.
        </p>

        {/*
         * Rendered merged: the finished state of the scroll sequence, and
         * unchanged, the static fallback under reduced motion.
         */}
        <div
          class="merge"
          data-motion="merge"
          role="img"
          aria-label="Six separate tools — CRM, events, texting, donations, spreadsheet, group chat — gathered into one."
        >
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
            <Mark size={124} />
          </div>
        </div>
      </div>

      <Band
        id="shared-table"
        caption="One table, one set of papers, and no argument about who is on the list."
      />

      {/* 3. What we owe you — the emotional centre. */}
      <section class="creed">
        <div class="col">
          <h2>What we owe you</h2>
          <ul data-motion="stagger">
            <li>We do not surveil the people who use this.</li>
            <li>Decisions stay at the smallest competent level.</li>
            <li>The free tier is not a funnel. It is the point.</li>
            <li>We take nothing from bail funds and mutual aid.</li>
          </ul>
        </div>
      </section>

      {/* 4. Numbers — the commitments, in figures. */}
      <div class="wide section">
        <h2>The deal, in numbers</h2>
        <div class="figures" data-motion="stagger">
          <div class="figure" style="--tone:var(--flame)">
            <div class="n" data-count="11">11</div>
            <p>Modules, all of them on the free tier.</p>
          </div>
          <div class="figure" style="--tone:var(--gold)">
            <div class="n" data-count="250">250</div>
            <p>Contacts free. Not a trial, no card.</p>
          </div>
          <div class="figure" style="--tone:var(--teal)">
            <div class="n" data-count="1" data-suffix="%">
              1%
            </div>
            <p>On fundraising and dues. That is the business.</p>
          </div>
          <div class="figure" style="--tone:var(--deep)">
            <div class="n" data-count="0" data-suffix="%">
              0%
            </div>
            <p>On bail funds and mutual aid. Permanently.</p>
          </div>
        </div>
      </div>

      {/* 5. Module grid — staggered reveal, looping micro-demos, colour per card. */}
      <div class="wide section">
        <h2>Eleven modules, one record</h2>
        <p class="muted">
          Every one reads the same people. Nothing here is an integration you have to maintain.
        </p>
        <div class="grid" data-motion="stagger">
          {MODULES.map((m, i) => (
            <div class="module" style={`--tone:${TONES[i % TONES.length]}`}>
              <h3>{m.name}</h3>
              <p>{m.line}</p>
              <Demo kind={m.demo} />
            </div>
          ))}
        </div>
      </div>

      <Band
        id="union-hall"
        caption="A hall filling up is the only metric that has ever mattered."
      />

      {/* 6. Comparison — sticky first column on mobile. */}
      <div class="wide section">
        <h2>How it compares</h2>
        <div class="scroll">
          <ComparisonTable />
        </div>
        <p class="muted small">
          Compiled from publicly documented features. Competitors change what they offer; if
          something here is out of date, tell us and we will correct it.
        </p>
      </div>

      {/* 7. Trust + pricing. */}
      <div class="col section">
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

        <h2 style="margin-top:4rem">What it costs</h2>
        <p>
          Free under 250 contacts, with all eleven modules. Not a trial, not feature-gated, no
          card required. <a href="/pricing">Full pricing</a>.
        </p>
        <div class="highlight">
          <p style="margin:0;font-weight:600">
            1% on fundraising and dues. Zero on bail and mutual aid.
          </p>
          <p class="muted small" style="margin:.4rem 0 0">
            The waiver is written into a database function, not a settings page.
          </p>
        </div>
        <p style="margin-top:2rem">
          <a class="cta" href="/app">
            Start free <span aria-hidden="true">→</span>
          </a>
        </p>
      </div>
    </Page>,
  ),
);

/** One accent per card, cycled. Colour is the only thing telling them apart. */
const TONES = ['var(--flame)', 'var(--gold)', 'var(--teal)', 'var(--deep)', '#8b3fb5', '#d4356f'];

/**
 * The rough underline beneath "One place."
 *
 * Drawn as a path so `motion.ts` can stroke it on rather than fade it in — the
 * one piece of movement on the page that reads as a hand rather than a
 * transition. Rendered fully drawn when the bundle never arrives, because the
 * dash offset is a CSS custom property the script overrides rather than sets.
 */
function Underline() {
  return (
    <svg viewBox="0 0 600 24" preserveAspectRatio="none" aria-hidden="true" data-underline>
      <path d="M6 16 C 120 5, 240 22, 360 11 S 520 6, 594 14" />
    </svg>
  );
}


/**
 * A full-bleed photograph between sections.
 *
 * §8.1 asks for a page that reads like a photo essay rather than a feature
 * list, and the rhythm is what does that: a narrow column of text, then the
 * whole width given over to a room with people in it. The caption carries a
 * line of argument rather than describing the picture — the alt text already
 * describes the picture, for the people who need that.
 */
function Band({ id, caption }: { id: Parameters<typeof Picture>[0]['id']; caption: string }) {
  return (
    <figure class="band" style="margin-left:0;margin-right:0">
      <Picture id={id} sizes="100vw" />
      <figcaption>{caption}</figcaption>
    </figure>
  );
}

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
    <table class="compare">
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
      <main class="col">
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
      <main class="col editorial">
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
      <main class="col">
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
// /acceptable-use
// ---------------------------------------------------------------------------

/**
 * The acceptable use policy, rendered from src/shared/policy.ts.
 *
 * Rendered from the module rather than written out here so that this page and
 * the guard that refuses to draft the material cannot drift apart. A published
 * rule the product does not enforce is a lie with a URL; an enforced rule that
 * is not published is worse.
 *
 * The order on the page is deliberate. What is protected comes *first*. Anyone
 * arriving here has usually been told that organizing like theirs is not
 * welcome on platforms like this, and the answer to that should be the first
 * thing they read.
 */
marketing.get('/acceptable-use', (c) =>
  c.html(
    <Page
      title="Acceptable use — Coram"
      description="What Coram supports, and the conduct it does not."
    >
      <main class="col">
        <h1>Acceptable use</h1>
        <p class="lead">
          Coram is built for organizing that makes someone powerful uncomfortable. This page
          exists so you can tell, before you trust us with your list, exactly where the line is.
        </p>

        <h2>What is welcome here</h2>
        <p>
          All of it, including the parts that get people arrested. Civil disobedience is unlawful
          by design. That is not a violation of this policy and never will be.
        </p>
        <ul>
          {PROTECTED.map((item) => (
            <li>{item}</li>
          ))}
        </ul>

        <h2>What is not</h2>
        <p>
          These are about conduct — hurting people, arming people, targeting people. None of them
          is about a cause, a tactic, or a politics, and we will not read them that way.
        </p>
        <ul>
          {PROHIBITED.map((rule) => (
            <li>{rule.text}</li>
          ))}
        </ul>

        <h2>Why it is written like this</h2>
        <p>
          Because &ldquo;no violent activism&rdquo; is not a policy. In practice that phrase gets
          used against tenant unions, bail funds, and strike funds by people who would like them
          shut down. A rule written in those words keeps nobody safe — it just hands a lever to
          whoever files the most complaints. So the rules above name conduct, and the list above
          them names what is protected, and both are public so that a bad-faith report has an
          answer waiting for it.
        </p>

        <h2>How this is enforced</h2>
        <ul>
          {ENFORCEMENT.map((item) => (
            <li>{item}</li>
          ))}
        </ul>
        <p>
          Coram&rsquo;s writing assistant also refuses to draft the material above, before any
          model sees the request. That is a small thing, and it is the part we can point at.
        </p>

        <h2>Reporting</h2>
        <p>
          <a href={`mailto:${ABUSE_CONTACT}`}>{ABUSE_CONTACT}</a>. Tell us what you saw and where.
          A person reads it.
        </p>
        <p class="muted">
          If we act against your workspace and you think we got it wrong, reply to us. We would
          rather be argued with than be quietly wrong.
        </p>
      </main>
    </Page>,
  ),
);

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
