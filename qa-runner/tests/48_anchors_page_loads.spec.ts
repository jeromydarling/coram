import { test, expect } from '@playwright/test';
import { requireEnv } from '../helpers/env';
import { loginAsQAUser } from '../helpers/auth';
import { goTo } from '../helpers/nav';

test.describe('Anchors: load & interact', () => {
  test('anchors page loads', async ({ page }) => {
    const baseUrl = requireEnv('QA_DEFAULT_BASE_URL');
    await page.goto(baseUrl);
    await loginAsQAUser(page);

    await goTo(page, 'nav-anchors', 'anchor');
    await expect(page.locator('[data-testid="anchors-root"]'))
      .toBeVisible({ timeout: 20_000 });
  });

  test('anchor list or empty state renders', async ({ page }) => {
    const baseUrl = requireEnv('QA_DEFAULT_BASE_URL');
    await page.goto(baseUrl);
    await loginAsQAUser(page);

    await goTo(page, 'nav-anchors', 'anchor');
    await expect(page.locator('[data-testid="anchors-root"]')).toBeVisible({ timeout: 20_000 });

    // Should show anchor cards OR an empty state message ("No anchors with orders yet" / "No anchors found")
    const content = page.locator('[data-tour="anchors-card"]')
      .or(page.locator('[data-tour="anchors-list"]'))
      .or(page.getByText(/no anchors/i).first())
      .first();
    await expect(content).toBeVisible({ timeout: 15_000 });
  });
});
