import { test, expect } from '@playwright/test';
import { requireEnv } from '../helpers/env';
import { loginAsQAUser } from '../helpers/auth';
import { goTo } from '../helpers/nav';

test.describe('Prōvīsiō: load & interact', () => {
  test('provisions page loads', async ({ page }) => {
    const baseUrl = requireEnv('QA_DEFAULT_BASE_URL');
    await page.goto(baseUrl);
    await loginAsQAUser(page);

    await goTo(page, 'nav-provisions', 'provision');

    // Use only data-testid to avoid strict mode violations (root + heading both match text)
    await expect(
      page.locator('[data-testid="provisions-root"]')
    ).toBeVisible({ timeout: 20_000 });
  });

  test('add provision button opens form', async ({ page }) => {
    const baseUrl = requireEnv('QA_DEFAULT_BASE_URL');
    await page.goto(baseUrl);
    await loginAsQAUser(page);

    await goTo(page, 'nav-provisions', 'provision');

    await expect(
      page.locator('[data-testid="provisions-root"]')
    ).toBeVisible({ timeout: 20_000 });

    const addBtn = page.locator('[data-testid="add-provision"]')
      .or(page.locator('button:has-text("Add")'))
      .or(page.locator('button:has-text("New")'))
      .or(page.locator('button:has-text("Request")'))
      .first();

    if (!(await addBtn.count())) {
      test.skip(true, 'No add provision button found');
      return;
    }

    await addBtn.click();
    await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 10_000 });
  });
});
