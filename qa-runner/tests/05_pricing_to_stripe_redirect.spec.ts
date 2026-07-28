import { test, expect } from '@playwright/test';
import { requireEnv } from '../helpers/env';
import { isEnabled } from '../helpers/features';

test.describe('Checkout: Pricing → Stripe redirect', () => {
  test('redirects to Stripe hosted checkout (optional)', async ({ page }) => {
    test.skip(!isEnabled('QA_ENABLE_STRIPE_TESTS'), 'Set QA_ENABLE_STRIPE_TESTS=1 to run Stripe redirect tests.');

    const baseUrl = requireEnv('QA_DEFAULT_BASE_URL');
    await page.goto(baseUrl.replace(/\/?$/, '/pricing'));

    const addToCart = page.locator('button:has-text("Add to cart")')
      .or(page.locator('button:has-text("Get started")'))
      .or(page.locator('button:has-text("Continue")'))
      .first();
    await expect(addToCart).toBeVisible({ timeout: 20_000 });
    await addToCart.click();

    const checkout = page.locator('button:has-text("Checkout")')
      .or(page.locator('button:has-text("Continue")'))
      .or(page.locator('a:has-text("Checkout")'))
      .first();
    await expect(checkout).toBeVisible({ timeout: 20_000 });
    await checkout.click();

    await page.waitForURL(/stripe\.com|checkout\.stripe\.com/, { timeout: 30_000 });
    await expect(page).toHaveURL(/stripe\.com|checkout\.stripe\.com/);
  });
});
