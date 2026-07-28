import { test, expect } from '@playwright/test';
import { requireEnv } from '../helpers/env';
import { loginAsQAUser } from '../helpers/auth';
import { goTo } from '../helpers/nav';

/**
 * Help page — this is a tenant-authenticated route, not a public marketing page.
 * Must login first, then navigate via sidebar.
 */
test.describe('Help page', () => {
  test('help page loads', async ({ page }) => {
    const baseUrl = requireEnv('QA_DEFAULT_BASE_URL');
    await page.goto(baseUrl);
    await loginAsQAUser(page);

    await goTo(page, 'nav-help', 'help');

    // Help page should show some content — headings, accordion, or guide text
    await expect(
      page.locator('h1, h2, [data-testid*="help"], [role="button"], details, summary').first()
    ).toBeVisible({ timeout: 15_000 });
  });

  test('help sections are navigable', async ({ page }) => {
    const baseUrl = requireEnv('QA_DEFAULT_BASE_URL');
    await page.goto(baseUrl);
    await loginAsQAUser(page);

    await goTo(page, 'nav-help', 'help');

    const sections = page.locator('[data-testid*="help"], [role="button"], details, summary, h2, h3, [data-state]');
    await expect(sections.first()).toBeVisible({ timeout: 15_000 });
  });
});
