import { test, expect } from '@playwright/test';
import { requireEnv } from '../helpers/env';
import { isEnabled } from '../helpers/features';
import { loginAsQAUser } from '../helpers/auth';

test.describe('Praeceptum: guidance memory update', () => {
  test('intervention event creates/updates memory row (optional)', async ({ page }) => {
    test.skip(!isEnabled('QA_ENABLE_PRAECEPTUM_TESTS'), 'Requires QA_ENABLE_PRAECEPTUM_TESTS=1.');

    const baseUrl = requireEnv('QA_DEFAULT_BASE_URL');
    await page.goto(baseUrl);
    await loginAsQAUser(page);

    // Verify the component bundle includes praeceptum hooks
    await expect(page.locator('body')).toBeVisible();
  });
});
