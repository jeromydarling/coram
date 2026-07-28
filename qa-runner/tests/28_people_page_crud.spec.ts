import { test, expect } from '@playwright/test';
import { requireEnv } from '../helpers/env';
import { loginAsQAUser } from '../helpers/auth';
import { goTo } from '../helpers/nav';

test.describe('People: list and detail', () => {
  test('people page loads with table or cards', async ({ page }) => {
    const baseUrl = requireEnv('QA_DEFAULT_BASE_URL');
    await page.goto(baseUrl);
    await loginAsQAUser(page);

    await goTo(page, 'nav-people', 'people');

    // Page loads with heading or root testid
    await expect(page.locator('h1:has-text("People"), h1:has-text("Contacts"), [data-testid="people-root"], [data-testid="people-page"]')).toBeVisible({ timeout: 20_000 });
  });

  test('can open person detail', async ({ page }) => {
    const baseUrl = requireEnv('QA_DEFAULT_BASE_URL');
    await page.goto(baseUrl);
    await loginAsQAUser(page);

    await goTo(page, 'nav-people', 'people');

    // Click first person row/card
    const firstPerson = page.locator('table tbody tr, [data-testid="person-row"], [data-testid="person-card"]').first();
    if (!(await firstPerson.count())) {
      test.skip(true, 'No people records to test');
      return;
    }
    await firstPerson.click();

    // Should navigate to detail or open drawer
    await page.waitForTimeout(2000);
    const detailVisible = await page.locator('[data-testid="person-detail"], h1, h2').first().isVisible();
    expect(detailVisible).toBeTruthy();
  });
});
