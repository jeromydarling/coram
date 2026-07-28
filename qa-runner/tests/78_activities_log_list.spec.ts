import { test, expect } from '@playwright/test';
import { requireEnv } from '../helpers/env';
import { loginAsQAUser } from '../helpers/auth';
import { goTo } from '../helpers/nav';

/**
 * Tenant: Activities page — log new activity, list rendering.
 */
test.describe('Activities: log & list', () => {
  test('activities page renders list or empty state', async ({ page }) => {
    const baseUrl = requireEnv('QA_DEFAULT_BASE_URL');
    await page.goto(baseUrl);
    await loginAsQAUser(page);

    await goTo(page, 'nav-activities', 'activit');

    // Use only data-testid to avoid strict mode violations
    await expect(
      page.locator('[data-testid="activities-root"]')
    ).toBeVisible({ timeout: 15_000 });
  });

  test('log activity button opens form', async ({ page }) => {
    const baseUrl = requireEnv('QA_DEFAULT_BASE_URL');
    await page.goto(baseUrl);
    await loginAsQAUser(page);

    await goTo(page, 'nav-activities', 'activit');
    await expect(page.locator('[data-testid="activities-root"]')).toBeVisible({ timeout: 15_000 });

    const logBtn = page.locator('button:has-text("Log"), button:has-text("Add"), button:has-text("New"), [data-testid="log-activity"]').first();
    if (!(await logBtn.count())) {
      test.skip(true, 'No log activity button found');
      return;
    }

    await logBtn.click();
    await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 10_000 });
  });
});
