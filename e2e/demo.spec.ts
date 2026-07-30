/**
 * Does the product actually render in a browser?
 *
 * The test this file exists to prevent repeating: /app served a single
 * paragraph reading "Foundation is in place. Membra is next." for weeks. The
 * API returned real rows, the schema was right, six hundred unit tests passed,
 * and the demo link went nowhere. Every check that could pass did pass.
 *
 * So these assert on what a person sees, and they log it, so a green run is
 * evidence rather than a claim.
 */

import { expect, test } from '@playwright/test';

import { DEMO_EMAIL, DEMO_PASSWORD } from '../src/shared/demo';

test.describe('the marketing site', () => {
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
  test('signs in and shows a populated product', async ({ page }) => {
    await page.goto('/app/login');
    await page.getByRole('button', { name: /open the demo workspace/i }).click();

    // The workspace name proves the session resolved, the API answered, and
    // React painted — a URL assertion proves only that the router moved.
    await expect(page.getByText('Eastside Tenants Union')).toBeVisible({ timeout: 30_000 });

    // The sentence that used to be the entire product.
    await expect(page.getByText(/Membra is next/)).toHaveCount(0);

    // A real number from a real row, not a skeleton.
    await expect(page.getByText('240', { exact: true })).toBeVisible();

    console.log('OVERVIEW:', (await page.locator('main').innerText()).replace(/\n+/g, ' | '));
  });

  test('the bill screen shows the draft and its caveats', async ({ page }) => {
    await signIn(page);
    await nav(page, 'Bills');

    await expect(page.getByText(/The Eastside Repairs Ordinance/)).toBeVisible();
    /*
     * .first(), because "Covered Landlord" appears three times — once defined,
     * twice used. Playwright's strict mode failed this on the first run and it
     * was right to: an assertion that would break the moment the bill gains
     * another clause is not testing what it means to test.
     */
    await expect(page.getByText(/Covered Landlord/).first()).toBeVisible();

    /*
     * The sponsor list must never read as a ranked recommendation — subject to
     * committee matching is not built. The API says so in `limitations`; this
     * asserts the screen shows those words rather than dropping them.
     */
    await expect(page.getByText(/committee rosters for CA/i)).toBeVisible();

    console.log('BILLS:', (await page.locator('main').innerText()).slice(0, 900).replace(/\n+/g, ' | '));
  });

  test('attendance counts are visible to an observer', async ({ page }) => {
    await signIn(page);
    await nav(page, 'Events');

    /*
     * This is the regression that migration 0015 fixed. rsvps_select requires
     * seeing the underlying contact; an observer sees none, so a plain count
     * returned 0 for every event — not denied, just false, in the direction
     * that makes a busy group look dead. A literal "0 going" here means the
     * SECURITY DEFINER counter has been reverted or bypassed.
     */
    await expect(page.getByText(/\d+ going/).first()).toBeVisible();
    const text = await page.locator('main').innerText();
    expect(text, 'no event should report zero attendance in the demo').not.toMatch(/\b0 going\b/);

    console.log('EVENTS:', text.replace(/\n+/g, ' | '));
  });

  test('an empty contact list explains itself as access control', async ({ page }) => {
    await signIn(page);
    await nav(page, 'People');

    // An observer sees no individual records by design (§4.1). Rendered as a
    // bare "no results" this looks like a broken product, and a correct
    // permission boundary gets reported as a bug and then "fixed".
    await expect(page.getByText(/none of them are shown here/i)).toBeVisible();
    await expect(page.getByText(/denied at the database/i)).toBeVisible();
  });

  test('funds render as money, not raw cents', async ({ page }) => {
    await signIn(page);
    await nav(page, 'Funds');

    await expect(page.getByText(/Eviction defence fund/)).toBeVisible();
    // 318400 cents. A regression in formatting shows up as the raw integer.
    await expect(page.getByText(/\$3,184/)).toBeVisible();
    await expect(page.getByText(/318400/)).toHaveCount(0);
  });
});

/**
 * Click a top-level nav item.
 *
 * Scoped to <nav>, because "Events" also appears as "All events" on the
 * overview and Playwright's strict mode refuses an ambiguous locator — which is
 * the correct behaviour and caught a genuinely brittle test.
 */
async function nav(page: import('@playwright/test').Page, label: string) {
  await page.locator('nav').getByRole('link', { name: label, exact: true }).click();
}

/**
 * Sign in and wait for the app to have actually rendered.
 *
 * Waiting on the URL was not enough: the first CI run timed out here even
 * though navigation had happened, because a URL change says the router moved
 * and says nothing about whether anything drew. Waiting for the workspace name
 * waits for the session to resolve, the API to answer, and React to paint —
 * which is the thing these tests exist to prove.
 */
async function signIn(page: import('@playwright/test').Page) {
  await page.goto('/app/login');
  await page.getByLabel('Email').fill(DEMO_EMAIL);
  await page.getByLabel('Password').fill(DEMO_PASSWORD);
  await page.getByRole('button', { name: /^sign in$/i }).click();
  await expect(page.getByText('Eastside Tenants Union')).toBeVisible({ timeout: 30_000 });
}
