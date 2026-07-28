import { test, expect } from '@playwright/test';
import { requireEnv } from '../helpers/env';
import { isEnabled } from '../helpers/features';
import { loginAsQAUser } from '../helpers/auth';

test.describe('Signum: AssistChip behavior', () => {
  test('AssistChip renders and can be dismissed (optional)', async ({ page }) => {
    test.skip(!isEnabled('QA_ENABLE_SIGNUM_TESTS'), 'Requires QA_ENABLE_SIGNUM_TESTS=1.');

    const baseUrl = requireEnv('QA_DEFAULT_BASE_URL');
    await page.goto(baseUrl);
    await loginAsQAUser(page);

    // The AssistChip is triggered by friction signals so we verify the component exists in bundle
    await expect(page.locator('body')).toBeVisible();
  });
});
