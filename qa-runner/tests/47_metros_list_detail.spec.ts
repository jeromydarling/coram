import { test, expect } from '@playwright/test';
import { requireEnv } from '../helpers/env';
import { loginAsQAUser } from '../helpers/auth';
import { goTo } from '../helpers/nav';

test.describe('Metros: list & detail', () => {
  test('metros page loads', async ({ page }) => {
    const baseUrl = requireEnv('QA_DEFAULT_BASE_URL');
    await page.goto(baseUrl);
    await loginAsQAUser(page);

    // Metros nav is hidden when Civitas is disabled — skip gracefully
    const trigger = page.locator('[data-testid="nav-group-metros-trigger"]');
    if (!(await trigger.isVisible({ timeout: 5_000 }).catch(() => false))) {
      test.skip(true, 'Metros nav group not visible — Civitas may be disabled for this tenant.');
      return;
    }

    await goTo(page, 'nav-metros', 'metros');
    await expect(page.locator('[data-testid="metros-root"]')).toBeVisible({ timeout: 20_000 });
  });

  test('can click into metro detail', async ({ page }) => {
    const baseUrl = requireEnv('QA_DEFAULT_BASE_URL');
    await page.goto(baseUrl);
    await loginAsQAUser(page);

    const trigger = page.locator('[data-testid="nav-group-metros-trigger"]');
    if (!(await trigger.isVisible({ timeout: 5_000 }).catch(() => false))) {
      test.skip(true, 'Metros nav group not visible — Civitas may be disabled for this tenant.');
      return;
    }

    await goTo(page, 'nav-metros', 'metros');

    const firstMetro = page.locator('table tbody tr, [data-testid="metro-row"], [data-testid="metro-card"]').first();
    if (!(await firstMetro.count())) {
      test.skip(true, 'No metros to view');
      return;
    }
    await firstMetro.click();
    await page.waitForTimeout(2000);
    const detailVisible = await page.locator('[data-testid="metro-detail"], h1, h2').first().isVisible();
    expect(detailVisible).toBeTruthy();
  });
});
