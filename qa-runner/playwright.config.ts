/**
 * playwright.config.ts — Playwright configuration for QA runner.
 *
 * WHAT: Configures Playwright test execution for the CROS QA suite.
 * WHERE: qa-runner/playwright.config.ts
 * WHY: Enables running individual spec files with proper timeouts,
 *       BrowserBase integration, and JSON reporting for result parsing.
 */
import { defineConfig } from '@playwright/test';

const browserbaseApiKey = process.env.BROWSERBASE_API_KEY;
const browserbaseProjectId = process.env.BROWSERBASE_PROJECT_ID;

// Pre-flight: log connection mode so crashes are diagnosable
// BrowserBase is opt-in: set USE_BROWSERBASE=true to enable (prevents timeout failures in CI)
const useBrowserBase = process.env.USE_BROWSERBASE === 'true' && !!(browserbaseApiKey && browserbaseProjectId);
console.log(`[playwright.config] BrowserBase: ${useBrowserBase ? 'ENABLED' : 'DISABLED (local browser)'}`);
if (useBrowserBase) {
  console.log(`[playwright.config] Project ID: ${browserbaseProjectId}`);
  console.log(`[playwright.config] API Key present: ${!!browserbaseApiKey}`);
}

// Resolve base URL from either env var name
const resolvedBaseUrl = process.env.QA_DEFAULT_BASE_URL || process.env.BASE_URL;
if (!resolvedBaseUrl) {
  console.error('[playwright.config] FATAL: Missing required env var: QA_DEFAULT_BASE_URL (or BASE_URL)');
}

export default defineConfig({
  testDir: './tests',
  timeout: 90_000,
  globalTimeout: 210_000, // Must exceed the longest test (180s for Stripe E2E) + teardown buffer
  expect: { timeout: 20_000 },
  retries: 0,
  workers: 1,
  reporter: [
    ['json', { outputFile: process.env.PLAYWRIGHT_JSON_OUTPUT_FILE || 'test-results.json' }],
    ['list'], // Also show progress in CI logs
  ],
  use: {
    baseURL: resolvedBaseUrl || 'https://thecros.lovable.app',
    screenshot: 'on',
    trace: 'off',
    ...(useBrowserBase
      ? {
          connectOptions: {
            wsEndpoint: `wss://connect.browserbase.com?apiKey=${browserbaseApiKey}&projectId=${browserbaseProjectId}`,
            timeout: 60_000, // 60s connection timeout for BrowserBase
          },
        }
      : {}),
  },
});
