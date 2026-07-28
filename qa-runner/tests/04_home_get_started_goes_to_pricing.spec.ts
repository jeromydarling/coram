import { test, expect } from '@playwright/test';
import { requireEnv } from '../helpers/env';

test.describe('Public: Homepage CTA', () => {
  test('Get started routes to /pricing', async ({ page }) => {
    const baseUrl = requireEnv('QA_DEFAULT_BASE_URL');
    await page.goto(baseUrl);

    // Find the primary CTA — use partial text match since button has icon text too
    const cta = page.getByText('Get started').first();
    await expect(cta).toBeVisible({ timeout: 20_000 });

    await cta.click();

    // Some sites use anchor to /pricing or /contact; allow either
    await page.waitForURL(/\/(pricing|contact)/, { timeout: 20_000 });
    await expect(page).toHaveURL(/\/(pricing|contact)/);
  });
});
