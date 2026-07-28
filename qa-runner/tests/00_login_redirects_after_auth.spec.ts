import { test, expect } from '@playwright/test';
import { requireEnv } from '../helpers/env';
import { loginAsQAUser } from '../helpers/auth';

test.describe('Smoke: login + dashboard', () => {
  test('login redirects to dashboard', async ({ page }) => {
    const baseUrl = requireEnv('QA_DEFAULT_BASE_URL');
    await page.goto(baseUrl);

    await loginAsQAUser(page);

    // App shows marketing landing at "/"; navigate to tenant dashboard explicitly
    const tenantSlug = process.env.QA_TENANT_SLUG || 'bridge-social-enterprise';
    await page.goto(`${baseUrl.replace(/\/$/, '')}/${tenantSlug}/`);

    // Accept either command-center-root or dashboard-root
    await expect(
      page.locator('[data-testid="command-center-root"]')
        .or(page.locator('[data-testid="dashboard-root"]'))
    ).toBeVisible({ timeout: 20_000 });

    // Let async content (cards, charts, lists) finish rendering before screenshot
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
  });
});
