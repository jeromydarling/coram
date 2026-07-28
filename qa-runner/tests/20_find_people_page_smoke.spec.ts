import { test, expect } from '@playwright/test';
import { requireEnv } from '../helpers/env';
import { loginAsQAUser } from '../helpers/auth';
import { goTo } from '../helpers/nav';

test.describe('Discovery: Find People', () => {
  test('find people loads', async ({ page }) => {
    const baseUrl = requireEnv('QA_DEFAULT_BASE_URL');
    await page.goto(baseUrl);
    await loginAsQAUser(page);

    await goTo(page, 'nav-find-people', 'find');
    await expect(
      page.locator('[data-testid="find-people-root"]')
    ).toBeVisible({ timeout: 20_000 });
  });
});
