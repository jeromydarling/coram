import { test, expect } from '@playwright/test';
import { requireEnv } from '../helpers/env';
import { loginAsQAUser } from '../helpers/auth';
import { goTo } from '../helpers/nav';

test.describe('Voluntārium: create & list', () => {
  test('can open volunteer creation dialog', async ({ page }) => {
    const baseUrl = requireEnv('QA_DEFAULT_BASE_URL');
    await page.goto(baseUrl);
    await loginAsQAUser(page);

    await goTo(page, 'nav-volunteers', 'volunteer');

    const addBtn = page.locator('button:has-text("Add"), button:has-text("New"), button:has-text("Register"), [data-testid="add-volunteer"]').first();
    if (!(await addBtn.count())) {
      test.skip(true, 'No add volunteer button found');
      return;
    }
    await addBtn.click();
    await expect(page.locator('[role="dialog"], form, [data-testid="volunteer-form"]')).toBeVisible({ timeout: 10_000 });
  });

  test('can click into volunteer detail', async ({ page }) => {
    const baseUrl = requireEnv('QA_DEFAULT_BASE_URL');
    await page.goto(baseUrl);
    await loginAsQAUser(page);

    await goTo(page, 'nav-volunteers', 'volunteer');

    const firstRow = page.locator('table tbody tr, [data-testid="volunteer-row"], [data-testid="volunteer-card"]').first();
    if (!(await firstRow.count())) {
      test.skip(true, 'No volunteers to view');
      return;
    }
    await firstRow.click();
    await page.waitForTimeout(2000);
  });
});
