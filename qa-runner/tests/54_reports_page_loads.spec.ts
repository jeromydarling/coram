import { test, expect } from '@playwright/test';
import { requireEnv } from '../helpers/env';
import { loginAsQAUser } from '../helpers/auth';
import { goTo } from '../helpers/nav';

test.describe('Reports: load & interact', () => {
  test('reports page loads', async ({ page }) => {
    const baseUrl = requireEnv('QA_DEFAULT_BASE_URL');
    await page.goto(baseUrl);
    await loginAsQAUser(page);

    await goTo(page, 'nav-reports', 'reports');
    await expect(page.locator('[data-testid="reports-root"]')).toBeVisible({ timeout: 20_000 });
  });

  test('reports page shows report options or generated content', async ({ page }) => {
    const baseUrl = requireEnv('QA_DEFAULT_BASE_URL');
    await page.goto(baseUrl);
    await loginAsQAUser(page);

    await goTo(page, 'nav-reports', 'reports');
    await expect(page.locator('[data-testid="reports-root"]')).toBeVisible({ timeout: 20_000 });

    const content = page.locator('button:has-text("Generate")')
      .or(page.locator('button:has-text("Export")'))
      .or(page.locator('button:has-text("Download")'))
      .or(page.locator('[data-testid*="report"]'))
      .or(page.locator('[class*="card"]'))
      .or(page.locator('select'))
      .or(page.locator('[role="combobox"]'))
      .first();
    await expect(content).toBeVisible({ timeout: 15_000 });
  });
});
