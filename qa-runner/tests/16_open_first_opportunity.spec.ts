import { test, expect } from '@playwright/test';
import { requireEnv } from '../helpers/env';
import { loginAsQAUser } from '../helpers/auth';
import { goTo } from '../helpers/nav';

test.describe('Opportunities: list + open detail', () => {
  test('can open first opportunity row', async ({ page }) => {
    const baseUrl = requireEnv('QA_DEFAULT_BASE_URL');
    await page.goto(baseUrl);
    await loginAsQAUser(page);

    await goTo(page, 'nav-opportunities', 'opportunit');

    const firstRow = page.locator('[data-testid="opportunity-row"]').first();
    if (!(await firstRow.count())) {
      test.skip(true, 'No opportunities exist to open');
      return;
    }
    await firstRow.click();

    await expect(
      page.locator('[data-testid="opportunity-detail-root"]')
    ).toBeVisible({ timeout: 20_000 });
  });
});
