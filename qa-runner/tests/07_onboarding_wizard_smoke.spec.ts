import { test, expect } from '@playwright/test';
import { requireEnv } from '../helpers/env';
import { isEnabled } from '../helpers/features';

test.describe('Onboarding: post-payment wizard', () => {
  test('onboarding route loads (optional)', async ({ page }) => {
    test.skip(!isEnabled('QA_ENABLE_ONBOARDING_TESTS'), 'Requires a user/tenant in onboarding state.');

    const baseUrl = requireEnv('QA_DEFAULT_BASE_URL');
    await page.goto(baseUrl.replace(/\/?$/, '/onboarding'));

    await expect(page.locator('h1:has-text("Onboarding"), [data-testid="onboarding-root"]')).toBeVisible({ timeout: 20_000 });
  });
});
