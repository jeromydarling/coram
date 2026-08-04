/**
 * Marketing-site motion (§8.4).
 *
 * Framer Motion only, via its DOM API — no React on the marketing site at all.
 * §8 asks for "static-first with hydrated islands" and an LCP under 1.5s, and
 * hydrating React to run four animations would spend most of that budget on a
 * framework that renders nothing.
 *
 * `animate` comes from `framer-motion/dom/mini`, which drives the Web
 * Animations API and therefore only handles compositable properties —
 * transform and opacity. That is exactly what every animation on this page
 * touches, and it costs a third of what the full `animate` does (12kB gzipped
 * against 33kB). Everything here is written in `transform` strings rather than
 * framer-motion's independent `x`/`scale` shorthands, because the mini
 * renderer hands values to WAAPI largely as written.
 *
 * The load-bearing rule here, and the reason this file reads oddly:
 *
 *   **The server renders every section in its FINISHED state.**
 *
 * So the page is correct with JavaScript disabled, correct if this bundle
 * 404s, and correct under `prefers-reduced-motion` — where we return early and
 * touch nothing. §8.4 demands "a real static fallback, not a zero-duration
 * transition", and the only way to be sure of that is for the fallback to be
 * what the server already sent. Animations therefore begin by moving elements
 * *away* from their final state, then bring them back.
 *
 * Nothing here runs inside /app. §8.4: the product is calm; the marketing site
 * moves.
 */

import { animate } from 'framer-motion/dom/mini';
import { inView, scroll } from 'framer-motion/dom';

const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * §8.1 hero: "Slow Ken Burns push-in."
 *
 * Applied to the wrapper, not the <img>, so the server-rendered LCP image is
 * never re-created or re-decoded. 24 seconds and 6% is under the threshold
 * where the eye reads it as movement rather than as a photograph that happens
 * to be alive.
 */
function kenBurns() {
  for (const el of document.querySelectorAll<HTMLElement>('[data-motion="ken-burns"]')) {
    animate(
      el,
      { transform: ['scale(1.02) translateY(0px)', 'scale(1.09) translateY(-2%)'] },
      { duration: 26, ease: 'linear', repeat: Infinity, repeatType: 'mirror' },
    );
  }
}

/**
 * §8.1 "The problem": six tool-shaped cards separate out of one point as the
 * section arrives, driven by scroll.
 *
 * ---------------------------------------------------------------------------
 * This used to run backwards, and it broke the rule at the top of this file
 * ---------------------------------------------------------------------------
 *
 * The server renders the six cards scattered and legible, at the positions
 * their inline `left`/`top` put them. The animation ended at
 * `scale(0.3)` with `opacity: 0` — so scrolling the section into view shrank
 * every card to nothing, and anyone who scrolled to it and stopped was looking
 * at an empty box with a mark in it. The finished state of the animation was a
 * state the server never renders, which is exactly what the header of this
 * file says must not happen.
 *
 * So it is inverted. The cards begin pulled in toward the centre, small and
 * transparent, and scroll progress carries them out to precisely where the
 * server drew them: `translate(0, 0) scale(1)`, fully opaque. The resting
 * state, the no-JavaScript state and the reduced-motion state are now the same
 * picture — six tools, apart, which is the section's whole argument.
 *
 * `scroll()` is Framer Motion's own; §8.4 allows no scroll library beyond an
 * intersection observer, and this is not a third-party one. There is no scroll
 * hijacking — the page scrolls normally and the graphic reads the progress.
 */
function toolMerge() {
  const stage = document.querySelector<HTMLElement>('[data-motion="merge"]');
  if (!stage) return;

  const cards = Array.from(stage.querySelectorAll<HTMLElement>('[data-tool]'));
  if (!cards.length) return;

  const mark = stage.querySelector<HTMLElement>('[data-mark]');

  /*
   * Scatter distance is measured from the stage, not hard-coded. A fixed pixel
   * spread overflows the box on a narrow screen, and the cards end up drifting
   * across the copy of the section below — which is what a fixed 210px did.
   * The stage clips anyway, but content escaping its container is not something
   * to leave to a clip.
   */
  const spreadX = Math.min(stage.clientWidth * 0.19, 150);
  const spreadY = Math.min(stage.clientHeight * 0.2, 95);

  cards.forEach((card, i) => {
    // Evenly around a circle, so no card is privileged and the separation
    // reads as six things coming apart rather than a queue forming.
    const angle = (i / cards.length) * Math.PI * 2 - Math.PI / 2;

    /*
     * Negative, because these offsets pull the card *toward* the centre from
     * wherever the server drew it. The end of every keyframe list below is
     * translate(0,0) scale(1) — the untouched, server-rendered position.
     */
    const x = -Math.cos(angle) * spreadX;
    const y = -Math.sin(angle) * spreadY;
    const tilt = (i % 2 ? 1 : -1) * 12;

    scroll(
      animate(
        card,
        {
          transform: [
            `translate(${x}px, ${y}px) rotate(${tilt}deg) scale(0.45)`,
            `translate(${x * 0.4}px, ${y * 0.4}px) rotate(${tilt * 0.4}deg) scale(0.88)`,
            'translate(0px, 0px) rotate(0deg) scale(1)',
          ],
          opacity: [0, 0.85, 1],
        },
        { ease: 'easeOut' },
      ),
      /*
       * Finished by the time the stage's centre reaches two-thirds up the
       * viewport, so the six labels are readable for the whole time the
       * section is the thing being looked at — rather than resolving at the
       * last possible moment and only while scrolling past.
       */
      { target: stage, offset: ['start 90%', 'center 65%'] },
    );
  });

  if (mark) {
    /*
     * The mark is the point they came out of, so it is there first and stays.
     * It settles from slightly large rather than fading in, which reads as one
     * thing dividing rather than as a seventh element joining.
     */
    scroll(
      animate(
        mark,
        { opacity: [0.35, 1, 1], transform: ['scale(1.25)', 'scale(1.04)', 'scale(1)'] },
        { ease: 'easeOut' },
      ),
      { target: stage, offset: ['start 90%', 'center 65%'] },
    );
  }
}

/**
 * §8.1 module grid: "staggered fade-up on intersection observer."
 *
 * A fade-up has to hide its content first, which makes it the one animation on
 * this page that can leave the page worse than it found it: if the observer
 * never fires, eleven modules are invisible and the section is blank. That is
 * not hypothetical — it is what happened the first time this ran.
 *
 * So every reveal is also scheduled unconditionally. Worst case the cascade is
 * skipped and the cards appear together, which nobody will notice. There is no
 * case where they stay hidden.
 */
function staggerIn() {
  for (const grid of document.querySelectorAll<HTMLElement>('[data-motion="stagger"]')) {
    const items = Array.from(grid.children) as HTMLElement[];
    let revealed = false;

    const reveal = () => {
      if (revealed) return;
      revealed = true;
      items.forEach((item, i) => {
        animate(
          item,
          { opacity: 1, transform: 'translateY(0px) scale(1)' },
          // 60ms apart: enough to read as a cascade, short enough that the
          // eleventh card is not still arriving after the eye has moved on.
          { duration: 0.5, delay: i * 0.06, ease: [0.16, 1, 0.3, 1] },
        );
      });
    };

    for (const item of items) {
      item.style.opacity = '0';
      item.style.transform = 'translateY(22px) scale(0.97)';
    }

    inView(grid, reveal, { amount: 0.15 });

    // The failsafe. Long enough that it never pre-empts a real scroll into
    // view, short enough that a broken observer is invisible to the reader.
    setTimeout(reveal, 2500);
  }
}

/**
 * §8.1: each module card holds "a three-second looping micro-interaction demo,
 * not a screenshot."
 *
 * Each demo is a few bars, dots or rows in the card's SVG marked `[data-demo]`.
 * They only run while the card is on screen — eleven infinite loops animating
 * behind the fold is a battery cost with nobody watching.
 */
function microDemos() {
  for (const demo of document.querySelectorAll<HTMLElement>('[data-demo]')) {
    const parts = Array.from(demo.querySelectorAll<HTMLElement>('[data-demo-part]'));
    if (!parts.length) continue;

    let running: ReturnType<typeof animate>[] = [];

    inView(
      demo,
      () => {
        running = parts.map((part, i) =>
          animate(
            part,
            {
              opacity: [0.3, 1, 0.3],
              transform: [
                'scaleY(0.55) translateY(2px)',
                'scaleY(1) translateY(0px)',
                'scaleY(0.55) translateY(2px)',
              ],
            },
            {
              duration: 3,
              delay: i * 0.18,
              repeat: Infinity,
              ease: 'easeInOut',
            },
          ),
        );

        return () => {
          for (const animation of running) animation.stop();
          running = [];
        };
      },
      { amount: 0.4 },
    );
  }
}


/**
 * The rough underline under "One place."
 *
 * Stroked on rather than faded in, because a line that draws itself reads as a
 * hand and a line that fades reads as a transition. The server renders it fully
 * drawn — the dash offset lives in a CSS custom property that this overrides —
 * so with no JavaScript the mark is simply there.
 */
function underline() {
  for (const svg of document.querySelectorAll<SVGSVGElement>('[data-underline]')) {
    const path = svg.querySelector('path');
    if (!path) continue;

    const len = path.getTotalLength();
    path.style.setProperty('--len', String(len));
    path.style.strokeDasharray = String(len);
    path.style.strokeDashoffset = String(len);

    animate(
      path,
      { strokeDashoffset: [len, 0] },
      { duration: 0.9, delay: 0.45, ease: [0.22, 1, 0.36, 1] },
    );
  }
}

/**
 * Count the figures up when they scroll into view.
 *
 * Small numbers only — 11, 250, 1, 0 — so this counts in integers and lands
 * exactly on the value the server rendered. The element already contains the
 * final text, so a reader without JavaScript sees the number, not a zero.
 */
function figures() {
  for (const el of document.querySelectorAll<HTMLElement>('[data-count]')) {
    const target = Number(el.dataset.count ?? '0');
    const suffix = el.dataset.suffix ?? '';
    if (!Number.isFinite(target) || target === 0) continue;

    const final = el.textContent ?? '';
    let ran = false;

    inView(
      el,
      () => {
        if (ran) return;
        ran = true;
        const started = performance.now();
        const dur = 900;

        const tick = (now: number) => {
          const t = Math.min(1, (now - started) / dur);
          // easeOutCubic, so it decelerates onto the number rather than stopping.
          const eased = 1 - Math.pow(1 - t, 3);
          el.textContent = t < 1 ? `${Math.round(target * eased)}${suffix}` : final;
          if (t < 1) requestAnimationFrame(tick);
        };

        requestAnimationFrame(tick);
      },
      { amount: 0.6 },
    );
  }
}

function start() {
  // Everything below is enhancement. The server already sent a correct page.
  if (reduced()) return;

  kenBurns();
  underline();
  toolMerge();
  staggerIn();
  figures();
  microDemos();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', start, { once: true });
} else {
  start();
}
