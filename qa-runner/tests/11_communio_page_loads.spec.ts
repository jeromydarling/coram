import { test, expect } from '@playwright/test';
import { requireEnv } from '../helpers/env';
import { loginAsQAUser } from '../helpers/auth';
import { isEnabled } from '../helpers/features';

test.describe('Communio', () => {
  test('communio route renders (optional)', async ({ page }) => {
    test.skip(!isEnabled('QA_ENABLE_COMMUNIO_TESTS'), 'Enable when Communio is configured for the QA tenant.');

    const baseUrl = requireEnv('QA_DEFAULT_BASE_URL');
    await page.goto(baseUrl);
    await loginAsQAUser(page);

    await expect(page.locator('[data-testid="dashboard-root"]')).toBeVisible({ timeout: 20_000 });

    // Communio is a nav group; click nav item if present
    const communioNav = page.locator('[data-testid="nav-communio"]');
    if (await communioNav.count()) {
      await communioNav.click();
    } else {
      await page.goto(baseUrl.replace(/\/?$/, '/communio'));
    }

    await expect(page.locator('text=Communio, [data-testid="communio-root"]')).toBeVisible({ timeout: 20_000 });
  });
});
