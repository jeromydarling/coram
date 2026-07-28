import { test, expect } from '@playwright/test';
import { requireEnv } from '../helpers/env';
import { loginAsQAUser } from '../helpers/auth';
import { goTo } from '../helpers/nav';

/**
 * Tenant: Settings page sections — tabs/cards render correctly.
 * Actual tabs: Profile, Integrations, Modules, Notifications, Billing, Account
 */
test.describe('Settings: section rendering', () => {
  test('profile section visible', async ({ page }) => {
    const baseUrl = requireEnv('QA_DEFAULT_BASE_URL');
    await page.goto(baseUrl);
    await loginAsQAUser(page);
    await goTo(page, 'nav-settings', 'settings');

    await expect(
      page.locator('[data-testid="settings-root"]')
    ).toBeVisible({ timeout: 15_000 });

    await expect(
      page.getByText(/profile|display name|email/i).first()
    ).toBeVisible({ timeout: 15_000 });
  });

  test('integrations tab visible', async ({ page }) => {
    const baseUrl = requireEnv('QA_DEFAULT_BASE_URL');
    await page.goto(baseUrl);
    await loginAsQAUser(page);
    await goTo(page, 'nav-settings', 'settings');

    await expect(
      page.locator('[data-testid="settings-root"]')
    ).toBeVisible({ timeout: 15_000 });

    // Click the Integrations tab
    const integrationsTab = page.locator('[role="tab"]:has-text("Integrations"), button:has-text("Integrations")').first();
    await expect(integrationsTab).toBeVisible({ timeout: 10_000 });
  });

  test('modules tab visible', async ({ page }) => {
    const baseUrl = requireEnv('QA_DEFAULT_BASE_URL');
    await page.goto(baseUrl);
    await loginAsQAUser(page);
    await goTo(page, 'nav-settings', 'settings');

    await expect(
      page.locator('[data-testid="settings-root"]')
    ).toBeVisible({ timeout: 15_000 });

    const modulesTab = page.locator('[role="tab"]:has-text("Modules"), button:has-text("Modules")').first();
    await expect(modulesTab).toBeVisible({ timeout: 10_000 });
  });
});
