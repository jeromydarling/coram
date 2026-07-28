import { test, expect } from '@playwright/test';
import { requireEnv } from '../helpers/env';

/**
 * Public Event Page — smoke tests for /events/:slug route.
 *
 * WHAT: Tests that public event pages load, display event info, and show registration forms.
 * WHERE: /events/:slug (public, no auth required)
 * WHY: Validates the end-to-end public registration experience for community members.
 */
test.describe('Public Event Page', () => {
  test('event not-found page renders gracefully', async ({ page }) => {
    const baseUrl = requireEnv('QA_DEFAULT_BASE_URL');
    await page.goto(`${baseUrl}/events/non-existent-event-slug-12345`);
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
    await page.waitForTimeout(1000);

    // Should show a "not found" or error state, not crash
    const body = await page.locator('body').textContent();
    expect(body).toBeTruthy();

    // Look for the not-found message
    const notFound = page.locator('text=could not be found');
    const isNotFound = await notFound.count();
    expect(isNotFound).toBeGreaterThanOrEqual(1);
  });

  test('public event page loads with event details if slug exists', async ({ page }) => {
    const baseUrl = requireEnv('QA_DEFAULT_BASE_URL');

    // First, check if any events with slugs exist by navigating to a known test slug
    // If no seeded events, we test the not-found path (covered above)
    // Try to find a slug from the DB via the app's public route pattern
    await page.goto(`${baseUrl}/events/test-event`);
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
    await page.waitForTimeout(1000);

    const body = await page.locator('body').textContent();
    expect(body).toBeTruthy();

    // Either we see event details or "could not be found" — both are valid
    const hasEventName = await page.locator('h1').count();
    const hasNotFound = await page.locator('text=could not be found').count();
    expect(hasEventName + hasNotFound).toBeGreaterThanOrEqual(1);
  });

  test('registration form shows required fields', async ({ page }) => {
    const baseUrl = requireEnv('QA_DEFAULT_BASE_URL');
    await page.goto(`${baseUrl}/events/test-event`);
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
    await page.waitForTimeout(1000);

    // Skip if event doesn't exist
    const notFound = await page.locator('text=could not be found').count();
    if (notFound > 0) {
      test.skip(true, 'No test event with slug "test-event" exists');
      return;
    }

    // Check for registration form fields
    const nameField = page.locator('#reg-name, input[placeholder*="name" i]');
    const emailField = page.locator('#reg-email, input[type="email"]');

    await expect(nameField.first()).toBeVisible({ timeout: 10_000 });
    await expect(emailField.first()).toBeVisible({ timeout: 10_000 });

    // Register button should be present
    const registerBtn = page.locator('button:has-text("Register")');
    await expect(registerBtn.first()).toBeVisible({ timeout: 10_000 });
  });

  test('registration form validates empty submission', async ({ page }) => {
    const baseUrl = requireEnv('QA_DEFAULT_BASE_URL');
    await page.goto(`${baseUrl}/events/test-event`);
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
    await page.waitForTimeout(1000);

    const notFound = await page.locator('text=could not be found').count();
    if (notFound > 0) {
      test.skip(true, 'No test event with slug "test-event" exists');
      return;
    }

    // Try to submit empty form — should be blocked by HTML5 required validation
    const registerBtn = page.locator('button:has-text("Register")').first();
    // Button should be disabled when name/email are empty
    const isDisabled = await registerBtn.isDisabled();
    expect(isDisabled).toBeTruthy();
  });
});
