import { test, expect } from '@playwright/test';
import { requireEnv } from '../helpers/env';
import { loginAsQAUser } from '../helpers/auth';
import { goTo } from '../helpers/nav';

test.describe('Help: load & interact', () => {
  test('help page loads', async ({ page }) => {
    const baseUrl = requireEnv('QA_DEFAULT_BASE_URL');
    await page.goto(baseUrl);
    await loginAsQAUser(page);

    await goTo(page, 'nav-help', 'help');
    await expect(page.locator('[data-testid="help-root"]')).toBeVisible({ timeout: 20_000 });
  });

  test('help page has navigable content sections', async ({ page }) => {
    const baseUrl = requireEnv('QA_DEFAULT_BASE_URL');
    await page.goto(baseUrl);
    await loginAsQAUser(page);

    await goTo(page, 'nav-help', 'help');
    await expect(page.locator('[data-testid="help-root"]')).toBeVisible({ timeout: 20_000 });

    const content = page.locator('[data-testid*="faq"]')
      .or(page.locator('[data-testid*="help-section"]'))
      .or(page.locator('[role="accordion"]'))
      .or(page.locator('details'))
      .or(page.locator('input[placeholder*="Search"]'))
      .or(page.locator('h2'))
      .first();
    await expect(content).toBeVisible({ timeout: 15_000 });
  });
});
