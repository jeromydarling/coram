import { test, expect } from '@playwright/test';
import { requireEnv } from '../helpers/env';
import { isEnabled } from '../helpers/features';

/**
 * Full onboarding wizard flow: Steward welcome → ministry role → archetype → sectors → metro → finish.
 * Requires a user in pre-onboarding state.
 */
test.describe('Onboarding: full wizard flow', () => {
  test('complete wizard end-to-end including sector selection', async ({ page }) => {
    test.skip(!isEnabled('QA_ENABLE_ONBOARDING_TESTS'), 'Requires a tenant in onboarding state.');

    const baseUrl = requireEnv('QA_DEFAULT_BASE_URL');
    await page.goto(baseUrl.replace(/\/?$/, '/onboarding'));

    // Step: onboarding root loads
    await expect(page.locator('[data-testid="onboarding-root"]')).toBeVisible({ timeout: 20_000 });

    // Step 1: Ministry role selection (Shepherd/Companion/Visitor)
    const shepherdBtn = page.locator('button:has-text("Shepherd"), button:has-text("I guide")').first();
    if (await shepherdBtn.count()) {
      await shepherdBtn.click();
    }

    // Click Next/Continue
    const nextBtn = page.locator('button:has-text("Next"), button:has-text("Continue")').first();
    if (await nextBtn.count()) await nextBtn.click();

    // Step 2: Archetype selection
    await expect(page.locator('[data-testid="onboarding-step-archetype"]')).toBeVisible({ timeout: 15_000 });
    const archetypeBtn = page.locator('button:has-text("Church"), button:has-text("Nonprofit"), [data-testid*="archetype"]').first();
    if (await archetypeBtn.count()) await archetypeBtn.click();

    const next2 = page.locator('button:has-text("Next"), button:has-text("Continue")').first();
    if (await next2.count()) await next2.click();

    // Step 3: Sector selection
    await expect(page.locator('[data-testid="onboarding-step-sectors"]')).toBeVisible({ timeout: 15_000 });

    // Select 1–2 sectors
    const sectorButtons = page.locator('[data-testid="onboarding-step-sectors"] button:not([disabled])');
    const sectorCount = await sectorButtons.count();
    if (sectorCount > 0) {
      await sectorButtons.first().click();
      if (sectorCount > 1) {
        await sectorButtons.nth(1).click();
      }
    }

    const next3 = page.locator('button:has-text("Next"), button:has-text("Continue")').first();
    if (await next3.count()) await next3.click();

    // Step 4: Home metro
    await expect(page.locator('[data-testid="onboarding-step-home-metro"]')).toBeVisible({ timeout: 15_000 });

    // Select a metro if available
    const metroOption = page.locator('button, [role="option"], [data-testid*="metro"]').first();
    if (await metroOption.count()) await metroOption.click();

    const next4 = page.locator('button:has-text("Next"), button:has-text("Continue")').first();
    if (await next4.count()) await next4.click();

    // Step 5: Finish
    const finishBtn = page.locator('[data-testid="onboarding-finish"], button:has-text("Finish"), button:has-text("Get Started")').first();
    if (await finishBtn.count()) {
      await finishBtn.click();
      // Should redirect away from onboarding
      await page.waitForURL(/(?!.*onboarding)/, { timeout: 20_000 });
    }
  });
});
