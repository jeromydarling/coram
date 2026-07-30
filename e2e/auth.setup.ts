/**
 * Sign in once for the whole run.
 *
 * Not an optimisation. Login is rate limited to 8 attempts per 15 minutes per
 * IP (LOGIN_LIMIT), and a GitHub runner is one IP — the first version of this
 * suite signed in inside every test, so the ninth and tenth logins got a 429
 * and the last test failed with "Eastside Tenants Union not found". The control
 * was working exactly as designed and the tests were the thing at fault.
 *
 * Worth keeping the limit in mind rather than raising it: eight attempts a
 * quarter hour is a reasonable defence for a product whose users are plausible
 * targets for credential stuffing, and no test is worth weakening it.
 *
 * ---------------------------------------------------------------------------
 * What this file must never do again.
 *
 * It used to wait for the text "Eastside Tenants Union" and treat that as proof
 * of a session. Then the sign-in page gained a paragraph describing the demo —
 * "a workspace belonging to the Eastside Tenants Union, who do not exist" — and
 * the success check became satisfiable by the failure page. Two workflow runs
 * overlapped, the limiter refused the login, the error rendered, the assertion
 * found its string in the error state's own copy, and setup passed in 677ms
 * without a session. Every test that replayed the saved cookie was then bounced
 * to /login, and twenty-two of them failed reporting that the product had no
 * screens — when the product was fine.
 *
 * A successful login takes seconds, because PBKDF2 runs 600,000 iterations.
 * 677ms was the tell and nothing was watching for it.
 *
 * So the assertions below wait for something the signed-out page cannot
 * possibly render, and the check is explicitly negative about /login.
 * ---------------------------------------------------------------------------
 */

import { expect, test as setup } from '@playwright/test';

import { DEMO_EMAIL, DEMO_PASSWORD } from '../src/shared/demo';

const STATE = 'e2e/.auth/demo.json';

setup('sign in once', async ({ page }) => {
  await page.goto('/app/login');
  await page.getByLabel('Email').fill(DEMO_EMAIL);
  await page.getByLabel('Password').fill(DEMO_PASSWORD);
  await page.getByRole('button', { name: /^sign in$/i }).click();

  // The sidebar exists only inside the authenticated shell, and its links carry
  // both names. No signed-out page renders this.
  await expect(page.getByRole('link', { name: /People\s+Membra/ }).first()).toBeVisible({
    timeout: 30_000,
  });

  // Belt and braces: the router must actually have left the login route. If a
  // future redesign puts a module-shaped link on the sign-in page, this still
  // catches it.
  await expect(page).not.toHaveURL(/\/login/);

  // And the sign-in form itself must be gone, which rules out the case where
  // login failed and the page merely rendered an error beneath the form.
  await expect(page.getByRole('button', { name: /^sign in$/i })).toHaveCount(0);

  await page.context().storageState({ path: STATE });
});
