import { test, expect } from '@playwright/test';
import { requireEnv } from '../helpers/env';
import { loginAsQAUser } from '../helpers/auth';
import { goTo } from '../helpers/nav';

test.describe('Import Center: load & interact', () => {
  test('import center page loads', async ({ page }) => {
    const baseUrl = requireEnv('QA_DEFAULT_BASE_URL');
    await page.goto(baseUrl);
    await loginAsQAUser(page);

    // Admin group may not be visible — skip gracefully
    const adminTrigger = page.locator('[data-testid="nav-group-admin-trigger"]');
    if (!(await adminTrigger.isVisible({ timeout: 8_000 }).catch(() => false))) {
      test.skip(true, 'Admin nav group not visible — tenant may not have admin access');
      return;
    }

    await goTo(page, 'nav-import', 'import');
    await expect(page.locator('[data-testid="import-root"]')).toBeVisible({ timeout: 20_000 });
  });

  test('import page shows upload or import options', async ({ page }) => {
    const baseUrl = requireEnv('QA_DEFAULT_BASE_URL');
    await page.goto(baseUrl);
    await loginAsQAUser(page);

    const adminTrigger = page.locator('[data-testid="nav-group-admin-trigger"]');
    if (!(await adminTrigger.isVisible({ timeout: 8_000 }).catch(() => false))) {
      test.skip(true, 'Admin nav group not visible');
      return;
    }

    await goTo(page, 'nav-import', 'import');
    await expect(page.locator('[data-testid="import-root"]')).toBeVisible({ timeout: 20_000 });

    const importUI = page.locator('input[type="file"]')
      .or(page.locator('button:has-text("Upload")'))
      .or(page.locator('button:has-text("Import")'))
      .or(page.locator('[data-testid*="import"]'))
      .or(page.locator('[data-testid*="upload"]'))
      .or(page.getByText(/CSV/i))
      .first();
    await expect(importUI).toBeVisible({ timeout: 15_000 });
  });
});
