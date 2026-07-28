import { test, expect } from '@playwright/test';
import { requireEnv } from '../helpers/env';
import { loginAsQAUser } from '../helpers/auth';
import { goTo } from '../helpers/nav';

test.describe('Intel Feed', () => {
  test('intel feed loads', async ({ page }) => {
    const baseUrl = requireEnv('QA_DEFAULT_BASE_URL');
    await page.goto(baseUrl);
    await loginAsQAUser(page);

    const trigger = page.locator('[data-testid="nav-group-metros-trigger"]');
    if (!(await trigger.isVisible({ timeout: 5_000 }).catch(() => false))) {
      test.skip(true, 'Metros nav group not visible — Civitas may be disabled for this tenant.');
      return;
    }

    await goTo(page, 'nav-intel-feed');
    await expect(
      page.locator('[data-testid="intel-feed-root"]')
        .or(page.getByText('Intel Feed'))
    ).toBeVisible({ timeout: 20_000 });
  });
});
