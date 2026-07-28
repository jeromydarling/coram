import { test, expect } from '@playwright/test';
import { requireEnv } from '../helpers/env';
import { loginAsQAUser } from '../helpers/auth';
import { goTo } from '../helpers/nav';

/**
 * Tenant: Volunteers page — list, search, and add button.
 */
test.describe('Volunteers: interactions', () => {
  test('volunteer list or empty state renders', async ({ page }) => {
    const baseUrl = requireEnv('QA_DEFAULT_BASE_URL');
    await page.goto(baseUrl);
    await loginAsQAUser(page);
    await goTo(page, 'nav-volunteers', 'volunteer');

    // Use only data-testid to avoid strict mode (root div + heading both match text)
    await expect(
      page.locator('[data-testid="volunteers-root"]')
    ).toBeVisible({ timeout: 15_000 });
  });

  test('add volunteer button exists', async ({ page }) => {
    const baseUrl = requireEnv('QA_DEFAULT_BASE_URL');
    await page.goto(baseUrl);
    await loginAsQAUser(page);
    await goTo(page, 'nav-volunteers', 'volunteer');

    await expect(
      page.locator('[data-testid="volunteers-root"]')
    ).toBeVisible({ timeout: 15_000 });

    const addBtn = page.locator('button:has-text("Add"), button:has-text("New"), [data-testid="add-volunteer"]').first();
    await expect(addBtn).toBeVisible({ timeout: 10_000 });
  });
});
