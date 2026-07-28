import type { Page } from '@playwright/test';
import { requireEnv } from './env';

/**
 * Log in as the QA demo user via the login form.
 * Expects data-testid attributes on the login page inputs.
 */
export async function loginAsQAUser(page: Page) {
  const email = process.env.QA_LOGIN_EMAIL || process.env.QA_EMAIL || 'qa-demo@thecros.app';
  const password = requireEnv('QA_LOGIN_PASSWORD');

  // Navigate to login if not already there
  if (!page.url().includes('/login')) {
    const baseUrl = requireEnv('QA_DEFAULT_BASE_URL');
    await page.goto(baseUrl.replace(/\/?$/, '/login'), { waitUntil: 'domcontentloaded' });
  }

  await page.fill('[data-testid="login-email"], input[type="email"]', email);
  await page.fill('[data-testid="login-password"], input[type="password"]', password);
  await page.click('[data-testid="login-submit"], button[type="submit"]');

  // Wait for redirect away from login
  await page.waitForURL(/(?!.*\/login)/, { timeout: 20_000 });

  // Let the post-login page settle — prevents screenshots of partially-loaded dashboards
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
  await page.waitForTimeout(1000);

  // Dismiss PWA install prompt if present
  const dismissBtn = page.locator('text=Not now');
  if (await dismissBtn.count() > 0) {
    await dismissBtn.click().catch(() => {});
    await page.waitForTimeout(500);
  }
}
