import { test, expect } from '@playwright/test';
import { requireEnv } from '../helpers/env';
import { loginAsQAUser } from '../helpers/auth';
import { isEnabled } from '../helpers/features';
import { goTo } from '../helpers/nav';

test.describe('Relatio marketplace', () => {
  test('marketplace loads (optional)', async ({ page }) => {
    test.skip(!isEnabled('QA_ENABLE_RELATIO_TESTS'), 'Enable when Relatio Marketplace is configured for the QA tenant.');

    const baseUrl = requireEnv('QA_DEFAULT_BASE_URL');
    await page.goto(baseUrl);
    await loginAsQAUser(page);

    await goTo(page, 'nav-relatio');
    await expect(page.locator('text=Relatio, text=Marketplace, [data-testid="relatio-root"]')).toBeVisible({ timeout: 20_000 });
  });
});
