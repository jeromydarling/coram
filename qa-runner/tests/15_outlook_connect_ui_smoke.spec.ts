import { test, expect } from '@playwright/test';
import { requireEnv } from '../helpers/env';
import { loginAsQAUser } from '../helpers/auth';
import { isEnabled } from '../helpers/features';

test.describe('Outlook Connect UI (optional)', () => {
  test('outlook connect entry exists in settings', async ({ page }) => {
    test.skip(!isEnabled('QA_ENABLE_OUTLOOK_TESTS'), 'Requires Outlook UI implemented and a test tenant.');

    const baseUrl = requireEnv('QA_DEFAULT_BASE_URL');
    await page.goto(baseUrl);
    await loginAsQAUser(page);

    await page.goto(baseUrl.replace(/\/?$/, '/settings'));
    await expect(page.locator('text=Outlook, text=Microsoft')).toBeVisible({ timeout: 20_000 });
  });
});
