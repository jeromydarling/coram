import { test, expect } from '@playwright/test';
import { requireEnv } from '../helpers/env';
import { loginAsQAUser } from '../helpers/auth';
import { goTo } from '../helpers/nav';

test.describe('Core smoke: Dashboard → Opportunities', () => {
  test('open opportunities list', async ({ page }) => {
    const baseUrl = requireEnv('QA_DEFAULT_BASE_URL');
    await page.goto(baseUrl);
    await loginAsQAUser(page);

    // Accept either command-center-root or dashboard-root after login
    await expect(
      page.locator('[data-testid="command-center-root"]')
        .or(page.locator('[data-testid="dashboard-root"]'))
    ).toBeVisible({ timeout: 20_000 });

    await goTo(page, 'nav-opportunities', 'opportunities');

    // Either a table/list root or page title should exist.
    const pageRoot = page.locator('[data-testid="opportunities-page"], [data-testid="opportunities-root"], h1:has-text("Opportunities")').first();
    await expect(pageRoot).toBeVisible({ timeout: 20_000 });

    // Let async content finish rendering before screenshot
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
  });
});
