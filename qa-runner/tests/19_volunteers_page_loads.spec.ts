import { test, expect } from '@playwright/test';
import { requireEnv } from '../helpers/env';
import { loginAsQAUser } from '../helpers/auth';
import { goTo } from '../helpers/nav';

test.describe('Voluntārium: load & interact', () => {
  test('volunteers page loads', async ({ page }) => {
    const baseUrl = requireEnv('QA_DEFAULT_BASE_URL');
    await page.goto(baseUrl);
    await loginAsQAUser(page);

    await goTo(page, 'nav-volunteers', 'volunteer');
    await expect(
      page.locator('[data-testid="volunteers-root"]')
    ).toBeVisible({ timeout: 20_000 });
  });

  test('add volunteer button opens form', async ({ page }) => {
    const baseUrl = requireEnv('QA_DEFAULT_BASE_URL');
    await page.goto(baseUrl);
    await loginAsQAUser(page);

    await goTo(page, 'nav-volunteers', 'volunteer');
    await expect(
      page.locator('[data-testid="volunteers-root"]')
    ).toBeVisible({ timeout: 20_000 });

    const addBtn = page.locator('[data-testid="add-volunteer"]')
      .or(page.locator('button:has-text("Add")'))
      .or(page.locator('button:has-text("New")'))
      .or(page.locator('button:has-text("Create")'))
      .first();
    await expect(addBtn).toBeVisible({ timeout: 10_000 });
    await addBtn.click();

    await expect(
      page.locator('[role="dialog"]')
        .or(page.locator('[data-testid="volunteer-form"]'))
        .or(page.locator('form'))
    ).toBeVisible({ timeout: 10_000 });
  });
});
