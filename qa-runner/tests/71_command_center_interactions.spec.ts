import { test, expect } from '@playwright/test';
import { requireEnv } from '../helpers/env';
import { loginAsQAUser } from '../helpers/auth';

/**
 * Tenant: Command Center / Dashboard interaction smoke test.
 */
test.describe('Command Center: interactions', () => {
  test('mission rhythm section loads', async ({ page }) => {
    const baseUrl = requireEnv('QA_DEFAULT_BASE_URL');
    await page.goto(baseUrl);
    await loginAsQAUser(page);

    // Should land on command center or dashboard
    await expect(
      page.locator('[data-testid="command-center-root"]')
        .or(page.locator('[data-testid="dashboard-root"]'))
    ).toBeVisible({ timeout: 20_000 });

    // Look for mission rhythm, daily guidance, or any card-like content
    await expect(
      page.getByText(/rhythm|guidance|today|welcome|unfolding/i).first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('quick actions are available', async ({ page }) => {
    const baseUrl = requireEnv('QA_DEFAULT_BASE_URL');
    await page.goto(baseUrl);
    await loginAsQAUser(page);

    await expect(
      page.locator('[data-testid="command-center-root"]')
        .or(page.locator('[data-testid="dashboard-root"]'))
    ).toBeVisible({ timeout: 20_000 });

    // Look for any actionable element — buttons, links, or interactive cards
    const actions = page.locator('button, a[href], [role="button"], [data-testid*="quick-action"], [data-testid*="widget"]');
    await expect(actions.first()).toBeVisible({ timeout: 10_000 });
  });
});
