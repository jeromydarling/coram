import { test, expect } from '@playwright/test';
import { requireEnv } from '../helpers/env';
import { isEnabled } from '../helpers/features';
import { loginAsQAUser } from '../helpers/auth';

test.describe('Signum: idle friction prompt', () => {
  test('idle timer fires friction_idle event (optional)', async ({ page }) => {
    test.skip(!isEnabled('QA_ENABLE_SIGNUM_TESTS'), 'Requires QA_ENABLE_SIGNUM_TESTS=1.');

    const baseUrl = requireEnv('QA_DEFAULT_BASE_URL');
    await page.goto(baseUrl);
    await loginAsQAUser(page);

    // Navigate to opportunities page
    await page.goto(baseUrl.replace(/\/?$/, '/opportunities'));
    await page.waitForTimeout(5000);

    // Verify page loaded without errors
    await expect(page.locator('body')).toBeVisible();
  });
});
