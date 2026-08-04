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
import { ShotFigure } from '../lib/shot';
import { anyOverdue, describe, loadArtifacts, staleness } from '../lib/trust';
import {
  ABUSE_CONTACT,
  ENFORCEMENT,
  LIMITS,
  PROHIBITED,
  PROTECTED,
} from '../../shared/policy';
import { ABSENT, CONTROLS, DISCLOSURE } from '../../shared/security';
import { DEMO_EMAIL, DEMO_PASSWORD } from '../../shared/demo';

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

  /*
   * ---- the masthead ----
   *
   * It sat in a 46rem container while every section below it was 72rem, so the
   * wordmark was indented past the content it was meant to sit above and the
   * whole bar read as something bolted on afterwards. Same container, a
   * hairline to sit on, and a destination on the right so the row has somewhere
   * to end.
   */
  header { position: sticky; top: 0; z-index: 20;
           background: color-mix(in srgb, var(--bg) 86%, transparent);
           backdrop-filter: saturate(1.6) blur(12px);
           /* A permanent hairline rather than one a scroll handler adds: the
              bar is translucent, so it needs an edge at every scroll position
              and this way it needs no JavaScript to get one. */
           border-bottom: 1px solid var(--line); }
  nav { display: flex; align-items: center; gap: 1.75rem; height: 4.25rem; }
  nav .wordmark { font-family: var(--display); font-size: 1.25rem; color: var(--fg);
                  text-decoration: none; margin-right: auto; display: flex;
                  align-items: center; gap: .55rem; letter-spacing: -.01em; }
  nav .wordmark svg { display: block; }
  nav a { color: var(--muted); text-decoration: none; font-size: .94rem;
          transition: color .15s ease; }
  nav a:hover { color: var(--fg); }
  nav a[aria-current="page"] { color: var(--fg); }
  /* The one thing on the bar that is not a link to more reading. */
  nav .cta { color: var(--bg); background: var(--fg); padding: .5rem 1.05rem;
             border-radius: 999px; font-weight: 600; font-size: .9rem; }
  nav .cta:hover { background: var(--flame); color: #fff; }
  @media (max-width: 46rem) {
    /* Four section links do not fit beside a wordmark on a phone. The demo is
       the one that has to survive, because it is the only one that is a door
       rather than a footnote. */
    nav .drop { display: none; }
    nav { gap: 1rem; height: 3.75rem; }
  }

  h1, h2, h3 { font-family: var(--display); font-weight: 500; letter-spacing: -.018em; }
  h1 { font-size: clamp(2.6rem, 7vw, 4.4rem); line-height: 1.0; margin: 0 0 1.1rem; }
  h2 { font-size: clamp(1.7rem, 4vw, 2.6rem); line-height: 1.1; margin: 0 0 1rem; }
  h3 { font-size: 1.05rem; margin: 0 0 .2rem; letter-spacing: -.005em; }
  /*
   * margin-block, not the margin shorthand this was.
   *
   * .wide and .col centre themselves with auto inline margins. Every section
   * carries both classes, and the shorthand here has the same specificity and
   * comes later in the sheet — so it reset the inline margins to zero and
   * pinned every section on every page to the left edge, with the whole right
   * half of a large screen empty. The headings looked centred because they
   * were: centred inside a container that was itself flush left.
   */
  .section { margin-block: 7rem; }
  p { margin: 0 0 1.15rem; max-width: var(--measure); }
  .lead { font-size: 1.25rem; line-height: 1.5; color: var(--muted); max-width: 32ch; }

  /*
   * ---- the centred spine ----
   *
   * Sections are 72rem wide and their type is set to a 34rem measure, so
   * left-aligning both put every heading and paragraph against the left edge
   * of a container twice their width, with the right half of a large screen
   * empty. The measure is right; where it sat was not.
   *
   * A section's own heading and lead are therefore centred as a block and the
   * text inside them is centred too — a title and a standfirst are display
   * type and read that way. Body prose is never centred: the editorial column
   * and the essay pages keep their ragged right, because centred paragraphs
   * make every line start in a different place and are harder to read.
   */
  .wide.section > h2,
  .wide.section > p,
  .wide.section > .eyebrow,
  /*
   * The narrow columns get their heading and standfirst centred too, but not
   * their body copy: a 46rem column is already the measure, and centring prose
   * inside it would start every line in a different place.
   */
  .col.section > h2,
  .col.section > .lead,
  .col.section > .eyebrow { text-align: center; margin-inline: auto; }
  .wide.section > h2,
  .col.section > h2 { max-width: 22ch; }
  .wide.section > .lead,
  .col.section > .lead { max-width: 46ch; }
  .wide.section > p { max-width: 54ch; }
  .wide.section > .shots,
  .wide.section > .claims,
  .wide.section > .grid,
  .wide.section > .merge { margin-inline: auto; }

  /* ---- claim cards ----
   *
   * What the sections below the fold say about a feature: four short blocks in
   * a row that wraps. Named for what they are rather than reusing the orbit's
   * class, which was quietly stealing them.
   */
  /*
   * Two by two, not auto-fit.
   *
   * auto-fit with a 15rem minimum fitted three of the four across and dropped
   * the fourth onto a row of its own, which reads as a card that failed to
   * load rather than as a fourth point. Four items have one honest
   * arrangement at this width and it is a square.
   */
  .claims { display: grid; gap: 2.4rem 3rem; margin: 3.5rem auto 0; max-width: 56rem;
            grid-template-columns: repeat(2, minmax(0, 1fr)); }
  @media (max-width: 46rem) { .claims { grid-template-columns: 1fr; gap: 1.8rem; } }
  .claim { text-align: left; }
  .claim h3 { font-family: var(--body); font-weight: 650; font-size: .95rem;
              letter-spacing: 0; margin: 0 0 .35rem; padding-top: .7rem;
              border-top: 2px solid var(--line); }
  .claim:nth-child(4n+1) h3 { border-top-color: var(--flame); }
  .claim:nth-child(4n+2) h3 { border-top-color: var(--gold); }
  .claim:nth-child(4n+3) h3 { border-top-color: var(--teal); }
  .claim:nth-child(4n+4) h3 { border-top-color: var(--deep); }
  .claim p { margin: 0; font-size: .93rem; line-height: 1.6; color: var(--muted);
             max-width: none; }
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
  /* ---- product screenshots ---- */
  /* Chromeless: a hairline and a warm shadow, which is what the app's own
     .paper is. No drawn browser frame — the product is the picture. */
  .shot { width: 100%; height: auto; display: block; border-radius: 10px;
          border: 1px solid var(--line); background: var(--bg);
          box-shadow: 0 1px 2px rgba(27,20,16,.05), 0 18px 40px -24px rgba(27,20,16,.28); }
  .shot-figure { margin: 0; }
  .shot-figure figcaption { color: var(--muted); font-size: .9rem; line-height: 1.5;
                            margin-top: .85rem; max-width: 46ch; }

  /* One wide shot leading, two beneath it. Collapses to a stack on a phone,
     where a two-up grid would render both at postage-stamp size. */
  .shots { display: grid; gap: 2.5rem; margin-top: 2.5rem; }
  .shots-pair { display: grid; gap: 2.5rem; align-items: start; }
  @media (min-width: 60rem) { .shots-pair { grid-template-columns: 1fr 1fr; } }
  /*
   * A pair whose two shots are not the same shape.
   *
   * Equal columns made the public page — a document crop, nearly square —
   * tower over the facilitator beside it, and the captions landed a hundred
   * points apart. The fractions are the two aspect ratios, so both images
   * render at the same height and the row reads as one thing.
   */
  @media (min-width: 60rem) {
    .shots-pair.duo { grid-template-columns: 0.96fr 1.42fr; }
  }

  /* The phone shot sits beside prose rather than filling the column. */
  .shot-phone { display: grid; gap: 2rem; align-items: center; }
  @media (min-width: 52rem) { .shot-phone { grid-template-columns: 20rem 1fr; } }
  .shot-phone .shot { border-radius: 18px; }

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
  .creed .wide { position: relative; }
  /* max-width:none as well as the centring: .eyebrow is a <p>, so it inherits
     the 34rem measure and a centred line inside a left-hugging 34rem block
     lands well left of the heading it belongs to. */
  .creed .eyebrow { color: var(--gold); text-align: center; margin-inline: auto;
                    max-width: none; }
  .creed h2 { color: var(--ink-fg); margin: .4rem 0 3.5rem; text-align: center; }

  .creed-grid { list-style: none; padding: 0; margin: 0; display: grid; gap: 3rem 2.5rem;
                grid-template-columns: repeat(4, minmax(0, 1fr)); }
  @media (max-width: 68rem) { .creed-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
  @media (max-width: 40rem) { .creed-grid { grid-template-columns: 1fr; gap: 2.2rem; } }

  /* The number carries the colour, so the rule above it can stay quiet. */
  .creed-n { display: block; font-family: var(--display); font-size: .95rem;
             letter-spacing: .06em; padding-bottom: .7rem; margin-bottom: .9rem;
             border-bottom: 1px solid rgba(255,246,236,.18); }
  .creed-grid li:nth-child(1) .creed-n { color: var(--flame); }
  .creed-grid li:nth-child(2) .creed-n { color: var(--gold); }
  .creed-grid li:nth-child(3) .creed-n { color: var(--teal); }
  .creed-grid li:nth-child(4) .creed-n { color: #6d8cf0; }

  .creed-grid h3 { font-family: var(--display); font-weight: 500;
                   font-size: clamp(1.15rem, 1.5vw, 1.35rem); line-height: 1.25;
                   color: var(--ink-fg); margin: 0 0 .7rem; letter-spacing: -.01em; }
  .creed-grid p { margin: 0; max-width: none; font-size: .93rem; line-height: 1.65;
                  color: rgba(255,246,236,.62); }

  /* ---- the six tools converging ---- */
  .merge { position: relative; height: 400px; margin: 2.5rem 0 1rem; overflow: hidden;
           border-radius: 14px;
           background: radial-gradient(75% 70% at 50% 50%, rgba(240,165,44,.14), transparent 72%); }
  /*
   * Scoped to .merge, and the scoping is a bug fix rather than tidiness.
   *
   * It was a bare selector, so every element with that class anywhere on the
   * page was absolutely positioned, 8.6rem wide and painted vermillion —
   * including a dozen feature cards in three later sections, which piled up as
   * coloured pills half off the left edge. A decorative selector that reads
   * like a generic name will be reused; scoping it means it cannot be.
   */
  .merge .tool { position: absolute; transform-origin: center; width: 8.6rem;
          margin-left: -4.3rem;
          margin-top: -1.05rem; border-radius: 999px; padding: .42rem .7rem; font-size: .78rem;
          text-align: center; font-weight: 600; color: #fff; will-change: transform; }
  .merge .tool:nth-child(1) { background: var(--flame); }
  .merge .tool:nth-child(2) { background: var(--gold); color: #3a2a06; }
  .merge .tool:nth-child(3) { background: var(--teal); }
  .merge .tool:nth-child(4) { background: var(--deep); }
  .merge .tool:nth-child(5) { background: #8b3fb5; }
  .merge .tool:nth-child(6) { background: #d4356f; }
  .merge-mark { position: absolute; left: 50%; top: 50%; width: 124px; height: 124px;
                margin: -62px 0 0 -62px; will-change: transform, opacity; }
  @media (max-width: 34rem) {
    .merge { height: 330px; }
    .merge .tool { width: 6.6rem; margin-left: -3.3rem; font-size: .7rem; }
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

  footer { border-top: 1px solid var(--line); margin-top: 7rem; padding-top: 3.5rem;
           padding-bottom: 3rem; font-size: .9rem; color: var(--muted); }
  footer a { color: var(--muted); text-decoration: none; }
  footer a:hover { color: var(--fg); }

  .foot-top { display: grid; gap: 3rem; }
  @media (min-width: 56rem) {
    .foot-top { grid-template-columns: 2fr 1fr 1fr; gap: 4rem; }
  }
  .foot-brand .wordmark { font-family: var(--display); font-size: 1.25rem; color: var(--fg);
                          display: flex; align-items: center; gap: .55rem;
                          margin-bottom: .9rem; letter-spacing: -.01em; }
  .foot-brand p { max-width: 32ch; margin: 0; line-height: 1.6; }
  .foot-links { display: flex; flex-direction: column; gap: .55rem; align-items: flex-start; }
  .foot-links h2 { font-family: var(--body); font-size: .75rem; font-weight: 650;
                   letter-spacing: .09em; text-transform: uppercase; color: var(--fg);
                   margin: 0 0 .35rem; }

  .foot-bottom { display: flex; flex-wrap: wrap; justify-content: space-between; gap: .6rem 2rem;
                 border-top: 1px solid var(--line); margin-top: 3.5rem; padding-top: 1.5rem; }
  .foot-bottom p { margin: 0; max-width: none; }

  /* ---- copy beside a figure ---- */
  .split { display: grid; gap: 3rem; align-items: center; }
  @media (min-width: 64rem) { .split { grid-template-columns: 1fr 1fr; gap: 4.5rem; } }
  /* Left-ragged: this half is an argument being read, not a section heading. */
  .split-copy h2 { text-align: left; margin-inline: 0; max-width: 18ch; }
  .split-copy p { text-align: left; margin-inline: 0; max-width: 42ch; }
  /*
   * width:100% is load-bearing. Every child of .merge is absolutely
   * positioned, so the element has no intrinsic width, and as a grid item it
   * collapsed to zero — a 400-point-tall column of nothing beside the copy.
   */
  .split .merge { margin: 0; width: 100%; height: 420px; }

  /* ---- the closing pair: what we publish, what it costs ---- */
  .closing { display: grid; gap: 4rem; align-items: start; }
  @media (min-width: 62rem) { .closing { grid-template-columns: 1fr 1fr; gap: 5rem; } }
  /* Left-ragged, because these two columns are read rather than scanned — the
     centred spine above is for section headings, not for a comparison. */
  .closing-col h2 { text-align: left; margin: .3rem 0 1.4rem; max-width: none; }
  .closing-col > p { max-width: none; }

  .ticks { list-style: none; padding: 0; margin: 0 0 1.6rem; }
  .ticks li { position: relative; padding-left: 1.6rem; margin-bottom: .7rem;
              line-height: 1.5; }
  .ticks li::before { content: ''; position: absolute; left: 0; top: .62em;
                      width: .55rem; height: .55rem; border-radius: 2px;
                      background: var(--teal); }

  .price-card { border: 1px solid var(--line); border-radius: 16px; padding: 2rem 1.9rem;
                background: var(--bg); }
  .price-free { font-family: var(--display); font-size: 1.9rem; line-height: 1.1;
                margin: 0 0 .5rem; max-width: none; }
  .price-card .muted { max-width: none; margin: 0 0 .3rem; }
  .price-rule { height: 1px; background: var(--line); margin: 1.5rem 0; }
  .price-take { font-weight: 650; margin: 0 0 .35rem; max-width: none; }
  .price-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 1.5rem;
                   margin-top: 1.8rem; }

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
        <header class="wide">
          <nav>
            <a class="wordmark" href="/">
              <Mark size={22} />
              Coram
            </a>
            <a class="drop" href="/why">Why</a>
            <a class="drop" href="/pricing">Pricing</a>
            <a class="drop" href="/security">Security</a>
            <a class="drop" href="/trust">Trust</a>
            <a class="cta" href="/demo">See the demo</a>
          </nav>
        </header>
        {props.children}
        {/*
          A footer with something in it.

          It was one run-on line of five links and a sentence, in a container
          narrower than the page, which read as the place the design stopped.
          The links were already grouped in the reader's head — what the product
          is, and how we can be held to it — so they are grouped on the page,
          and the closed-source line gets its own rule at the bottom where a
          colophon belongs.
        */}
        <footer class="wide">
          <div class="foot-top">
            <div class="foot-brand">
              <a class="wordmark" href="/">
                <Mark size={22} />
                Coram
              </a>
              <p>
                The operating system for grassroots organizing. Eleven modules, one record of who
                your people are, and as little held about them as the work allows.
              </p>
            </div>

            <nav class="foot-links" aria-label="Product">
              <h2>Product</h2>
              <a href="/why">Why we built it</a>
              <a href="/pricing">Pricing</a>
              <a href="/demo">See the demo</a>
              <a href="/app">Start free</a>
            </nav>

            <nav class="foot-links" aria-label="Accountability">
              <h2>Accountability</h2>
              <a href="/trust">Trust</a>
              <a href="/security">Security</a>
              <a href="/canary.txt">Warrant canary</a>
              <a href="/terms">Acceptable use</a>
              {/* RFC 9116 wants it discoverable; a buyer wants the prose page
                  above it, which is why this is last rather than alone. */}
              <a href="/.well-known/security.txt">security.txt</a>
            </nav>
          </div>

          <div class="foot-bottom">
            <p class="small">Coram is closed source. We publish audits instead of code.</p>
            <p class="small">No trackers on this page, or on any other.</p>
          </div>
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
  { name: 'Petitio', line: 'Write the bill, find who can file it, log what each office said.', demo: 'rows' },
  { name: 'Thesaurus', line: 'Fundraising, dues, and escrowed mutual aid and bail funds.', demo: 'bars' },
  { name: 'Colloquium', line: 'Encrypted internal channels that expire on their own.', demo: 'send' },
  { name: 'Consilium', line: 'Proposals, quorum, and five ways to vote.', demo: 'bars' },
  { name: 'Custos', line: 'Legal observer intake and jail support.', demo: 'shield' },
  { name: 'Scriba', line: 'Drafting and translation from a private model, with names stripped first.', demo: 'text' },
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
            {/* Ahead of "why we built this": someone deciding whether to care
                would rather click around a working workspace than read an
                essay. */}
            <a class="cta-ghost" href="/demo">
              See a real workspace
            </a>
          </div>
        </div>
      </section>

      {/* 2. The problem — six tools drift, collide, merge into the mark. */}
      {/*
        Copy on one side, the diagram on the other.

        Stacked, this was a narrow column of three paragraphs with a 400-point
        square of mostly empty space under it — the reader scrolled past the
        argument to reach the picture of the argument. Side by side they are
        read at once, which is the only reason the diagram is there.
      */}
      <div class="wide section split">
        <div class="split-copy">
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
        </div>

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
                /*
                 * 30/34 rather than 23/28. The stage is half its old width now
                 * that the copy sits beside it, and at the tighter spread the
                 * six labels crowded the mark while the left and right edges
                 * of the box stayed empty.
                 */
                style={`left:${50 + Math.cos(angle) * 30}%;top:${50 + Math.sin(angle) * 34}%`}
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
      {/*
        Four commitments across, not four bullets down.
        
        This was a <ul> of four slogans set at a 22-character measure in the
        middle of a full-bleed dark band — a slide deck's worth of type in a
        field of black, with coloured dots doing the only work. Four short
        claims laid across the band, each with the sentence that makes it
        checkable, is the same content composed rather than listed.

        Every supporting line restates something already promised elsewhere on
        the site — §10 on trackers, Federatio's totals-only parent, the free
        tier, the waiver in a database function. Nothing here is a new claim.
      */}
      <section class="creed">
        <div class="wide">
          <p class="eyebrow">The commitments</p>
          <h2>What we owe you</h2>
          <ol class="creed-grid" data-motion="stagger">
            <li>
              <span class="creed-n">01</span>
              <h3>We do not surveil the people who use this.</h3>
              <p>
                No analytics in the product, no open tracking, no click tracking. Engagement is
                what an organizer wrote down, never what we watched.
              </p>
            </li>
            <li>
              <span class="creed-n">02</span>
              <h3>Decisions stay at the smallest competent level.</h3>
              <p>
                A coalition parent sees totals and never a member. What an organizer can reach is
                bounded in the database, not by a setting somebody can move.
              </p>
            </li>
            <li>
              <span class="creed-n">03</span>
              <h3>The free tier is not a funnel. It is the point.</h3>
              <p>
                Free under 250 contacts with all eleven modules. Not a trial, not feature-gated,
                and no card to start.
              </p>
            </li>
            <li>
              <span class="creed-n">04</span>
              <h3>We take nothing from bail funds and mutual aid.</h3>
              <p>
                One percent on fundraising and dues. Zero here — and the waiver is written into a
                database function rather than a settings page.
              </p>
            </li>
          </ol>
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

      {/*
        5a. The product, photographed.

        Everything above this point is an argument. These are the thing itself,
        captured from the demo workspace at 2x with no browser frame — a drawn
        window around a screenshot is decoration that dates immediately.
      */}
      <div class="wide section">
        <h2>This is the whole of it</h2>
        <p class="lead">
          Screenshots of the real product, not a mockup. Everyone in them is invented — you can
          sign in to the same workspace from <a href="/demo">the demo</a> and press every button.
        </p>

        <div class="shots">
          <ShotFigure id="shot-overview" sizes="(min-width: 72rem) 68rem, 94vw" />

          <div class="shots-pair">
            <ShotFigure id="shot-advocacy" sizes="(min-width: 60rem) 33rem, 94vw" />
            <ShotFigure id="shot-relationships" sizes="(min-width: 60rem) 33rem, 94vw" />
          </div>

          <div class="shots-pair">
            <ShotFigure id="shot-money" sizes="(min-width: 60rem) 33rem, 94vw" />
            <ShotFigure id="shot-safety" sizes="(min-width: 60rem) 33rem, 94vw" />
          </div>
        </div>
      </div>

      {/*
        5b. The studio, which is the newest thing and the easiest to explain by
        showing rather than describing.
      */}
      <div class="wide section">
        <h2>It also makes the flyer</h2>
        <p class="lead">
          A group with no designer either makes something in Word that looks like it was made in
          Word, or makes nothing. That is the difference between twelve people at a meeting and
          forty, so it is in the product rather than on a list of things you should also buy.
        </p>

        <div class="shots">
          <ShotFigure id="shot-studio" sizes="(min-width: 72rem) 68rem, 94vw" />
        </div>

        <div class="claims">
          <div class="claim">
            <h3>Your colours, checked</h3>
            <p>
              A palette that fails contrast is not a style choice, it is a flyer nobody reads in a
              badly lit corridor. Coram refuses to save one and names the pair that failed.
            </p>
          </div>
          <div class="claim">
            <h3>Backgrounds, never people</h3>
            <p>
              Texture, an empty hall, a street at dusk. Never an invented face — a made-up member
              on a real group's flyer is a claim somebody has to defend on a doorstep.
            </p>
          </div>
          <div class="claim">
            <h3>Said in the languages on the block</h3>
            <p>
              Twelve languages, drafted in seconds so a bilingual member spends two minutes rather
              than an hour. It says plainly that those two minutes are not optional.
            </p>
          </div>
          <div class="claim">
            <h3>We do not post for you</h3>
            <p>
              A token that can post as your union is a subpoena target and something a platform can
              revoke. You get the file and the words; you press send.
            </p>
          </div>
        </div>
      </div>

      {/*
        5b-ii. The watch list.

        Sold on the failure it prevents rather than on the word "AI". The
        interesting claim here is not that a model writes two sentences — it is
        that the model is not allowed to decide what you are shown, and that a
        broken feed says so instead of going quiet. Both are on the page because
        both are what separates this from a newsletter.
      */}
      <div class="wide section">
        <h2>And tells you what moved</h2>
        <p class="lead">
          The rent board meets on a Tuesday, the agenda goes up eleven days before, and nobody in
          your group is refreshing a municipal website at 4pm. That is how a hearing passes
          unopposed — not because anybody decided to skip it.
        </p>

        <div class="shots">
          <ShotFigure id="shot-watch" sizes="(min-width: 72rem) 68rem, 94vw" />
        </div>

        <div class="claims">
          <div class="claim">
            <h3>Your words, not our guess</h3>
            <p>
              You give it "eviction", "rent board", a bill number. Anything containing them appears
              — every one, in full. A word has to appear as a word, so "rent" does not match
              "current".
            </p>
          </div>
          <div class="claim">
            <h3>The model sorts. It never filters.</h3>
            <p>
              Two sentences of plain English and a relevance score, to help you triage a long
              morning. Nothing is ever hidden because a machine scored it low — the one it would
              drop is the hearing with the boring title.
            </p>
          </div>
          <div class="claim">
            <h3>A broken feed says so</h3>
            <p>
              A council that changes its agenda URL looks exactly like a quiet month. Every source
              shows when it last worked and what went wrong, because being quietly wrong about this
              is worse than not offering it.
            </p>
          </div>
          <div class="claim">
            <h3>One click to a room full of people</h3>
            <p>
              A hearing becomes an event with an RSVP list; a bill becomes a draft of your own. The
              watch item is deleted after ninety days — a feed is not an archive, and what you keep
              is what you made from it.
            </p>
          </div>
        </div>
      </div>

      {/*
        5b-iii. The paper and the front door.

        Three things that are not modules and are the reason a group can
        actually use the eleven: a page strangers can read, a sheet a canvasser
        can carry, and a document an aide will read in four minutes. Sold on
        the refusals, because the refusals are what is unusual: the page is off
        until you write it, the walk list does not exist, and the stack is
        never sent anywhere.
      */}
      <div class="wide section">
        <h2>And the paper, and the front door</h2>
        <p class="lead">
          Most of organizing happens away from a screen — in a hallway with a clipboard, in a
          committee room with four minutes of somebody's attention, in a church hall with thirty
          people and a facilitator trying to get through the agenda.
        </p>

        <div class="shots" style="margin-top:2.5rem">
          <div class="shots-pair duo">
            <ShotFigure id="shot-public" sizes="(min-width: 60rem) 27rem, 94vw" />
            <ShotFigure id="shot-facilitate" sizes="(min-width: 60rem) 40rem, 94vw" />
          </div>
        </div>

        <div class="claims">
          <div class="claim">
            <h3>A page anyone can read</h3>
            <p>
              Who you are and what is coming up, at an address of your own. Off until a steward
              writes it — publishing that a political group exists is a disclosure only that group
              can make, so nothing is generated on your behalf and nothing defaults to on.
            </p>
          </div>
          <div class="claim">
            <h3>A 404 that gives nothing away</h3>
            <p>
              An unpublished workspace and a name nobody has taken return the identical page.
              Somebody guessing at likely addresses learns whether a page is published and nothing
              whatever about who is here and chose not to publish.
            </p>
          </div>
          <div class="claim">
            <h3>There is no walk list</h3>
            <p>
              We hold no street addresses — a postal code is the finest location on any record, and
              that is permanent. So there is no door-order list, and the screen says so rather than
              letting you hunt for it. What prints is our half: who is on your list and what is
              owed to them. Phone numbers are a checkbox, not a default.
            </p>
          </div>
          <div class="claim">
            <h3>The stack never leaves the room</h3>
            <p>
              Run a meeting with a time against each item and a speaking stack. The agenda is
              saved; the stack is not, and no route in this product would accept it — a record of
              who was in a room and how much each of them said is the most damaging document a
              group could make about itself.
            </p>
          </div>
        </div>
      </div>

      <Band
        id="phone-bank"
        caption="Nobody's number leaves the room. The list does not follow anyone home."
      />

      {/* 5c. It has to work on a phone, because that is where organizing happens. */}
      <div class="wide section">
        <div class="shot-phone">
          <ShotFigure id="shot-mobile" sizes="(min-width: 52rem) 20rem, 70vw" />
          <div>
            <h2>Built for a corridor</h2>
            <p>
              Every screen works on the phone somebody already has, because that is where a
              check-in happens, where a follow-up gets logged, and where somebody looks up what to
              say when an officer is at the door. Nothing here is a desktop tool with a mobile
              apology bolted on.
            </p>
            <p class="muted small">
              No app to install, nothing to update, and nothing that keeps running in the
              background. It is a website, which is also the only version that cannot be pulled
              from a store.
            </p>
          </div>
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

      {/*
        7. Trust and price, side by side, because they are the same question.

        These were two short blocks stacked down a 46rem column, which made the
        end of the page a long thin ribbon of prose and put four hundred points
        of nothing beside it. Somebody deciding at the bottom of a page is
        weighing "can I rely on them" against "what does it cost me", and the
        two are read together or not at all.
      */}
      <div class="wide section closing">
        <div class="closing-col">
          <p class="eyebrow">Accountability</p>
          <h2>What we publish</h2>
          <ul class="ticks">
            <li>An annual security audit in full, including what we have not fixed</li>
            <li>A semiannual transparency report</li>
            <li>A quarterly warrant canary</li>
            <li>Documentation for taking everything with you</li>
          </ul>
          <p>
            Every one carries a live date, and the page flags itself when something is overdue.{' '}
            <a href="/trust">See where they stand</a> — including the ones we have not published
            yet.
          </p>
        </div>

        <div class="closing-col">
          <p class="eyebrow">Price</p>
          <h2>What it costs</h2>
          <div class="price-card">
            <p class="price-free">Free under 250 contacts</p>
            <p class="muted">
              All eleven modules. Not a trial, not feature-gated, and no card to start.
            </p>
            <div class="price-rule" />
            <p class="price-take">1% on fundraising and dues. Zero on bail and mutual aid.</p>
            <p class="muted small">
              The waiver is written into a database function, not a settings page.
            </p>
            <div class="price-actions">
              <a class="cta" href="/app">
                Start free <span aria-hidden="true">→</span>
              </a>
              <a href="/pricing">Full pricing</a>
            </div>
          </div>
        </div>
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
    // Added when the studio shipped. §8.3's table is the spec's, and these two
    // rows are honest additions rather than a thumb on the scale: the named
    // competitors do have some templating, which is why the cells say Partial.
    ['Flyer and social design', 'Yes', 'Partial', 'No', 'Partial', 'Partial'],
    ['Translation into your neighbourhood', 'Yes', 'No', 'No', 'No', 'No'],
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
      </main>

      <Band
        id="coffee-urn"
        caption="The budget for most of this is whatever was in the tin at the last meeting."
      />

      <main class="col">

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

      <Band
        id="folding-chairs"
        caption="Forty chairs and a room booked for an hour is still how most of this starts."
      />
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

      <Band
        id="whiteboard"
        caption="The plan, before anyone typed it up. This is the artefact the product is trying to keep."
      />

      <main class="col">
        <p class="muted small">
          Every photograph on this site is of people from behind. That is not a style choice — it
          is the same argument the product makes, made in pictures.
        </p>
      </main>
    </Page>,
  ),
);

// ---------------------------------------------------------------------------
// /terms — acceptable use
// ---------------------------------------------------------------------------

/*
 * Rendered from src/shared/policy.ts rather than written here, so the page and
 * the tested registry cannot drift apart. The tests that keep this honest —
 * conduct not belief, protections named, limits published — live beside it.
 */
marketing.get('/terms', (c) =>
  c.html(
    <Page
      title="Acceptable use — Coram"
      description="What Coram will not host, what it explicitly protects, and how enforcement actually works."
    >
      <main class="col editorial">
        <h1>Acceptable use</h1>
        <p class="lead">
          Two lists. What we will not host, and what we will not remove you for. The second one
          matters as much as the first.
        </p>

        <p>
          Most of this product is built so that we cannot see what you do with it. That is the
          point, and it has a consequence worth stating before anything else: we are not
          watching. What follows is what we do when something is brought to us, and what we
          will refuse to do no matter who brings it.
        </p>

        <h2>What we will not host</h2>
        <p class="muted small">
          Every rule below describes conduct — something a person does. None describes a belief,
          a movement, or a designation. That is deliberate.
        </p>
        {PROHIBITED.map((rule) => (
          <div class="card">
            <h3 style="color:var(--warn)">{rule.title}</h3>
            <p style="margin:.35rem 0 .5rem">{rule.rule}</p>
            <p class="muted small" style="margin:0">
              {rule.why}
            </p>
          </div>
        ))}

        <h2>What we will not remove you for</h2>
        <p>
          Everything below has been reported to some platform, by someone, as violence or
          extremism, in order to get an organisation removed. Naming them here means a report
          citing one gets this page as its answer.
        </p>
        {PROTECTED.map((rule) => (
          <div class="card" style="border-color:rgba(18,133,122,.4)">
            <h3 style="color:var(--teal)">{rule.title}</h3>
            <p style="margin:.35rem 0 .5rem">{rule.rule}</p>
            <p class="muted small" style="margin:0">
              {rule.why}
            </p>
          </div>
        ))}

        <h2>What we can actually see</h2>
        <ul>
          {LIMITS.map((line) => (
            <li>{line}</li>
          ))}
        </ul>

        <h2>How a report is handled</h2>
        <ol>
          {ENFORCEMENT.map((line) => (
            <li style="margin-bottom:.6rem">{line}</li>
          ))}
        </ol>

        {/* Stated here because the section above says enforcement cannot be
            proactive. That remains true of content we hold; it is not true of
            a request made to us directly, and the difference should be on the
            page rather than discovered. */}
        <p>
          There is one thing that is not report-driven. Coram&rsquo;s writing assistant refuses to
          draft the material above, before any model sees the request, from the same list of rules
          this page is rendered from. It is a narrow control — it applies only to what you ask us
          to write, not to what you store — and it is the one place we are not a bystander.
        </p>

        <div class="highlight">
          <p style="margin:0">
            Report specific conduct to <strong>{ABUSE_CONTACT}</strong>.
          </p>
          <p class="muted small" style="margin:.4rem 0 0">
            Name the workspace and describe what was done. Reports that describe a group rather
            than an act get no action.
          </p>
        </div>

        <h2>The part we are least comfortable with</h2>
        <p>
          A policy like this is enforced by people, and people can be leaned on. The protections
          above are the ones most likely to be tested by a government, a landlord, or an
          employer with a lawyer. We have written them down so that giving way would be a
          visible reversal rather than a quiet judgement call.
        </p>
        <p>
          If we ever do give way, the counts will appear in the{' '}
          <a href="/trust">transparency report</a>, and you will be able to see it.
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

      </main>

      <Band
        id="sign-in-sheet"
        caption="A sheet on a table is still the most common database in this movement. This is what we are asking you to trust us with instead."
      />

      <main class="col">
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
// /demo
// ---------------------------------------------------------------------------

/**
 * A working workspace, seeded with a group that does not exist.
 *
 * Everyone in it is invented — names from a fixed word list, streets that are
 * not real, phone numbers in the 555-01xx fictional block, and addresses at
 * example.org, which RFC 2606 reserves and which cannot receive mail. That last
 * one is load-bearing rather than fussy: Nuntius sends things, and a demo full
 * of plausible addresses at real domains is one bad environment variable away
 * from mailing strangers.
 *
 * The login is an `organizer` (§4.1). It was an observer, which sees no
 * individual contact records at all — technically the most cautious choice and
 * in practice a demo that rendered a correct permission boundary on nearly
 * every screen, so a visitor came away thinking the product did nothing.
 *
 * An organizer is also the role most people evaluating Coram would hold. It
 * reaches the turf-scoped list, the follow-up queue, events, shifts, drafts and
 * channels, and it does not reach the steward's ground: destroying the
 * workspace, changing roles, approving money, or the legal role's jail-support
 * cases. A stranger cannot burn this, and the screens that are out of reach
 * explain the access model instead of erroring — which is worth seeing.
 */
marketing.get('/demo', (c) =>
  c.html(
    <Page
      title="Try it — Coram"
      description="A working Coram workspace, seeded with a tenants' union that does not exist."
    >
      <main class="col">
        <h1>See the whole thing</h1>
        <p class="lead">
          A real workspace, not a video. It belongs to the Eastside Tenants Union, who do not
          exist, and you sign in as one of their organizers.
        </p>

        <div class="highlight">
          <p style="margin:0">
            <strong>{DEMO_EMAIL}</strong> · <strong>{DEMO_PASSWORD}</strong>
          </p>
          <p class="muted small" style="margin:.4rem 0 0">
            An organizer's account. You can add people, log a conversation, draft a bill and open
            a channel — and you cannot destroy the workspace, change anyone's role, or approve a
            payment, because organizers cannot.
          </p>
        </div>

        <p>
          <a class="cta" href="/app">
            Open the demo <span aria-hidden="true">→</span>
          </a>
        </p>

        <h2>What is in there</h2>
        <ul>
          <li>240 contacts across three turfs, so you can see what turf scoping actually does.</li>
          <li>Four events — two already held, two coming — with 180 RSVPs and carpool offers.</li>
          <li>A proposal the union adopted, and the ballot that carried it.</li>
          <li>An eviction defence fund, which on the real product is charged no fee at all.</li>
          <li>A draft ordinance at the seeking-a-sponsor stage, with three endorsements, and a
            log of what three council offices said back.</li>
          <li>
            The studio: make a flyer or a social card in the union's colours, generate a
            background, and translate the whole thing into a dozen languages.
          </li>
          <li>Five follow-ups owed to real-feeling people, one of them snoozed four times.</li>
          <li>Shifts on the hearing with the door still unstaffed, and a message in the drafts.</li>
        </ul>

        <h2>What you will not see, and why</h2>
        <ul>
          <li>
            <strong>Jail support cases.</strong> §5.9 gives those to the legal role and to nobody
            else — not stewards by default, not organizers. The panel explains the boundary rather
            than showing an error, and that explanation is the feature.
          </li>
          <li>
            <strong>Contacts outside the demo account's turfs, and the steward's screens.</strong>
            Turf and role scoping happen in the database, so what you can reach here is genuinely
            what an organizer can reach — not a UI that hides buttons.
          </li>
          <li>
            <strong>Channel messages and organiser notes.</strong> Both are encrypted in your
            browser with a passphrase we never hold, so there is no way for us to seed them —
            which is the point. A demo showing readable &ldquo;encrypted&rdquo; messages would be
            lying about the hardest thing to believe.
          </li>
        </ul>

        <p class="muted small">
          Everyone in the demo is fictional. If you want to see it with your own data, the free
          tier is the whole product up to a contact limit — see <a href="/pricing">pricing</a>.
        </p>
      </main>
    </Page>,
  ),
);

// ---------------------------------------------------------------------------
// /security
// ---------------------------------------------------------------------------

/**
 * The security posture in prose a buyer can read.
 *
 * Before this the entire security surface was a footer link to security.txt —
 * a file that tells a researcher where to send a report and tells a prospective
 * customer nothing. Rendered from src/shared/security.ts so the page and the
 * claims cannot drift apart.
 *
 * Every control carries how to verify it, and the second half is what we do not
 * have. That ordering is deliberate: a reader who finds the gap themselves
 * stops believing the first half.
 */
marketing.get('/security', (c) =>
  c.html(
    <Page
      title="Security — Coram"
      description="How Coram is built, what it can see, and what it does not have."
    >
      <main class="col">
        <h1>Security</h1>
        <p class="lead">
          The argument for this product is that it holds less than the alternative. Here is what
          that means concretely, how you could check it, and where it falls short.
        </p>

        <h2>What is actually in place</h2>
        {CONTROLS.map((ctl) => (
          <div class="card">
            <h3 style="margin-top:0">{ctl.title}</h3>
            <p style="margin-bottom:.5rem">{ctl.claim}</p>
            <p class="muted small" style="margin:0">
              <strong>How you would check:</strong> {ctl.verify}
            </p>
          </div>
        ))}

        <h2>What we can still see</h2>
        <ul>
          {LIMITS.map((line) => (
            <li>{line}</li>
          ))}
        </ul>

        <h2>What we do not have</h2>
        <p>
          This half is the point. Every security page lists controls; the ones worth trusting say
          what is missing.
        </p>
        {ABSENT.map((gap) => (
          <div class="card">
            <h3 style="margin-top:0">{gap.title}</h3>
            <p style="margin-bottom:.5rem">{gap.claim}</p>
            <p class="muted small" style="margin:0">
              {gap.verify}
            </p>
          </div>
        ))}

        <h2>Reporting a vulnerability</h2>
        <p>
          <a href={`mailto:${DISCLOSURE.contact}`}>{DISCLOSURE.contact}</a>, or the details in{' '}
          <a href={DISCLOSURE.wellKnown}>security.txt</a>.
        </p>
        <ul>
          {DISCLOSURE.commitments.map((line) => (
            <li>{line}</li>
          ))}
        </ul>

        <p class="muted small">
          Published artifacts — audits, the transparency report, the warrant canary — are on{' '}
          <a href="/trust">/trust</a>, which flags its own staleness rather than waiting to be
          asked.
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
