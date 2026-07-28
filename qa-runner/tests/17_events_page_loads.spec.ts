import { test, expect } from '@playwright/test';
import { requireEnv } from '../helpers/env';
import { loginAsQAUser } from '../helpers/auth';
import { goTo } from '../helpers/nav';

test.describe('Events: load & interact', () => {
  test('events page loads', async ({ page }) => {
    const baseUrl = requireEnv('QA_DEFAULT_BASE_URL');
    await page.goto(baseUrl);
    await loginAsQAUser(page);

    await goTo(page, 'nav-events', 'events');
    await expect(page.locator('[data-testid="events-root"]'))
      .toBeVisible({ timeout: 20_000 });
  });

  test('add event button is accessible', async ({ page }) => {
    const baseUrl = requireEnv('QA_DEFAULT_BASE_URL');
    await page.goto(baseUrl);
    await loginAsQAUser(page);

    await goTo(page, 'nav-events', 'events');
    await expect(page.locator('[data-testid="events-root"]'))
      .toBeVisible({ timeout: 20_000 });

    const addBtn = page.locator('[data-testid="add-event"]')
      .or(page.locator('button:has-text("Add")'))
      .or(page.locator('button:has-text("New")'))
      .or(page.locator('button:has-text("Create")'))
      .first();
    await expect(addBtn).toBeVisible({ timeout: 10_000 });
    await addBtn.click();

    // Dialog or form should appear
    await expect(
      page.locator('[role="dialog"]')
        .or(page.locator('[data-testid="event-form"]'))
    ).toBeVisible({ timeout: 10_000 });
  });
});
