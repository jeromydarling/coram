/**
 * 36_momentum_map_loads — Verifies momentum map page loads and renders visualization.
 */
import { test, expect } from '@playwright/test';
import { requireEnv } from '../helpers/env';
import { loginAsQAUser } from '../helpers/auth';
import { goTo } from '../helpers/nav';

test.describe('Momentum Map: load & interact', () => {
  test('momentum map page renders', async ({ page }) => {
    const baseUrl = requireEnv('QA_DEFAULT_BASE_URL');
    await page.goto(baseUrl);
    await loginAsQAUser(page);

    // Verify login succeeded — use only data-testid (not bare 'nav' which matches multiple)
    await expect(
      page.locator('[data-testid="command-center-root"]')
        .or(page.locator('[data-testid="dashboard-root"]'))
    ).toBeVisible({ timeout: 20_000 });
    await page.screenshot({ path: 'screenshots/36_post_login.png' });

    const trigger = page.locator('[data-testid="nav-group-metros-trigger"]');
    if (!(await trigger.isVisible({ timeout: 8_000 }).catch(() => false))) {
      await page.screenshot({ path: 'screenshots/36_metros_trigger_missing.png' });
      test.skip(true, 'Metros nav group not visible — Civitas may be disabled for this tenant.');
      return;
    }

    await goTo(page, 'nav-momentum', 'momentum');
    await expect(page.locator('h1:has-text("Momentum"), [data-testid="momentum-root"], [data-testid="momentum-page"]'))
      .toBeVisible({ timeout: 20_000 });
    await page.screenshot({ path: 'screenshots/36_momentum_page.png' });
  });

  test('map or chart visualization renders', async ({ page }) => {
    const baseUrl = requireEnv('QA_DEFAULT_BASE_URL');
    await page.goto(baseUrl);
    await loginAsQAUser(page);

    await expect(
      page.locator('[data-testid="command-center-root"]')
        .or(page.locator('[data-testid="dashboard-root"]'))
    ).toBeVisible({ timeout: 20_000 });

    const trigger = page.locator('[data-testid="nav-group-metros-trigger"]');
    if (!(await trigger.isVisible({ timeout: 8_000 }).catch(() => false))) {
      await page.screenshot({ path: 'screenshots/36_viz_metros_trigger_missing.png' });
      test.skip(true, 'Metros nav group not visible — Civitas may be disabled for this tenant.');
      return;
    }

    await goTo(page, 'nav-momentum', 'momentum');
    await expect(page.locator('h1:has-text("Momentum"), [data-testid="momentum-root"]')).toBeVisible({ timeout: 20_000 });

    const visual = page.locator('svg, canvas, [class*="recharts"], [class*="map"], [data-testid*="map"], [data-testid*="chart"]').first();
    await expect(visual).toBeVisible({ timeout: 15_000 });
    await page.screenshot({ path: 'screenshots/36_momentum_visualization.png' });
  });
});
