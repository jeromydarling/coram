import { test, expect } from '@playwright/test';
import { requireEnv } from '../helpers/env';
import { loginAsQAUser } from '../helpers/auth';
import { goTo } from '../helpers/nav';

/**
 * Companion → Tenant Absorption — Settings Organizations tab smoke tests.
 *
 * WHAT: Validates the Organizations tab renders and absorption UI is accessible.
 * WHERE: Settings page → Organizations tab
 * WHY: Ensures free Companions can view memberships and pending invitations.
 */
test.describe('Companion Absorption: Settings Organizations tab', () => {
  test('organizations tab is visible in settings', async ({ page }) => {
    const baseUrl = requireEnv('QA_DEFAULT_BASE_URL');
    await page.goto(baseUrl);
    await loginAsQAUser(page);

    await goTo(page, 'nav-settings', 'settings');
    await expect(page.locator('[data-testid="settings-root"]')).toBeVisible({ timeout: 20_000 });

    const orgTab = page.locator('[role="tab"]:has-text("Organizations"), button:has-text("Organizations")').first();
    await expect(orgTab).toBeVisible({ timeout: 10_000 });
  });

  test('organizations tab renders content when clicked', async ({ page }) => {
    const baseUrl = requireEnv('QA_DEFAULT_BASE_URL');
    await page.goto(baseUrl);
    await loginAsQAUser(page);

    await goTo(page, 'nav-settings', 'settings');
    await expect(page.locator('[data-testid="settings-root"]')).toBeVisible({ timeout: 20_000 });

    const orgTab = page.locator('[role="tab"]:has-text("Organizations"), button:has-text("Organizations")').first();
    if (await orgTab.isVisible()) {
      await orgTab.click();
      await page.waitForTimeout(1500);

      // Should show either organizations list or empty state
      const hasContent = await page.getByText(/your organizations|not connected|pending/i).first().isVisible();
      expect(hasContent).toBeTruthy();

      // No error boundary
      const errorBoundary = await page.locator('[data-testid="error-boundary"]').count();
      expect(errorBoundary).toBe(0);
    }
  });

  test('no error boundary on organizations tab', async ({ page }) => {
    const baseUrl = requireEnv('QA_DEFAULT_BASE_URL');
    await page.goto(baseUrl);
    await loginAsQAUser(page);

    await goTo(page, 'nav-settings', 'settings');
    await expect(page.locator('[data-testid="settings-root"]')).toBeVisible({ timeout: 20_000 });

    const orgTab = page.locator('[role="tab"]:has-text("Organizations"), button:has-text("Organizations")').first();
    if (await orgTab.isVisible()) {
      await orgTab.click();
      await page.waitForTimeout(2000);
      const errorCount = await page.locator('[data-testid="error-boundary"]').count();
      expect(errorCount).toBe(0);
    }
  });
});
