import { test, expect } from '@playwright/test';
import { requireEnv } from '../helpers/env';
import { loginAsQAUser } from '../helpers/auth';
import { goTo } from '../helpers/nav';

test.describe('Intelligence: load & interact', () => {
  test('intelligence page loads', async ({ page }) => {
    const baseUrl = requireEnv('QA_DEFAULT_BASE_URL');
    await page.goto(baseUrl);
    await loginAsQAUser(page);

    // Intelligence uses testId "nav-analytics" in the sidebar
    await goTo(page, 'nav-analytics', 'intelligence');
    await expect(page.locator('[data-testid="intelligence-root"]')).toBeVisible({ timeout: 20_000 });
  });

  test('intelligence renders cards or metrics', async ({ page }) => {
    const baseUrl = requireEnv('QA_DEFAULT_BASE_URL');
    await page.goto(baseUrl);
    await loginAsQAUser(page);

    await goTo(page, 'nav-analytics', 'intelligence');
    await expect(page.locator('[data-testid="intelligence-root"]')).toBeVisible({ timeout: 20_000 });

    const viz = page.locator('svg')
      .or(page.locator('[class*="recharts"]'))
      .or(page.locator('[class*="chart"]'))
      .or(page.locator('[data-testid*="metric"]'))
      .or(page.locator('[data-testid*="chart"]'))
      .or(page.locator('[class*="card"]'))
      .first();
    await expect(viz).toBeVisible({ timeout: 15_000 });
  });
});
