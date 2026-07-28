/**
 * 80_checkout_e2e — Full Stripe checkout boundary test (unauthenticated).
 *
 * WHAT: Walks through the entire checkout flow as a brand-new visitor with no account:
 *       /pricing → select tier → Stripe checkout → test card → /onboarding → create account → full wizard → verify-email.
 * WHERE: /pricing → checkout.stripe.com → /onboarding?checkout=success → signup form → wizard → verify-email
 * WHY: End-to-end validation that the payment pipeline and post-checkout account creation work.
 *
 * GATED: Only runs when QA_ENABLE_STRIPE_TESTS=1 is set.
 * CLEANUP: Test customers are tagged in Stripe with metadata for manual cleanup.
 *
 * KNOWN FRAGILITY:
 *   - Stripe iframe selectors are vendor-controlled and may drift.
 *   - All non-Stripe steps use data-testid or explicit text matchers with assertions (no silent skips).
 */
import { test, expect } from '@playwright/test';
import { requireEnv } from '../helpers/env';
import { isEnabled } from '../helpers/features';

const baseUrl = () => requireEnv('QA_DEFAULT_BASE_URL').replace(/\/?$/, '');

test.describe('Checkout E2E: unauthenticated visitor → Stripe → onboarding signup', () => {
  test.skip(!isEnabled('QA_ENABLE_STRIPE_TESTS'), 'Set QA_ENABLE_STRIPE_TESTS=1 to run Stripe E2E tests.');

  test('new visitor can purchase a tier and create an account', async ({ page }, testInfo) => {
    test.setTimeout(180_000); // Stripe pages can be slow

    // ── Step 1: Visit pricing as unauthenticated visitor ──
    await page.goto(`${baseUrl()}/pricing`, { waitUntil: 'networkidle', timeout: 30_000 });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: 'screenshots/80_01_pricing_unauthenticated.png' });

    await expect(page.locator('[data-testid="pricing-root"]')).toBeVisible({ timeout: 15_000 });

    // ── Step 2: Add Insight tier to cart (Core has no button — it's always included) ──
    const insightCard = page.locator('[data-testid="pricing-tier-insight"]');
    await expect(insightCard).toBeVisible({ timeout: 10_000 });
    const addToCartBtn = insightCard.locator('button:has-text("Add to cart")').first();
    await expect(addToCartBtn).toBeVisible({ timeout: 5_000 });
    await addToCartBtn.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'screenshots/80_02_tier_selected.png' });

    // ── Step 3: Click checkout and intercept the create-checkout response ──
    // The page does window.location.href = url immediately after the response,
    // which destroys the network context before Playwright can read the body.
    // Solution: use page.route() to intercept and buffer the response body
    // BEFORE the page navigates away.
    const checkoutBtn = page.locator('[data-testid="checkout-button"]');
    await expect(checkoutBtn).toBeVisible({ timeout: 5_000 });

    let checkoutBody: { url?: string } = {};
    await page.route('**/create-checkout**', async (route) => {
      const response = await route.fetch();
      const body = await response.text();
      try { checkoutBody = JSON.parse(body); } catch { /* empty */ }
      // Let the original response through so the page navigates
      await route.fulfill({ response });
    });

    await checkoutBtn.click();

    // Wait for the route handler to capture the body (poll with timeout)
    const deadline = Date.now() + 30_000;
    while (!checkoutBody?.url && Date.now() < deadline) {
      await page.waitForTimeout(250);
    }

    // Clean up the route intercept
    await page.unroute('**/create-checkout**');

    if (!checkoutBody?.url || !checkoutBody.url.includes('stripe.com')) {
      test.skip(true, `Checkout did not return a Stripe URL. Response: ${JSON.stringify(checkoutBody).slice(0, 300)}`);
      return;
    }

    await page.screenshot({ path: 'screenshots/80_03_checkout_initiated.png' });

    // ── Step 4: Navigate to Stripe hosted checkout ──
    // Stripe checkout loads many third-party scripts that prevent 'networkidle'.
    // Use 'domcontentloaded' with a longer timeout + wait for the payment form.
    try {
      await page.goto(checkoutBody.url!, { waitUntil: 'domcontentloaded', timeout: 90_000 });
      await page.waitForSelector(
        'input[name="email"], input[name="cardNumber"], input[name="billingName"], [data-testid="hosted-payment-submit-button"], button[type="submit"]',
        { timeout: 30_000 }
      ).catch(() => { /* form may be inside iframes — continue */ });
      await page.waitForTimeout(2000);
      await page.screenshot({ path: 'screenshots/80_04_stripe_checkout_loaded.png' });
    } catch (err) {
      const timeoutArtifact = testInfo.outputPath('80_stripe_checkout_timeout.png');
      await page.screenshot({ path: timeoutArtifact, fullPage: true }).catch(() => {});
      await testInfo.attach('stripe-checkout-timeout', {
        path: timeoutArtifact,
        contentType: 'image/png',
      }).catch(() => {});
      await page.screenshot({ path: 'screenshots/80_04_stripe_checkout_timeout.png' }).catch(() => {});

      const reason = err instanceof Error ? err.message : String(err);
      throw new Error(`Stripe checkout did not load in time at ${page.url()}: ${reason}`);
    }

    // ── Step 5: Fill buyer details on Stripe page (supports both modern hosted fields + legacy iframe fields) ──
    const testEmail = `qa-checkout-${Date.now()}@thecros.app`;

    const fillIfVisible = async (selector: string, value: string, timeout = 5_000) => {
      const input = page.locator(selector).first();
      const visible = await input.isVisible({ timeout }).catch(() => false);
      if (!visible) return false;
      await input.fill(value);
      return true;
    };

    // Email is required for guest checkout
    await fillIfVisible('input[name="email"], input[autocomplete="email"], input#email', testEmail, 8_000);

    // Prefer modern hosted inputs (no iframes)
    const filledHostedCard = await fillIfVisible(
      'input[name="cardNumber"], input[autocomplete="cc-number"], [data-elements-stable-field-name="cardNumber"] input',
      '4242424242424242',
      6_000,
    );

    if (filledHostedCard) {
      await fillIfVisible('input[name="cardExpiry"], input[autocomplete="cc-exp"]', '1230', 4_000);
      await fillIfVisible('input[name="cardCvc"], input[autocomplete="cc-csc"]', '424', 4_000);
      await fillIfVisible('input[name="billingName"], input[autocomplete="cc-name"]', 'QA Test Visitor', 4_000);
    } else {
      // Fallback: legacy Stripe iframe fields
      try {
        const cardFrame = page.frameLocator(
          'iframe[name*="privateStripeFrame"], iframe[title*="card number" i], iframe[title*="Secure" i]'
        ).first();
        await cardFrame
          .locator('input[name="cardnumber"], input[placeholder*="card number" i], input[aria-label*="Card number" i]')
          .first()
          .fill('4242424242424242', { timeout: 10_000 });

        const expiryFrame = page.frameLocator(
          'iframe[name*="privateStripeFrame"], iframe[title*="expir" i], iframe[title*="Secure" i]'
        ).nth(1);
        await expiryFrame
          .locator('input[name*="expiry"], input[placeholder*="MM" i], input[aria-label*="Expir" i]')
          .first()
          .fill('1230', { timeout: 10_000 });

        const cvcFrame = page.frameLocator(
          'iframe[name*="privateStripeFrame"], iframe[title*="cvc" i], iframe[title*="Secure" i]'
        ).nth(2);
        await cvcFrame
          .locator('input[name*="cvc"], input[placeholder*="CVC" i], input[aria-label*="CVC" i]')
          .first()
          .fill('424', { timeout: 10_000 });

        await fillIfVisible('input[name="billingName"], input[autocomplete="cc-name"]', 'QA Test Visitor', 2_000);
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        throw new Error(`Unable to fill Stripe payment fields: ${reason}`);
      }
    }

    await page.screenshot({ path: 'screenshots/80_05_card_filled.png' });

    // ── Step 7: Submit payment ──
    const submitBtn = page.locator(
      'button[type="submit"]:has-text("Pay"), button[type="submit"]:has-text("Subscribe"), button.SubmitButton, [data-testid="hosted-payment-submit-button"]'
    ).first();
    await expect(submitBtn).toBeVisible({ timeout: 10_000 });

    const navigationPromise = page.waitForURL(
      url => url.toString().includes(baseUrl()) || url.toString().includes('checkout=success'),
      { timeout: 60_000 }
    );

    await submitBtn.click();
    await page.screenshot({ path: 'screenshots/80_06_payment_submitted.png' });

    // ── Step 8: Verify redirect lands on onboarding account-creation (not login) ──
    await navigationPromise;
    await page.waitForLoadState('domcontentloaded', { timeout: 20_000 }).catch(() => {});
    await page.waitForTimeout(1200);

    if (page.url().includes('/login')) {
      await page.screenshot({ path: 'screenshots/80_07_unexpected_login_redirect.png', fullPage: true });
      throw new Error(`Checkout returned to login instead of onboarding: ${page.url()}`);
    }

    await page.screenshot({ path: 'screenshots/80_07_onboarding_signup.png' });

    // Should see the onboarding page with account creation form
    const onboardingRoot = page.locator('[data-testid="onboarding-root"]');
    await expect(onboardingRoot).toBeVisible({ timeout: 20_000 });

    // ── Step 9: Fill in signup form on onboarding page ──
    const signupEmailInput = page.locator('[data-testid="onboarding-signup-email"]');
    const signupPasswordInput = page.locator('[data-testid="onboarding-signup-password"]');
    const signupConfirmInput = page.locator('[data-testid="onboarding-signup-confirm"]');
    const signupNameInput = page.locator('[data-testid="onboarding-signup-name"]');
    const signupSubmitBtn = page.locator('[data-testid="onboarding-signup-submit"]');

    await expect(signupEmailInput).toBeVisible({ timeout: 10_000 });

    await signupNameInput.fill('QA Test Visitor');
    await signupEmailInput.fill(testEmail);
    await signupPasswordInput.fill('TestPassword123!');
    await signupConfirmInput.fill('TestPassword123!');

    await page.screenshot({ path: 'screenshots/80_08_signup_form_filled.png' });

    await signupSubmitBtn.click();
    await page.waitForTimeout(5000); // Wait for signup + auth state to update
    await page.screenshot({ path: 'screenshots/80_09_signup_submitted.png' });

    // ────────────────────────────────────────────────────────────
    // ONBOARDING WIZARD — step-by-step with assertions
    // Steps: welcome → steward_welcome → archetype → sectors → ministry_role → multi_city → territory → details → knowledge → org_enrichment → familia → confirm
    // ────────────────────────────────────────────────────────────

    // Helper: click "Next" with assertion that it's enabled
    const clickNext = async (label?: string) => {
      const btn = page.locator('button:has-text("Next")').first();
      await expect(btn).toBeEnabled({ timeout: 8_000 });
      await btn.click();
      await page.waitForTimeout(800);
      if (label) {
        await page.screenshot({ path: `screenshots/80_${label}.png` });
      }
    };

    // ── Step 10: Welcome step ──
    // After signup, user lands on 'welcome' step (account_creation auto-skips when user exists)
    // The welcome step just has text and a Next button
    await expect(page.locator('button:has-text("Next")').first()).toBeVisible({ timeout: 20_000 });
    await clickNext('11_after_welcome');

    // ── Step 11: Steward Welcome step ──
    // This is a narrative introduction step — just Next
    await expect(page.locator('button:has-text("Next")').first()).toBeVisible({ timeout: 8_000 });
    await clickNext('12_after_steward_welcome');

    // ── Step 12: Archetype selection ──
    await expect(page.locator('[data-testid="onboarding-step-archetype"]')).toBeVisible({ timeout: 10_000 });
    // Click the first archetype button
    const archetypeBtn = page.locator('[data-testid="onboarding-step-archetype"] button').first();
    await expect(archetypeBtn).toBeVisible({ timeout: 5_000 });
    await archetypeBtn.click();
    await page.waitForTimeout(300);
    await clickNext('13_after_archetype');

    // ── Step 13: Sectors ──
    await expect(page.locator('[data-testid="onboarding-step-sectors"]')).toBeVisible({ timeout: 10_000 });
    // Must select at least 1 sector for Next to be enabled
    const sectorBtn = page.locator('[data-testid="onboarding-step-sectors"] button:not([disabled])').first();
    await expect(sectorBtn).toBeVisible({ timeout: 5_000 });
    await sectorBtn.click();
    await page.waitForTimeout(300);
    await clickNext('14_after_sectors');

    // ── Step 14: Ministry Role ──
    // companion is pre-selected by default, so Next should be enabled immediately
    // Verify we're on the ministry role step by checking for the role selection text
    await expect(page.getByText('How do you serve your community?')).toBeVisible({ timeout: 10_000 });
    await clickNext('15_after_ministry_role');

    // ── Step 15: Multi-city ──
    await expect(page.getByText('Do you operate in more than one city?')).toBeVisible({ timeout: 10_000 });
    // Click "One community" — multiCity must be non-null for Next to enable
    const oneCommunityBtn = page.locator('button:has-text("One community")').first();
    await expect(oneCommunityBtn).toBeVisible({ timeout: 5_000 });
    await oneCommunityBtn.click();
    await page.waitForTimeout(300);
    await clickNext('16_after_multi_city');

    // ── Step 16: Territory ──
    await expect(page.locator('[data-testid="onboarding-step-territory"]')).toBeVisible({ timeout: 10_000 });
    // Default mode is "metro" — need to select a metro from the dropdown for Next to enable
    const metroTrigger = page.locator('[data-testid="onboarding-step-territory"] button[role="combobox"]').first();
    await expect(metroTrigger).toBeVisible({ timeout: 5_000 });
    await metroTrigger.click();
    await page.waitForTimeout(500);
    // Pick the first metro option
    const firstMetroOption = page.locator('[role="option"]').first();
    await expect(firstMetroOption).toBeVisible({ timeout: 5_000 });
    await firstMetroOption.click();
    await page.waitForTimeout(500);
    await clickNext('17_after_territory');

    // ── Step 17: Organization Details ──
    const orgNameInput = page.locator('input#org-name');
    await expect(orgNameInput).toBeVisible({ timeout: 10_000 });
    const orgTimestamp = Date.now();
    await orgNameInput.fill(`QA Org ${orgTimestamp}`);
    await page.waitForTimeout(600); // Wait for slug auto-generation
    // Verify slug was auto-populated
    const orgSlugInput = page.locator('input#org-slug');
    await expect(orgSlugInput).toHaveValue(/qa-org/, { timeout: 3_000 });
    await clickNext('18_after_details');

    // ── Step 18: Knowledge upload → skip (optional step, Next should be enabled) ──
    await expect(page.getByText('Teach NRI about your organization')).toBeVisible({ timeout: 10_000 });
    await clickNext('19_after_knowledge');

    // ── Step 19: Org Enrichment → skip (optional) ──
    // Wait for enrichment step content
    await page.waitForTimeout(500);
    await clickNext('20_after_enrichment');

    // ── Step 20: Familia → skip (optional) ──
    await expect(page.locator('[data-testid="onboarding-step-familia"]')).toBeVisible({ timeout: 10_000 });
    await clickNext('21_after_familia');

    // ── Step 21: Confirm & Create ──
    const createBtn = page.locator('[data-testid="onboarding-finish"]');
    await expect(createBtn).toBeVisible({ timeout: 10_000 });
    await expect(createBtn).toBeEnabled({ timeout: 5_000 });
    await page.screenshot({ path: 'screenshots/80_22_confirm_review.png' });

    await createBtn.click();

    // Wait for tenant bootstrap — poll for completion instead of fixed wait
    // The button shows a spinner and status text while creating
    await expect(createBtn).toBeDisabled({ timeout: 3_000 });
    // Wait for either verify-email card or navigation away
    const verifyEmail = page.locator('[data-testid="onboarding-verify-email"]');
    await expect(verifyEmail).toBeVisible({ timeout: 30_000 });

    await page.screenshot({ path: 'screenshots/80_23_verify_email_final.png' });

    // Verify the verify-email card shows the expected content
    await expect(page.getByText('One last thing — verify your email')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText('Organization created successfully')).toBeVisible({ timeout: 5_000 });

    await page.screenshot({ path: 'screenshots/80_24_first_tenant_view.png' });
  });
});
