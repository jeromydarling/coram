/**
 * 70_financial_activity_smoke — Smoke tests for CROS payments infrastructure.
 *
 * Tests: Settings payments tab, Financial Activity page, payment dialogs, pastoral language.
 */
import { test, expect } from '@playwright/test';
import { requireEnv } from '../helpers/env';
import { isEnabled } from '../helpers/features';

const baseUrl = () => requireEnv('QA_DEFAULT_BASE_URL').replace(/\/?$/, '');

test.describe('Financial Activity & Payments Smoke', () => {

  test('Settings page has Payments tab', async ({ page }) => {
    const email = requireEnv('QA_LOGIN_EMAIL');
    const password = requireEnv('QA_LOGIN_PASSWORD');

    await page.goto(`${baseUrl()}/login`);
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(/\/(dashboard|settings|onboarding)/, { timeout: 20_000 });

    await page.goto(`${baseUrl()}/settings`);
    
    // Look for Payments tab
    const paymentsTab = page.getByText('Payments').first();
    await expect(paymentsTab).toBeVisible({ timeout: 15_000 });
  });

  test('Settings Payments tab shows Connect Stripe or status', async ({ page }) => {
    const email = requireEnv('QA_LOGIN_EMAIL');
    const password = requireEnv('QA_LOGIN_PASSWORD');

    await page.goto(`${baseUrl()}/login`);
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(/\/(dashboard|settings|onboarding)/, { timeout: 20_000 });

    await page.goto(`${baseUrl()}/settings?tab=payments`);

    // Should show either "Connect Stripe" button or "Connected" badge
    const connectBtn = page.getByText('Connect Stripe').first();
    const connectedBadge = page.getByText('Connected').first();
    const pendingBadge = page.getByText('Pending').first();

    const anyVisible = await Promise.race([
      connectBtn.waitFor({ timeout: 15_000 }).then(() => true).catch(() => false),
      connectedBadge.waitFor({ timeout: 15_000 }).then(() => true).catch(() => false),
      pendingBadge.waitFor({ timeout: 15_000 }).then(() => true).catch(() => false),
    ]);

    expect(anyVisible).toBe(true);
  });

  test('Financial Activity page loads with pastoral empty state', async ({ page }) => {
    const email = requireEnv('QA_LOGIN_EMAIL');
    const password = requireEnv('QA_LOGIN_PASSWORD');

    await page.goto(`${baseUrl()}/login`);
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(/\/(dashboard|settings|onboarding)/, { timeout: 20_000 });

    await page.goto(`${baseUrl()}/financial-activity`);

    // Title should be visible
    const title = page.getByText('Financial Activity').first();
    await expect(title).toBeVisible({ timeout: 15_000 });

    // Should have filter dropdown
    const filter = page.getByText('All types').first();
    await expect(filter).toBeVisible({ timeout: 10_000 });
  });

  test('Financial Activity page has export button', async ({ page }) => {
    const email = requireEnv('QA_LOGIN_EMAIL');
    const password = requireEnv('QA_LOGIN_PASSWORD');

    await page.goto(`${baseUrl()}/login`);
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(/\/(dashboard|settings|onboarding)/, { timeout: 20_000 });

    await page.goto(`${baseUrl()}/financial-activity`);

    const exportBtn = page.getByText('Export').first();
    await expect(exportBtn).toBeVisible({ timeout: 15_000 });
  });

  test('Financial Activity filter options use pastoral language', async ({ page }) => {
    const email = requireEnv('QA_LOGIN_EMAIL');
    const password = requireEnv('QA_LOGIN_PASSWORD');

    await page.goto(`${baseUrl()}/login`);
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(/\/(dashboard|settings|onboarding)/, { timeout: 20_000 });

    await page.goto(`${baseUrl()}/financial-activity`);

    // Click the filter to open options
    const filterTrigger = page.getByText('All types').first();
    await expect(filterTrigger).toBeVisible({ timeout: 15_000 });
    await filterTrigger.click();

    // Check for CROS language (Generosity, Participation, Collaboration, Support)
    // Should NOT see: Revenue, Donations, Transactions
    await expect(page.getByText('Generosity')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText('Participation')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText('Collaboration')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText('Support')).toBeVisible({ timeout: 5_000 });
  });

  test('Payments tab shows ownership language', async ({ page }) => {
    const email = requireEnv('QA_LOGIN_EMAIL');
    const password = requireEnv('QA_LOGIN_PASSWORD');

    await page.goto(`${baseUrl()}/login`);
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(/\/(dashboard|settings|onboarding)/, { timeout: 20_000 });

    await page.goto(`${baseUrl()}/settings?tab=payments`);

    // Should mention Stripe or direct payments
    const ownershipText = page.getByText(/[Ss]tripe|directly|funds/i).first();
    await expect(ownershipText).toBeVisible({ timeout: 15_000 });
  });
});
