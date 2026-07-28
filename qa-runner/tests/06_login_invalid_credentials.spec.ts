import { test, expect } from '@playwright/test';
import { requireEnv } from '../helpers/env';

test.describe('Auth: invalid login', () => {
  test('shows error for invalid credentials', async ({ page }) => {
    const baseUrl = requireEnv('QA_DEFAULT_BASE_URL');
    await page.goto(baseUrl.replace(/\/?$/, '/login'));

    await page.fill('[data-testid="login-email"]', 'invalid@example.com');
    await page.fill('[data-testid="login-password"]', 'not-a-real-password');
    await page.click('[data-testid="login-submit"]');

    // Error is shown in an Alert component — match any error text
    await expect(
      page.locator('[role="alert"]')
        .or(page.locator('[data-testid="login-error"]'))
        .or(page.getByText(/invalid|incorrect|error|credentials|not found/i))
    ).toBeVisible({ timeout: 20_000 });
  });
});
