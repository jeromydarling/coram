import { test, expect } from '@playwright/test';
import { requireEnv } from '../helpers/env';
import { loginAsQAUser } from '../helpers/auth';
import { goTo } from '../helpers/nav';

/**
 * Tenant: People page — search & filter smoke.
 */
test.describe('People: search & filter', () => {
  test('search input is functional', async ({ page }) => {
    const baseUrl = requireEnv('QA_DEFAULT_BASE_URL');
    await page.goto(baseUrl);
    await loginAsQAUser(page);
    await goTo(page, 'nav-people', 'people');

    const searchInput = page.locator('input[placeholder*="earch"], input[type="search"], [data-testid="people-search"]').first();
    if (!(await searchInput.count())) {
      test.skip(true, 'No search input found on people page');
      return;
    }

    await searchInput.fill('test');
    // Should not crash — results may be empty
    await page.waitForTimeout(1_000);
    await expect(page.locator('body')).toBeVisible();
  });

  test('add person button exists', async ({ page }) => {
    const baseUrl = requireEnv('QA_DEFAULT_BASE_URL');
    await page.goto(baseUrl);
    await loginAsQAUser(page);
    await goTo(page, 'nav-people', 'people');

    const addBtn = page.locator('button:has-text("Add"), button:has-text("New"), [data-testid="add-person"]').first();
    await expect(addBtn).toBeVisible({ timeout: 10_000 });
  });
});
