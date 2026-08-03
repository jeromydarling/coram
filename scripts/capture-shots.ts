/**
 * Capture the product screenshots the marketing site uses.
 *
 * Runs in CI, because the development container reaches the network through an
 * agent proxy Chromium cannot traverse — every navigation returns
 * ERR_CONNECTION_RESET. A GitHub runner has ordinary egress.
 *
 *   npx tsx scripts/capture-shots.ts [--base https://coram.jer-f84.workers.dev]
 *
 * Writes PNGs to shots/marketing/. A second step derives the AVIF and WebP the
 * site actually serves and uploads them to R2; see scripts/upload-shots.ts.
 *
 * ---------------------------------------------------------------------------
 * The demo account and nothing else
 * ---------------------------------------------------------------------------
 *
 * Every credential here comes from src/shared/demo.ts. There is deliberately no
 * way to point this at another workspace: a screenshot of a real group's
 * contacts on a public marketing page would be the single most embarrassing
 * thing this product could do, and "be careful" is not a control. shots.test.ts
 * is the second lock.
 *
 * ---------------------------------------------------------------------------
 * Waiting properly
 * ---------------------------------------------------------------------------
 *
 * Every shot names a string that only appears once its data has arrived. A
 * screenshot taken mid-load is a picture of skeleton rectangles, and at
 * thumbnail size on a marketing page it looks plausible enough that nobody
 * notices for a month. Missing that string is a hard failure rather than a
 * warning, because a silently-bad picture is worse than no picture.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { chromium, type Browser } from '@playwright/test';

import { DEMO_EMAIL, DEMO_PASSWORD } from '../src/shared/demo';
import { SHOTS } from '../src/shared/shots';

const OUT = 'shots/marketing';

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? (process.argv[i + 1] ?? fallback) : fallback;
}

const BASE = arg('base', process.env.E2E_BASE_URL ?? 'https://coram.jer-f84.workers.dev');

async function signIn(browser: Browser) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  const page = await context.newPage();

  await page.goto(`${BASE}/app/login`, { waitUntil: 'domcontentloaded' });
  await page.getByLabel('Email').fill(DEMO_EMAIL);
  await page.getByLabel('Password').fill(DEMO_PASSWORD);
  await page.getByRole('button', { name: /^sign in$/i }).click();

  /*
   * Wait for a sidebar link, not for the workspace name.
   *
   * The sign-in page's own copy mentions the Eastside Tenants Union, so waiting
   * for that string passes against the *failure* page — which is exactly how
   * the browser suite once saved a session-less cookie and reported that the
   * product had no screens. A module link only exists inside the shell.
   */
  await page.getByRole('link', { name: /People\s+Membra/ }).first().waitFor({ timeout: 45_000 });

  const state = await context.storageState();
  await context.close();
  return state;
}

async function main() {
  await mkdir(OUT, { recursive: true });

  const browser = await chromium.launch();
  const storageState = await signIn(browser);
  console.log(`Signed in to ${BASE} as ${DEMO_EMAIL}.`);

  const failures: string[] = [];

  for (const shot of SHOTS) {
    const context = await browser.newContext({
      storageState,
      viewport: shot.viewport,
      // Retina. The site serves these at half their captured width, so the
      // 1280-wide file is genuinely 2560 pixels of detail on a laptop screen.
      deviceScaleFactor: 2,
      // A screenshot is a still. Anything with a caret in it looks like a
      // mistake, and §8.4 keeps the product still anyway.
      reducedMotion: 'reduce',
      isMobile: shot.viewport.width < 600,
      hasTouch: shot.viewport.width < 600,
    });
    const page = await context.newPage();

    try {
      await page.goto(`${BASE}${shot.route}`, { waitUntil: 'domcontentloaded' });

      if (new URL(page.url()).pathname.includes('/login')) {
        throw new Error('bounced to the sign-in page — the session did not survive');
      }

      await page.getByText(shot.settled, { exact: false }).first().waitFor({ timeout: 45_000 });

      // Queries settle at slightly different times; a beat here is the
      // difference between a figure and an em dash.
      await page.waitForTimeout(1_200);

      // Viewport rather than fullPage: the crop is the viewport, which is what
      // makes these chromeless without any cropping step afterwards.
      const buffer = await page.screenshot({ fullPage: false });
      await writeFile(`${OUT}/${shot.id}.png`, buffer);
      console.log(`  ${shot.id}  ${shot.viewport.width}×${shot.viewport.height}  ${buffer.length} bytes`);
    } catch (error) {
      failures.push(`${shot.id}: ${(error as Error).message}`);
      console.error(`  ${shot.id}  FAILED — ${(error as Error).message}`);
    } finally {
      await context.close();
    }
  }

  await browser.close();

  if (failures.length) {
    // Exit non-zero so the workflow goes red. A half-captured set that silently
    // succeeds means the site keeps serving whatever was there before, and
    // nobody finds out until the copy and the picture disagree.
    console.error(`\n${failures.length} shot(s) failed:\n${failures.join('\n')}`);
    process.exit(1);
  }

  console.log(`\n${SHOTS.length} shots written to ${OUT}/.`);
}

await main();
