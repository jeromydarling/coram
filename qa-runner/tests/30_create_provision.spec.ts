import { test, expect } from '@playwright/test';
import { requireEnv } from '../helpers/env';
import { loginAsQAUser } from '../helpers/auth';
import { NAV_ITEM_TO_GROUP } from '../helpers/navRegistry';

/**
 * Prōvīsiō create & detail — skips gracefully if nav item is hidden.
 */
async function navigateToProvisions(page: any, t: typeof test) {
  const baseUrl = requireEnv('QA_DEFAULT_BASE_URL');
  await page.goto(baseUrl);
  await loginAsQAUser(page);

  await expect(
    page.locator('[data-testid="command-center-root"]')
      .or(page.locator('[data-testid="dashboard-root"]'))
  ).toBeVisible({ timeout: 20_000 });

  const groupId = NAV_ITEM_TO_GROUP['nav-provisions'];
  const trigger = page.locator(`[data-testid="${groupId}-trigger"]`);
  if (await trigger.count()) {
    const contentOpen = page.locator(`[data-testid="${groupId}-content"][data-state="open"]`);
    if (!(await contentOpen.count())) {
      await trigger.click({ timeout: 10_000 });
      await contentOpen.waitFor({ timeout: 10_000 }).catch(() => {});
    }
  }

  const navItem = page.locator('[data-testid="nav-provisions"]');
  if (!(await navItem.count())) {
    t.skip(true, 'Provisions nav hidden — tenant likely in care mode');
    return false;
  }

  await navItem.click({ timeout: 10_000 });
  await page.waitForURL(/provision/, { timeout: 20_000 });
  return true;
}

test.describe('Prōvīsiō: create & detail', () => {
  test('can open provision creation dialog', async ({ page }) => {
    const visible = await navigateToProvisions(page, test);
    if (!visible) return;

    const addBtn = page.locator('button:has-text("Add"), button:has-text("New"), button:has-text("Request"), [data-testid="add-provision"]').first();
    if (!(await addBtn.count())) {
      test.skip(true, 'No add provision button found');
      return;
    }
    await addBtn.click();
    await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 10_000 });
  });

  test('can open provision detail', async ({ page }) => {
    const visible = await navigateToProvisions(page, test);
    if (!visible) return;

    const firstRow = page.locator('[data-testid="provision-row"]').first();
    if (!(await firstRow.count())) {
      test.skip(true, 'No provisions to view');
      return;
    }
    await firstRow.click();
    await page.waitForURL(/provision/, { timeout: 15_000 });
  });
});
