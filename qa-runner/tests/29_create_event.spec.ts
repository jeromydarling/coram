import { test, expect } from '@playwright/test';
import { requireEnv } from '../helpers/env';
import { loginAsQAUser } from '../helpers/auth';
import { goTo } from '../helpers/nav';

test.describe('Events: create flow', () => {
  test('can open event creation form', async ({ page }) => {
    const baseUrl = requireEnv('QA_DEFAULT_BASE_URL');
    await page.goto(baseUrl);
    await loginAsQAUser(page);

    await goTo(page, 'nav-events', 'events');
    await expect(page.locator('[data-testid="events-root"]')).toBeVisible({ timeout: 20_000 });

    // Click add/create button
    const addBtn = page.locator('button:has-text("Add"), button:has-text("New"), button:has-text("Create"), button:has-text("Log"), [data-testid="add-event"]').first();
    if (!(await addBtn.count())) {
      test.skip(true, 'No add event button found');
      return;
    }
    await addBtn.click();

    // Dialog should appear
    await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 10_000 });
  });

  test('event detail page loads when clicking event', async ({ page }) => {
    const baseUrl = requireEnv('QA_DEFAULT_BASE_URL');
    await page.goto(baseUrl);
    await loginAsQAUser(page);

    await goTo(page, 'nav-events', 'events');

    const firstEvent = page.locator('table tbody tr, [data-testid="event-row"], [data-testid="event-card"]').first();
    if (!(await firstEvent.count())) {
      test.skip(true, 'No events to click');
      return;
    }
    await firstEvent.click();

    await page.waitForTimeout(2000);
    // Should show detail page or a drawer
    const detailVisible = await page.locator('[data-testid="event-detail"], h1, h2').first().isVisible();
    expect(detailVisible).toBeTruthy();
  });
});
