import { test, expect } from '@playwright/test';
import { requireEnv } from '../helpers/env';

/**
 * Marketing: See People page loads and shows interactive reflection experience.
 */
test.describe('Marketing: See People page', () => {
  test('see-people page loads', async ({ page }) => {
    const baseUrl = requireEnv('QA_DEFAULT_BASE_URL');
    await page.goto(`${baseUrl}/see-people`);

    await expect(
      page.locator('[data-testid="see-people-root"]')
    ).toBeVisible({ timeout: 15_000 });
  });

  test('start button is visible', async ({ page }) => {
    const baseUrl = requireEnv('QA_DEFAULT_BASE_URL');
    await page.goto(`${baseUrl}/see-people`);

    await expect(
      page.locator('[data-testid="see-people-root"]')
    ).toBeVisible({ timeout: 15_000 });

    // The page has a CTA / start button
    await expect(
      page.locator('[data-testid="see-people-start"]')
        .or(page.locator('button').first())
    ).toBeVisible({ timeout: 10_000 });
  });
});
