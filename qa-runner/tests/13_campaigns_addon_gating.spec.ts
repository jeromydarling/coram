import { test, expect } from '@playwright/test';
import { requireEnv } from '../helpers/env';
import { loginAsQAUser } from '../helpers/auth';
import { isEnabled } from '../helpers/features';
import { goTo } from '../helpers/nav';

test.describe('Campaigns add-on gating', () => {
  test('campaigns nav is hidden or shows upgrade wall when not purchased', async ({ page }) => {
    test.skip(!isEnabled('QA_ENABLE_CAMPAIGN_TESTS'), 'Enable once campaigns gating + testids are stable.');

    const baseUrl = requireEnv('QA_DEFAULT_BASE_URL');
    await page.goto(baseUrl);
    await loginAsQAUser(page);

    // If nav item exists, open it and expect an upgrade message
    const campaignsNav = page.locator('[data-testid="nav-campaigns"]');
    if (await campaignsNav.count()) {
      await goTo(page, 'nav-campaigns');
      await expect(page.locator('text=Upgrade, text=Add-on, text=Campaigns')).toBeVisible({ timeout: 20_000 });
    } else {
      test.expect(true).toBeTruthy();
    }
  });
});
