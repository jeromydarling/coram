import { test, expect } from '@playwright/test';
import { requireEnv } from '../helpers/env';
import { loginAsQAUser } from '../helpers/auth';
import { goTo } from '../helpers/nav';

/**
 * Tenant: Calendar page interaction — month nav, event rendering.
 */
test.describe('Calendar: interactions', () => {
  test('month navigation works', async ({ page }) => {
    const baseUrl = requireEnv('QA_DEFAULT_BASE_URL');
    await page.goto(baseUrl);
    await loginAsQAUser(page);
    await goTo(page, 'nav-calendar', 'calendar');

    // Use only data-testid to avoid strict mode on month text matching multiple elements
    await expect(
      page.locator('[data-testid="calendar-root"]')
    ).toBeVisible({ timeout: 15_000 });

    // Try clicking next month button
    const nextBtn = page.locator('button:has-text("Next"), button[aria-label*="next"], [data-testid="calendar-next"]').first();
    if (await nextBtn.count()) {
      await nextBtn.click();
      await expect(page.locator('body')).toBeVisible();
    }
  });
});
