import { test, expect } from '@playwright/test';
import { requireEnv } from '../helpers/env';
import { loginAsQAUser } from '../helpers/auth';
import { isEnabled } from '../helpers/features';

test.describe('Testimonium: story view', () => {
  test('testimonium page loads for insight+ tier', async ({ page }) => {
    test.skip(!isEnabled('QA_ENABLE_TESTIMONIUM'), 'Requires Insight tier with Testimonium access.');

    const baseUrl = requireEnv('QA_DEFAULT_BASE_URL');
    await page.goto(baseUrl);
    await loginAsQAUser(page);

    // Navigate via sidebar
    const navItem = page.locator('[data-testid="nav-testimonium"]');
    await expect(navItem).toBeVisible({ timeout: 15_000 });
    await navItem.click();

    await page.waitForURL(/testimonium/, { timeout: 15_000 });
    await expect(page.locator('[data-testid="testimonium-root"], h1:has-text("Testimonium")'))
      .toBeVisible({ timeout: 20_000 });
  });

  test('testimonium page shows feature gate for core tier', async ({ page }) => {
    test.skip(!isEnabled('QA_ENABLE_FEATURE_GATE_TESTS'), 'Requires a core-tier test user.');

    const baseUrl = requireEnv('QA_DEFAULT_BASE_URL');
    await page.goto(baseUrl);
    await loginAsQAUser(page);

    // Try to navigate to testimonium via URL
    await page.goto(baseUrl.replace(/\/?$/, '/testimonium'));

    // Should see a gate/upgrade message instead of content
    const gateVisible = await page.locator('text=Upgrade, text=Insight, text=unlock, text=not available').first().isVisible();
    expect(gateVisible).toBeTruthy();
  });
});
