import { test, expect } from '@playwright/test';
import { requireEnv } from '../helpers/env';
import { loginAsQAUser } from '../helpers/auth';
import { goTo } from '../helpers/nav';

test.describe('Discovery: Find Events', () => {
  test('find events loads', async ({ page }) => {
    const baseUrl = requireEnv('QA_DEFAULT_BASE_URL');
    await page.goto(baseUrl);
    await loginAsQAUser(page);

    await goTo(page, 'nav-find-events', 'find');
    await expect(
      page.locator('[data-testid="find-events-root"]')
    ).toBeVisible({ timeout: 20_000 });
  });
});
