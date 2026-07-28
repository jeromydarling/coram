import { test, expect } from '@playwright/test';
import { requireEnv } from '../helpers/env';

test.describe('Public: Pricing page', () => {
  test('loads and shows plan cards', async ({ page }) => {
    const baseUrl = requireEnv('QA_DEFAULT_BASE_URL');
    const pricingUrl = baseUrl.replace(/\/?$/, '/pricing');
    await page.goto(pricingUrl);

    await expect(page.locator('[data-testid="pricing-root"]')).toBeVisible({ timeout: 20_000 });

    // core plan — use getByText with substring match to handle ™ symbol
    await expect(page.getByText('CROS Core').first()).toBeVisible({ timeout: 20_000 });
    // add-ons / paid tiers
    await expect(page.getByText('CROS Insight').first()).toBeVisible();
    await expect(page.getByText('CROS Story').first()).toBeVisible();
    await expect(page.getByText('CROS Bridge').first()).toBeVisible();

    // capacity upgrades tiles
    await expect(page.getByText('Team Capacity Expansion').first()).toBeVisible();
    await expect(page.getByText('Expanded AI Usage').first()).toBeVisible();
    await expect(page.getByText('Expanded Local Pulse').first()).toBeVisible();
    await expect(page.getByText('Advanced NRI').first()).toBeVisible();
  });
});
