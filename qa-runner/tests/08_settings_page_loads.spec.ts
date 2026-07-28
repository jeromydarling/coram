import { test, expect } from '@playwright/test';
import { requireEnv } from '../helpers/env';
import { loginAsQAUser } from '../helpers/auth';
import { goTo } from '../helpers/nav';

test.describe('Settings: load & interact', () => {
  test('settings page loads', async ({ page }) => {
    const baseUrl = requireEnv('QA_DEFAULT_BASE_URL');
    await page.goto(baseUrl);
    await loginAsQAUser(page);

    await goTo(page, 'nav-settings', 'settings');
    await expect(page.locator('[data-testid="settings-root"]')).toBeVisible({ timeout: 20_000 });
  });

  test('settings tabs are navigable', async ({ page }) => {
    const baseUrl = requireEnv('QA_DEFAULT_BASE_URL');
    await page.goto(baseUrl);
    await loginAsQAUser(page);

    await goTo(page, 'nav-settings', 'settings');
    await expect(page.locator('[data-testid="settings-root"]')).toBeVisible({ timeout: 20_000 });

    // Look for tabs or section links
    const tabs = page.locator('[role="tab"]')
      .or(page.locator('[role="tablist"] button'))
      .or(page.locator('[data-testid*="settings-tab"]'));
    if (await tabs.count() > 1) {
      await tabs.nth(1).click();
      await page.waitForTimeout(1000);
      const errorBoundary = await page.locator('[data-testid="error-boundary"]').count();
      expect(errorBoundary).toBe(0);
    }
  });
});
