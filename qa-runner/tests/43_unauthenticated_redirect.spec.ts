import { test, expect } from '@playwright/test';
import { requireEnv } from '../helpers/env';

test.describe('Auth: unauthenticated redirect', () => {
  test('unauthenticated user is redirected to /login', async ({ page }) => {
    const baseUrl = requireEnv('QA_DEFAULT_BASE_URL');

    // Try accessing a protected route without logging in
    await page.goto(baseUrl.replace(/\/?$/, '/opportunities'), { waitUntil: 'domcontentloaded' });

    // Should redirect to login
    await page.waitForURL(/login/, { timeout: 20_000 });
    await expect(page.locator('[data-testid="login-email"], input[type="email"]').first()).toBeVisible({ timeout: 10_000 });
  });

  test('unauthenticated user cannot access admin', async ({ page }) => {
    const baseUrl = requireEnv('QA_DEFAULT_BASE_URL');

    await page.goto(baseUrl.replace(/\/?$/, '/admin'), { waitUntil: 'domcontentloaded' });

    await page.waitForURL(/login/, { timeout: 20_000 });
  });

  test('unauthenticated user can access pricing page', async ({ page }) => {
    const baseUrl = requireEnv('QA_DEFAULT_BASE_URL');

    await page.goto(baseUrl.replace(/\/?$/, '/pricing'), { waitUntil: 'domcontentloaded' });

    await expect(page.locator('[data-testid="pricing-root"]')).toBeVisible({ timeout: 20_000 });
  });
});
