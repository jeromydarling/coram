import { test, expect } from '@playwright/test';
import { requireEnv } from '../helpers/env';
import { loginAsQAUser } from '../helpers/auth';
import { goTo } from '../helpers/nav';

test.describe('Opportunities: edit detail tabs', () => {
  test('can open opportunity and view story tab', async ({ page }) => {
    const baseUrl = requireEnv('QA_DEFAULT_BASE_URL');
    await page.goto(baseUrl);
    await loginAsQAUser(page);

    await goTo(page, 'nav-opportunities', 'opportunit');

    // Open first opportunity
    const firstRow = page.locator('[data-testid="opportunity-row"]').first();
    if (!(await firstRow.count())) {
      test.skip(true, 'No opportunities exist to test');
      return;
    }
    await expect(firstRow).toBeVisible({ timeout: 20_000 });
    await firstRow.click();

    // Wait for detail page
    await expect(
      page.locator('[data-testid="opportunity-detail-root"]')
    ).toBeVisible({ timeout: 20_000 });

    // Click Story tab
    const storyTab = page.locator('[data-testid="opportunity-tab-story"], button:has-text("Story"), [role="tab"]:has-text("Story")').first();
    if (await storyTab.count()) {
      await storyTab.click();
      await page.waitForTimeout(1000);
    }
  });

  test('opportunity detail shows contact info', async ({ page }) => {
    const baseUrl = requireEnv('QA_DEFAULT_BASE_URL');
    await page.goto(baseUrl);
    await loginAsQAUser(page);

    await goTo(page, 'nav-opportunities', 'opportunit');

    const firstRow = page.locator('[data-testid="opportunity-row"]').first();
    if (!(await firstRow.count())) {
      test.skip(true, 'No opportunities exist to test');
      return;
    }
    await firstRow.click();

    await expect(
      page.locator('[data-testid="opportunity-detail-root"]')
    ).toBeVisible({ timeout: 20_000 });

    // Verify key detail sections exist — use .first() to avoid strict mode
    await expect(
      page.getByText(/Contact|People|Primary/i).first()
    ).toBeVisible({ timeout: 10_000 });
  });
});
