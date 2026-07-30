/**
 * Sign in once for the whole run.
 *
 * Not an optimisation. Login is rate limited to 8 attempts per 15 minutes per
 * IP (LOGIN_LIMIT), and a GitHub runner is one IP — the first version of this
 * suite signed in inside every test, which is five tests across two projects,
 * so the ninth and tenth logins got a 429 and the last test failed with
 * "Eastside Tenants Union not found". The control was working exactly as
 * designed and the tests were the thing at fault.
 *
 * Worth keeping the limit in mind rather than raising it: eight attempts a
 * quarter hour is a reasonable defence for a product whose users are plausible
 * targets for credential stuffing, and no test is worth weakening it.
 *
 * The saved cookie is reused by every other spec. Login itself is still
 * exercised — demo.spec.ts keeps one test that drives the form and one that
 * uses the demo button — because a suite that only ever replays a cookie would
 * stop noticing that signing in had broken.
 */

import { expect, test as setup } from '@playwright/test';

import { DEMO_EMAIL, DEMO_PASSWORD } from '../src/shared/demo';

const STATE = 'e2e/.auth/demo.json';

setup('sign in once', async ({ page }) => {
  await page.goto('/app/login');
  await page.getByLabel('Email').fill(DEMO_EMAIL);
  await page.getByLabel('Password').fill(DEMO_PASSWORD);
  await page.getByRole('button', { name: /^sign in$/i }).click();

  // Wait for the workspace to render, not just for the URL to change: a URL
  // says the router moved, and says nothing about whether the session resolved.
  await expect(page.getByText('Eastside Tenants Union')).toBeVisible({ timeout: 30_000 });

  await page.context().storageState({ path: STATE });
});
