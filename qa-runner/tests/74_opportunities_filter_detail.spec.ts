import { test, expect } from '@playwright/test';
import { requireEnv } from '../helpers/env';
import { loginAsQAUser } from '../helpers/auth';
import { goTo } from '../helpers/nav';

/**
 * Tenant: Opportunities — filter, sort, and detail navigation.
 */
test.describe('Opportunities: filter & detail', () => {
  test('stage filter or tabs visible', async ({ page }) => {
    const baseUrl = requireEnv('QA_DEFAULT_BASE_URL');
    await page.goto(baseUrl);
    await loginAsQAUser(page);
    await goTo(page, 'nav-opportunities', 'opportunit');

    // Should see stage tabs, filter dropdown, or stage labels
    await expect(
      page.getByText(/all|found|contacted|discovery/i).first()
    ).toBeVisible({ timeout: 15_000 });
  });

  test('clicking opportunity opens detail', async ({ page }) => {
    const baseUrl = requireEnv('QA_DEFAULT_BASE_URL');
    await page.goto(baseUrl);
    await loginAsQAUser(page);
    await goTo(page, 'nav-opportunities', 'opportunit');

    const firstRow = page.locator('[data-testid="opportunity-row"], tr, [class*="opportunity-card"]').first();
    if (!(await firstRow.count())) {
      test.skip(true, 'No opportunities to click');
      return;
    }

    await firstRow.click();
    // Should navigate to detail or open panel
    await page.waitForTimeout(2_000);
    await expect(
      page.getByText(/journey|stage|contact|detail/i).first()
    ).toBeVisible({ timeout: 10_000 });
  });
});
