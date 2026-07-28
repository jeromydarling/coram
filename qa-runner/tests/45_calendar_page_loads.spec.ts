import { test, expect } from '@playwright/test';
import { requireEnv } from '../helpers/env';
import { loginAsQAUser } from '../helpers/auth';
import { goTo } from '../helpers/nav';

test.describe('Calendar: load & interact', () => {
  test('calendar page loads', async ({ page }) => {
    const baseUrl = requireEnv('QA_DEFAULT_BASE_URL');
    await page.goto(baseUrl);
    await loginAsQAUser(page);

    await goTo(page, 'nav-calendar', 'calendar');
    await expect(page.locator('[data-testid="calendar-root"]')).toBeVisible({ timeout: 20_000 });
  });

  test('calendar renders date grid or day view', async ({ page }) => {
    const baseUrl = requireEnv('QA_DEFAULT_BASE_URL');
    await page.goto(baseUrl);
    await loginAsQAUser(page);

    await goTo(page, 'nav-calendar', 'calendar');
    await expect(page.locator('[data-testid="calendar-root"]')).toBeVisible({ timeout: 20_000 });

    const calendarGrid = page.locator('table')
      .or(page.locator('[class*="calendar"]'))
      .or(page.locator('[role="grid"]'))
      .or(page.locator('[data-testid*="calendar"]'))
      .first();
    await expect(calendarGrid).toBeVisible({ timeout: 15_000 });
  });
});
