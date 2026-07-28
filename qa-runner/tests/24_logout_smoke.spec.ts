import { test, expect } from '@playwright/test';
import { requireEnv } from '../helpers/env';
import { loginAsQAUser } from '../helpers/auth';

test.describe('Logout', () => {
  test('user can sign out from avatar menu', async ({ page }) => {
    const baseUrl = requireEnv('QA_DEFAULT_BASE_URL');
    await page.goto(baseUrl);
    await loginAsQAUser(page);

    const userMenu = page.locator('[data-testid="user-menu"]');
    await userMenu.click();

    const signOut = page.locator('[data-testid="sign-out"]')
      .or(page.getByText('Sign Out'))
      .or(page.getByText('Log Out'))
      .first();
    await signOut.click();

    await page.waitForURL(/\/login|\/pricing|\/$/, { timeout: 20_000 });
    await expect(page).toHaveURL(/login|pricing|\/$/);
  });
});
