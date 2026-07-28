import { test, expect } from '@playwright/test';
import { requireEnv } from '../helpers/env';
import { loginAsQAUser } from '../helpers/auth';
import { goTo } from '../helpers/nav';

test.describe('Command Center (Home): load & interact', () => {
  test('command center loads after login', async ({ page }) => {
    const baseUrl = requireEnv('QA_DEFAULT_BASE_URL');
    await page.goto(baseUrl);
    await loginAsQAUser(page);

    // Command center is the home page — may already be loaded
    await expect(
      page.locator('[data-testid="command-center-root"]')
        .or(page.locator('[data-testid="dashboard-root"]'))
    ).toBeVisible({ timeout: 20_000 });
  });

  test('command center has key widgets', async ({ page }) => {
    const baseUrl = requireEnv('QA_DEFAULT_BASE_URL');
    await page.goto(baseUrl);
    await loginAsQAUser(page);

    await expect(
      page.locator('[data-testid="command-center-root"]')
        .or(page.locator('[data-testid="dashboard-root"]'))
    ).toBeVisible({ timeout: 20_000 });

    // Look for any visible card-like widget — use first() to avoid strict mode on hidden sections
    const widgets = page.locator('[data-testid*="widget"]')
      .or(page.locator('[data-testid*="card"]'))
      .or(page.locator('.rounded-lg.border'))
      .first();
    await expect(widgets).toBeVisible({ timeout: 20_000 });
  });

  test('command center widget is interactive', async ({ page }) => {
    const baseUrl = requireEnv('QA_DEFAULT_BASE_URL');
    await page.goto(baseUrl);
    await loginAsQAUser(page);

    await expect(
      page.locator('[data-testid="command-center-root"]')
        .or(page.locator('[data-testid="dashboard-root"]'))
    ).toBeVisible({ timeout: 20_000 });

    const clickable = page.locator('a[href]')
      .or(page.locator('button'))
      .or(page.locator('[role="link"]'))
      .or(page.locator('[data-testid*="widget"]'))
      .first();
    await expect(clickable).toBeVisible({ timeout: 10_000 });

    const errorBoundary = await page.locator('[data-testid="error-boundary"]').count();
    expect(errorBoundary).toBe(0);
  });
});
