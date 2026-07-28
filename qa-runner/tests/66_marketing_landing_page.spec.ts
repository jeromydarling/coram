import { test, expect } from '@playwright/test';
import { requireEnv } from '../helpers/env';

test.describe('Marketing: landing page', () => {
  test('hero section renders', async ({ page }) => {
    const baseUrl = requireEnv('QA_DEFAULT_BASE_URL');
    await page.goto(baseUrl);

    // Use only heading role to avoid strict mode (sr-only spans also match text)
    await expect(
      page.getByRole('heading', { level: 1 }).first()
    ).toBeVisible({ timeout: 15_000 });
  });

  test('footer is present', async ({ page }) => {
    const baseUrl = requireEnv('QA_DEFAULT_BASE_URL');
    await page.goto(baseUrl);

    await expect(
      page.locator('footer').first()
    ).toBeVisible({ timeout: 15_000 });
  });

  test('navigation links exist', async ({ page }) => {
    const baseUrl = requireEnv('QA_DEFAULT_BASE_URL');
    await page.goto(baseUrl);

    await expect(
      page.locator('nav a, header a, nav button').first()
    ).toBeVisible({ timeout: 15_000 });
  });
});
