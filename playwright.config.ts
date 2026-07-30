/**
 * Browser tests, which run in CI rather than locally.
 *
 * Not a preference. The development container reaches the network through an
 * agent proxy that Chromium cannot traverse — every navigation returns
 * ERR_CONNECTION_RESET — so a browser check written to run here would be a
 * browser check that never runs. A GitHub runner has ordinary egress.
 *
 * These drive the deployed site rather than a local build, because the failure
 * that made this file necessary was invisible to every local check: /app was a
 * placeholder for weeks while the API, the schema and 600 unit tests were all
 * green. Only opening the deployed product would have caught it, and nothing
 * opened it.
 */

import { defineConfig, devices } from '@playwright/test';

const BASE = process.env.E2E_BASE_URL ?? 'https://coram.jer-f84.workers.dev';

export default defineConfig({
  testDir: './e2e',
  // The deploy propagates across edges for a minute or so after `wrangler
  // deploy`, which showed up all session as a first request returning the
  // previous version. Retrying absorbs that rather than making it look like a
  // product bug.
  retries: process.env.CI ? 2 : 0,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: BASE,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    // Organizers use this on a phone, in a hallway, between doors. If it only
    // works at 1440px it does not work.
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
});
