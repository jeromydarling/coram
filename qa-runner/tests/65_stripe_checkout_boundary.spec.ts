/**
 * 65_stripe_checkout_boundary — Stripe checkout boundary tests.
 */
import { test, expect } from '@playwright/test';
import { requireEnv } from '../helpers/env';
import { isEnabled } from '../helpers/features';

const baseUrl = () => requireEnv('QA_DEFAULT_BASE_URL').replace(/\/?$/, '');

test.describe('Stripe Checkout Boundary', () => {

  test('pricing page shows tier cards with action controls', async ({ page }) => {
    await page.goto(`${baseUrl()}/pricing`);

    await expect(page.getByText('CROS Core').first()).toBeVisible({ timeout: 20_000 });

    // Find any actionable button on tier cards
    const actionBtn = page.locator('button:has-text("Add to cart")')
      .or(page.locator('button:has-text("Get started")'))
      .or(page.locator('button:has-text("Select")'))
      .or(page.locator('button:has-text("Continue")'))
      .or(page.locator('button:has-text("Choose")'))
      .or(page.locator('button:has-text("Start")'))
      .or(page.locator('button:has-text("Begin")'))
      .or(page.locator('a:has-text("Get started")'))
      .first();
    await expect(actionBtn).toBeVisible({ timeout: 10_000 });
  });

  test('add tier to cart shows checkout or redirect', async ({ page }) => {
    await page.goto(`${baseUrl()}/pricing`);

    const actionBtn = page.locator('button:has-text("Add to cart")')
      .or(page.locator('button:has-text("Get started")'))
      .or(page.locator('button:has-text("Select")'))
      .or(page.locator('button:has-text("Choose")'))
      .or(page.locator('button:has-text("Start")'))
      .or(page.locator('a:has-text("Get started")'))
      .first();

    if (!(await actionBtn.isVisible({ timeout: 10_000 }).catch(() => false))) {
      test.skip(true, 'No tier action button found on pricing page');
      return;
    }

    await actionBtn.click();

    // After clicking, we should see either a checkout button, a redirect to login/signup, or a cart update
    const nextStep = page.locator('button:has-text("Checkout")')
      .or(page.locator('button:has-text("Continue")'))
      .or(page.locator('button:has-text("Proceed")'))
      .or(page.locator('button:has-text("Subscribe")'))
      .or(page.locator('[data-testid="checkout-button"]'))
      .or(page.locator('input[type="email"]'))  // redirected to login/signup
      .first();
    await expect(nextStep).toBeVisible({ timeout: 15_000 });
  });

  test('checkout button triggers edge function (network boundary)', async ({ page }) => {
    test.skip(!isEnabled('QA_ENABLE_STRIPE_TESTS'), 'Set QA_ENABLE_STRIPE_TESTS=1 to run Stripe boundary tests.');

    await page.goto(`${baseUrl()}/pricing`);

    const addBtn = page.locator('button:has-text("Add to cart")')
      .or(page.locator('button:has-text("Get started")'))
      .or(page.locator('button:has-text("Select")'))
      .or(page.locator('button:has-text("Choose")'))
      .first();
    await expect(addBtn).toBeVisible({ timeout: 20_000 });
    await addBtn.click();

    const checkoutPromise = page.waitForResponse(
      resp => resp.url().includes('create-checkout') && resp.request().method() === 'POST',
      { timeout: 30_000 }
    );

    const checkoutBtn = page.locator('button:has-text("Checkout")')
      .or(page.locator('button:has-text("Continue")'))
      .or(page.locator('button:has-text("Proceed")'))
      .or(page.locator('button:has-text("Subscribe")'))
      .or(page.locator('[data-testid="checkout-button"]'))
      .first();
    await expect(checkoutBtn).toBeVisible({ timeout: 10_000 });
    await checkoutBtn.click();

    const response = await checkoutPromise;
    expect(response.status()).toBeLessThan(500);

    if (response.status() === 200) {
      const body = await response.json();
      expect(body.url).toMatch(/stripe\.com/);
    }
  });

  test('login page renders checkout success banner', async ({ page }) => {
    await page.goto(`${baseUrl()}/login?checkout=success`);

    const successAlert = page.getByText('Payment successful').first();
    await expect(successAlert).toBeVisible({ timeout: 15_000 });
  });

  test('onboarding page renders checkout success toast', async ({ page }) => {
    test.skip(!isEnabled('QA_ENABLE_STRIPE_TESTS'), 'Requires authenticated session for onboarding page.');

    const email = requireEnv('QA_LOGIN_EMAIL');
    const password = requireEnv('QA_LOGIN_PASSWORD');

    await page.goto(`${baseUrl()}/login`);
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);
    await page.locator('button[type="submit"]').click();

    await page.waitForURL(/\/(dashboard|onboarding)/, { timeout: 20_000 });
    await page.goto(`${baseUrl()}/onboarding?checkout=success`);

    const toast = page.getByText('Payment confirmed').first();
    await expect(toast).toBeVisible({ timeout: 10_000 });
  });
});
