import { test, expect } from '@playwright/test';
import { requireEnv } from '../helpers/env';
import { loginAsQAUser } from '../helpers/auth';
import { goTo } from '../helpers/nav';

test.describe('Radar: load & interact', () => {
  test('radar page loads', async ({ page }) => {
    const baseUrl = requireEnv('QA_DEFAULT_BASE_URL');
    await page.goto(baseUrl);
    await loginAsQAUser(page);

    await goTo(page, 'nav-radar', 'radar');
    await expect(page.locator('[data-testid="radar-root"]'))
      .toBeVisible({ timeout: 20_000 });
  });

  test('radar shows partner cards or search', async ({ page }) => {
    const baseUrl = requireEnv('QA_DEFAULT_BASE_URL');
    await page.goto(baseUrl);
    await loginAsQAUser(page);

    await goTo(page, 'nav-radar', 'radar');
    await expect(page.locator('[data-testid="radar-root"]')).toBeVisible({ timeout: 20_000 });

    const interactive = page.locator('[class*="card"]')
      .or(page.locator('input[type="search"]'))
      .or(page.locator('input[placeholder*="Search"]'))
      .or(page.locator('[data-testid*="filter"]'))
      .or(page.locator('[data-testid*="radar-card"]'))
      .first();
    await expect(interactive).toBeVisible({ timeout: 15_000 });
  });
});
