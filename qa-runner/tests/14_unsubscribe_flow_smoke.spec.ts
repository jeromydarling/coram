import { test, expect } from '@playwright/test';
import { isEnabled } from '../helpers/features';
import { requireEnv } from '../helpers/env';

test.describe('Unsubscribe flow (public)', () => {
  test('unsubscribe page loads and confirms', async ({ page }) => {
    test.skip(!isEnabled('QA_ENABLE_UNSUBSCRIBE_TESTS'), 'Set QA_UNSUBSCRIBE_TEST_URL to run.');

    const url = requireEnv('QA_UNSUBSCRIBE_TEST_URL');
    await page.goto(url);

    await expect(page.locator('text=Unsubscribe, text=do not email')).toBeVisible({ timeout: 20_000 });

    const btn = page.locator('button:has-text("Unsubscribe"), button:has-text("Confirm")').first();
    await expect(btn).toBeVisible({ timeout: 20_000 });
    await btn.click();

    await expect(page.locator('text=You are unsubscribed, text=removed')).toBeVisible({ timeout: 20_000 });
  });
});
