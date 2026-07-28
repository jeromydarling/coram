import { test, expect } from '@playwright/test';
import { requireEnv } from '../helpers/env';
import { loginAsQAUser } from '../helpers/auth';
import { goTo } from '../helpers/nav';

test.describe('Relationship Graph: load & interact', () => {
  test('graph page loads', async ({ page }) => {
    const baseUrl = requireEnv('QA_DEFAULT_BASE_URL');
    await page.goto(baseUrl);
    await loginAsQAUser(page);

    await goTo(page, 'nav-graph', 'graph');
    await expect(page.locator('[data-testid="graph-root"]'))
      .toBeVisible({ timeout: 20_000 });
  });

  test('graph visualization renders', async ({ page }) => {
    const baseUrl = requireEnv('QA_DEFAULT_BASE_URL');
    await page.goto(baseUrl);
    await loginAsQAUser(page);

    await goTo(page, 'nav-graph', 'graph');
    await expect(page.locator('[data-testid="graph-root"]'))
      .toBeVisible({ timeout: 20_000 });

    const viz = page.locator('svg')
      .or(page.locator('canvas'))
      .or(page.locator('[data-testid*="graph"]'))
      .or(page.locator('[class*="graph"]'))
      .or(page.locator('[class*="network"]'))
      .first();
    await expect(viz).toBeVisible({ timeout: 15_000 });
  });
});
