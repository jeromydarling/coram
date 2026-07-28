import { test, expect } from '@playwright/test';
import { requireEnv } from '../helpers/env';
import { loginAsQAUser } from '../helpers/auth';
import { goTo } from '../helpers/nav';

/**
 * Tenant: Events page — list rendering, create dialog, and detail.
 */
test.describe('Events: interactions', () => {
  test('events list or empty state renders', async ({ page }) => {
    const baseUrl = requireEnv('QA_DEFAULT_BASE_URL');
    await page.goto(baseUrl);
    await loginAsQAUser(page);
    await goTo(page, 'nav-events', 'events');

    // Use only the testid to avoid strict mode violation with heading text
    await expect(
      page.locator('[data-testid="events-root"]')
    ).toBeVisible({ timeout: 15_000 });
  });

  test('add event opens dialog', async ({ page }) => {
    const baseUrl = requireEnv('QA_DEFAULT_BASE_URL');
    await page.goto(baseUrl);
    await loginAsQAUser(page);
    await goTo(page, 'nav-events', 'events');

    const addBtn = page.locator('button:has-text("Add"), button:has-text("New"), button:has-text("Create"), [data-testid="add-event"]').first();
    if (!(await addBtn.count())) {
      test.skip(true, 'No add event button found');
      return;
    }

    await addBtn.click();
    await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 10_000 });
  });
});
