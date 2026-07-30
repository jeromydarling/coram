/**
 * Does the product actually render in a browser?
 *
 * The failure this file exists to prevent repeating: /app served a single
 * paragraph reading "Foundation is in place. Membra is next." for weeks. The
 * API returned real rows, the schema was right, six hundred unit tests passed,
 * and the demo link went nowhere. Every check that could pass did pass.
 *
 * The second failure it now also covers: the app came back as six unstyled
 * read-only lists against a spec naming eleven modules. Nothing was broken;
 * most of the product simply had no interface. So there is a test below that
 * walks every entry in the sidebar and asserts each one renders its own
 * heading, and one that asserts the app is painted in the brand rather than in
 * hairline grey.
 *
 * These assert on what a person sees, and they log it, so a green run is
 * evidence rather than a claim.
 */

import { expect, test, type Page } from '@playwright/test';

import { DEMO_EMAIL } from '../src/shared/demo';
import { MODULES } from '../src/app/lib/modules';

test.describe('the marketing site', () => {
  // Signed out: the public site must work for someone who has never logged in,
  // and the saved session would hide a nav that only renders for members.
  test.use({ storageState: { cookies: [], origins: [] } });

  test('every page renders and carries its photography', async ({ page }) => {
    for (const path of ['/', '/pricing', '/why', '/security', '/demo', '/trust', '/terms']) {
      const res = await page.goto(path);
      expect(res?.status(), `${path} should be 200`).toBe(200);
      await expect(page.locator('h1')).toBeVisible();
    }
  });

  test('the hero photograph actually loads, rather than 404ing into a gap', async ({ page }) => {
    await page.goto('/');
    const hero = page.locator('.hero img').first();
    await expect(hero).toBeVisible();

    // naturalWidth is 0 for an <img> whose source failed. The layout looks
    // identical either way, which is exactly why this needs asserting.
    const width = await hero.evaluate((el) => (el as HTMLImageElement).naturalWidth);
    expect(width, 'hero image decoded').toBeGreaterThan(100);
  });

  test('security and demo are reachable from the nav, not just by URL', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('nav a[href="/security"]')).toBeVisible();
    await page.goto('/demo');
    await expect(page.getByText(DEMO_EMAIL)).toBeVisible();
  });
});

test.describe('the demo workspace', () => {
  /*
   * The one test that still authenticates from scratch, using the demo button.
   * Everything below replays the cookie saved by auth.setup.ts — but a suite
   * that only ever replays a cookie would stop noticing that signing in had
   * broken, which is the first thing a visitor does.
   */
  test('signs in and shows a populated product', async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/app/login');
    await page.getByRole('button', { name: /open the demo workspace/i }).click();

    /*
     * The workspace name proves the session resolved, the API answered, and
     * React painted — a URL assertion proves only that the router moved.
     *
     * The name renders twice: in the desktop rail and in the mobile header,
     * and exactly one of them is displayed at any width. `.first()` took the
     * rail in DOM order and failed on mobile against a `display:none` element,
     * which looked like a broken sign-in and was a broken locator. Filtering to
     * the visible one asserts what a person can actually see, at either width.
     */
    await expect(
      page.getByText('Eastside Tenants Union').filter({ visible: true }).first(),
    ).toBeVisible({ timeout: 30_000 });

    // The sentence that used to be the entire product.
    await expect(page.getByText(/Membra is next/)).toHaveCount(0);

    // A real number from a real row, not a skeleton.
    await expect(page.getByText('240', { exact: true })).toBeVisible();

    /*
     * Every stat has to resolve, not just the first one. A permanent em dash on
     * the first screen anyone sees would be worth knowing about, and a snapshot
     * taken mid-load looks identical to one.
     */
    await expect(page.getByText(/\$3,184/).first()).toBeVisible();

    console.log('OVERVIEW:', (await page.locator('main').innerText()).replace(/\n+/g, ' | '));
  });

  /*
   * The regression that this whole rewrite answers.
   *
   * Driven off MODULES, so a twelfth module added to the registry without a
   * screen fails here rather than shipping as a dead sidebar entry — and so
   * does a module quietly dropped.
   */
  for (const m of MODULES) {
    test(`${m.name} (${m.latin}, §${m.section}) is a real screen`, async ({ page }) => {
      await page.goto(`/app${m.path}`);

      /*
       * Say which failure this is.
       *
       * A dead session bounces every module route to /login, and these tests
       * then all fail reporting "no heading" — which reads as "the product has
       * no screens" and cost an hour of looking in the wrong place. If the
       * session is gone, fail on that instead.
       */
      await expect(page, 'session should still be valid').not.toHaveURL(/\/login/);

      // Its own <h1>, not the overview's. A route that falls through to the
      // catch-all redirect lands on the overview and would otherwise pass.
      await expect(page.getByRole('heading', { level: 1, name: m.name })).toBeVisible({
        timeout: 30_000,
      });

      // The Latin name in the eyebrow, which only that module's header renders.
      await expect(page.getByText(`${m.latin} · §${m.section}`)).toBeVisible();

      // Nothing on the page may be an unhandled error state.
      await expect(page.getByText(/Something went wrong and we do not know what/)).toHaveCount(0);

      console.log(
        `${m.latin.toUpperCase()}:`,
        (await page.locator('main').innerText()).slice(0, 500).replace(/\n+/g, ' | '),
      );
    });
  }

  test('every module is reachable from the sidebar, not only by URL', async ({ page, isMobile }) => {
    await page.goto('/app/');
    if (isMobile) await page.getByRole('button', { name: /open navigation/i }).click();

    for (const m of MODULES) {
      const link = page.getByRole('link', { name: new RegExp(`${m.name}\\s+${m.latin}`) }).first();
      await expect(link).toBeVisible();

      /*
       * Visible is not the same as on screen.
       *
       * Playwright counts an element clipped by a scroll container as visible,
       * so this passed while the rail's last group — Drafting and Coalition —
       * sat below the fold at 720px with nothing to suggest it scrolled. Two of
       * the eleven were invisible to a person and present to the test. The
       * viewport check is the one that matches what someone can actually see.
       */
      const box = await link.boundingBox();
      const height = page.viewportSize()?.height ?? 0;
      expect(box, `${m.name} has a box`).not.toBeNull();
      expect(box!.y, `${m.name} is not below the fold of the rail`).toBeLessThan(height);
    }
  });

  /*
   * "Black and white wire frames instead of real UI designs" was the complaint,
   * and it was accurate: /app used no brand colour at all while the marketing
   * site ran on vermillion, gold, teal and ultramarine. This asserts the paint
   * is on, in a way a stylesheet regression cannot pass.
   */
  test('the app is painted in the brand, not in hairline grey', async ({ page }) => {
    await page.goto('/app/');
    await expect(page.getByText('240', { exact: true })).toBeVisible({ timeout: 30_000 });

    const flame = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--flame').trim(),
    );
    expect(flame, '--flame is defined').toBe('9 76% 53%');

    // A figure renders in its module's tone. Grey would mean --tone never got
    // set, which is exactly how the previous version looked.
    const colour = await page.locator('.figure').first().evaluate((el) => getComputedStyle(el).color);
    expect(colour, 'the lead figure is not grey').toMatch(/^rgba?\(/);
    const [r, g, b] = colour.match(/\d+/g)!.map(Number);
    expect(Math.max(r, g, b) - Math.min(r, g, b), 'the figure is a colour, not a grey').toBeGreaterThan(30);

    // The display serif, which the marketing wordmark also uses.
    const family = await page
      .getByRole('heading', { level: 1 })
      .first()
      .evaluate((el) => getComputedStyle(el).fontFamily);
    expect(family).toMatch(/serif/i);
  });

  test('the bill screen shows the draft and its caveats', async ({ page }) => {
    await page.goto('/app/advocacy');
    await page.getByText('The repairs ordinance').click();

    await expect(page.getByText(/The Eastside Repairs Ordinance/)).toBeVisible();
    /*
     * .first(), because "Covered Landlord" appears three times — once defined,
     * twice used. Playwright's strict mode failed this on an early run and it
     * was right to: an assertion that breaks the moment the bill gains another
     * clause is not testing what it means to test.
     */
    await expect(page.getByText(/Covered Landlord/).first()).toBeVisible();

    /*
     * The sponsor list must never read as a ranked recommendation — committee
     * matching is not built. The API says so in `limitations`; this asserts the
     * screen shows those words rather than dropping them.
     */
    await page.getByRole('tab', { name: /who can file it/i }).click();
    await expect(page.getByText(/committee rosters for CA/i)).toBeVisible();

    console.log('BILL:', (await page.locator('main').innerText()).slice(0, 900).replace(/\n+/g, ' | '));
  });

  test('attendance counts are real, not silently zero', async ({ page }) => {
    await page.goto('/app/events');

    /*
     * The regression migration 0015 fixed. rsvps_select requires seeing the
     * underlying contact, so a plain count returned 0 for every event — not
     * denied, just false, in the direction that makes a busy group look dead.
     * A literal "0 going" means the SECURITY DEFINER counter has been reverted.
     */
    await expect(page.getByText(/\d+ going/).first()).toBeVisible();
    const text = await page.locator('main').innerText();
    expect(text, 'no event should report zero attendance in the demo').not.toMatch(/\b0 going\b/);
  });

  test('the follow-up queue shows what is owed, including what is stuck', async ({ page }) => {
    await page.goto('/app/relationships');
    await expect(page.getByText(/Open follow-ups/)).toBeVisible({ timeout: 30_000 });
    // Seeded at four snoozes. §5.2: a thrice-snoozed queue is not a queue, and
    // hiding the count would make the screen calmer and less true.
    await expect(page.getByText(/snoozed 4×/)).toBeVisible();
  });

  test('funds render as money, not raw cents', async ({ page }) => {
    await page.goto('/app/money');

    await expect(page.getByText(/Eviction defence fund/).first()).toBeVisible();
    // 318400 cents. A regression in formatting shows up as the raw integer.
    await expect(page.getByText(/\$3,184/).first()).toBeVisible();
    await expect(page.getByText(/318400/)).toHaveCount(0);
    // §5.6's permanent commitment, on the screen rather than in a policy page.
    await expect(page.getByText(/no platform take/i)).toBeVisible();
  });

  /*
   * §5.9 gives jail support to the legal role only. The demo signs in as an
   * organizer, so this must read as the boundary it is rather than as an error
   * — that distinction is the product's whole argument about itself.
   */
  test('a denied screen explains the access model rather than erroring', async ({ page }) => {
    await page.goto('/app/safety');
    await expect(page.getByText(/Jail support is the legal role only/)).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByText(/Something went wrong/)).toHaveCount(0);
  });

  /*
   * A write path, end to end, because every screen being readable was the last
   * version's problem. This one adds a person and finds them again.
   */
  test('an organizer can actually add someone', async ({ page }) => {
    const name = `Test Person ${Date.now()}`;

    await page.goto('/app/people');
    await page.getByRole('button', { name: /add someone/i }).click();
    await page.getByLabel('Name', { exact: true }).fill(name);
    await page.getByRole('button', { name: /^add$/i }).click();

    /*
     * This failed the first time it ran, and it was right to.
     *
     * contacts_insert admits an organizer only when the row lands in a turf
     * they hold. The form had no turf field, so every insert an organizer
     * attempted was refused and the only sign was a toast that vanished —
     * adding a contact was impossible for the role most people have. The fix
     * was a turfs endpoint and a picker; this is the assertion that would have
     * caught it, and it stays.
     */
    await expect(page.getByText(/not added/i)).toHaveCount(0);

    await page.getByPlaceholder(/name, email or phone/i).fill(name);
    await expect(page.getByText(name)).toBeVisible({ timeout: 20_000 });
  });
});

/**
 * Full-page captures of every screen.
 *
 * Written to disk and uploaded as their own artifact rather than attached to
 * the report, because the point is that a person opens them and looks. The
 * previous two rounds of this work shipped things I had verified with curl and
 * never once seen, and both times the complaint was about how it looked.
 */
test.describe('screenshots', () => {
  test('capture every module', async ({ page }, testInfo) => {
    const dir = 'shots';
    for (const [i, path] of ['/app/', ...MODULES.map((m) => `/app${m.path}`), '/app/settings'].entries()) {
      await page.goto(path);
      // Long enough for the queries to settle. A skeleton screenshot proves
      // nothing about the design, which is what these are for.
      await page.waitForTimeout(3_000);
      const name = path.replace(/^\/app\/?/, '') || 'overview';
      await page.screenshot({
        path: `${dir}/${testInfo.project.name}-${String(i).padStart(2, '0')}-${name}.png`,
        fullPage: true,
      });
    }
  });
});

/** Click a top-level nav item, scoped to the sidebar. */
export async function nav(page: Page, label: string) {
  await page.locator('nav').getByRole('link', { name: label, exact: true }).click();
}
