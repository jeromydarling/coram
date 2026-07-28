import { test, expect } from '@playwright/test';
import { requireEnv } from '../helpers/env';
import { loginAsQAUser } from '../helpers/auth';
import { goTo } from '../helpers/nav';

test.describe('Grants: list & detail', () => {
  test('grants page loads', async ({ page }) => {
    const baseUrl = requireEnv('QA_DEFAULT_BASE_URL');
    await page.goto(baseUrl);
    await loginAsQAUser(page);

    await goTo(page, 'nav-grants', 'grant');
    await expect(page.locator('h1:has-text("Grant"), [data-testid="grants-root"], [data-testid="grants-page"]')).toBeVisible({ timeout: 20_000 });
  });

  test('can open grant detail', async ({ page }) => {
    const baseUrl = requireEnv('QA_DEFAULT_BASE_URL');
    await page.goto(baseUrl);
    await loginAsQAUser(page);

    await goTo(page, 'nav-grants', 'grant');

    const firstRow = page.locator('table tbody tr, [data-testid="grant-row"], [data-testid="grant-card"]').first();
    if (!(await firstRow.count())) {
      test.skip(true, 'No grants to view');
      return;
    }
    await firstRow.click();
    await page.waitForTimeout(2000);
    const detailVisible = await page.locator('[data-testid="grant-detail"], h1, h2').first().isVisible();
    expect(detailVisible).toBeTruthy();
  });
});
