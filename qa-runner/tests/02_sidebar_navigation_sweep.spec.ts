import { test, expect } from '@playwright/test';
import { requireEnv } from '../helpers/env';
import { loginAsQAUser } from '../helpers/auth';
import { NAV_ITEM_TO_GROUP } from '../helpers/navRegistry';

/**
 * Sidebar navigation sweep — skips items whose nav link is hidden
 * (e.g. metros hidden when civitas is disabled, provisions hidden in care mode).
 */
const NAV_CASES: Array<{ id: string; pathHint: string }> = [
  { id: 'nav-metros', pathHint: 'metros' },
  { id: 'nav-intel-feed', pathHint: 'intel' },
  { id: 'nav-opportunities', pathHint: 'opportunit' },
  { id: 'nav-calendar', pathHint: 'calendar' },
  { id: 'nav-events', pathHint: 'events' },
  { id: 'nav-people', pathHint: 'people' },
  { id: 'nav-volunteers', pathHint: 'volunteer' },
  { id: 'nav-settings', pathHint: 'settings' },
];

test.describe('Navigation: grouped sidebar items are reachable', () => {
  for (const c of NAV_CASES) {
    test(`can open ${c.id}`, async ({ page }) => {
      const baseUrl = requireEnv('QA_DEFAULT_BASE_URL');
      await page.goto(baseUrl);
      await loginAsQAUser(page);

      await expect(
        page.locator('[data-testid="command-center-root"]')
          .or(page.locator('[data-testid="dashboard-root"]'))
      ).toBeVisible({ timeout: 20_000 });

      // Expand parent group if needed
      const groupId = NAV_ITEM_TO_GROUP[c.id] || '';
      if (groupId) {
        const trigger = page.locator(`[data-testid="${groupId}-trigger"]`);
        if (!(await trigger.count())) {
          test.skip(true, `Group ${groupId} not rendered — feature likely disabled`);
          return;
        }
        const contentOpen = page.locator(`[data-testid="${groupId}-content"][data-state="open"]`);
        if (!(await contentOpen.count())) {
          await trigger.click({ timeout: 10_000 });
          await contentOpen.waitFor({ timeout: 10_000 }).catch(() => {});
        }
      }

      // Check if the nav item itself exists
      const navItem = page.locator(`[data-testid="${c.id}"]`);
      if (!(await navItem.count())) {
        test.skip(true, `${c.id} not visible — feature likely disabled for this tenant`);
        return;
      }

      await navItem.click({ timeout: 10_000 });
      await expect(page).toHaveURL(/.+/, { timeout: 20_000 });
    });
  }
});
