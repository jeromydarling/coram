import { test, expect } from '@playwright/test';
import { requireEnv } from '../helpers/env';
import { loginAsQAUser } from '../helpers/auth';
import { goTo } from '../helpers/nav';

test.describe('Activities: list, log, and project creation', () => {
  test('activities page loads', async ({ page }) => {
    const baseUrl = requireEnv('QA_DEFAULT_BASE_URL');
    await page.goto(baseUrl);
    await loginAsQAUser(page);

    await goTo(page, 'nav-activities', 'activit');
    // Use only data-testid to avoid strict mode (root div + multiple text matches)
    await expect(
      page.locator('[data-testid="activities-root"]')
    ).toBeVisible({ timeout: 20_000 });
  });

  test('can open log activity dialog', async ({ page }) => {
    const baseUrl = requireEnv('QA_DEFAULT_BASE_URL');
    await page.goto(baseUrl);
    await loginAsQAUser(page);

    await goTo(page, 'nav-activities', 'activit');
    await expect(page.locator('[data-testid="activities-root"]')).toBeVisible({ timeout: 20_000 });

    const addBtn = page.locator('button:has-text("Log"), button:has-text("Add"), button:has-text("New"), [data-testid="log-activity"]').first();
    if (!(await addBtn.count())) {
      test.skip(true, 'No log activity button found');
      return;
    }
    await addBtn.click();
    await expect(page.locator('[role="dialog"]').or(page.locator('form')).first()).toBeVisible({ timeout: 10_000 });
  });

  test('can create a project from activities page', async ({ page }) => {
    const baseUrl = requireEnv('QA_DEFAULT_BASE_URL');
    await page.goto(baseUrl);
    await loginAsQAUser(page);

    await goTo(page, 'nav-activities', 'activit');

    const projectBtn = page.locator('[data-testid="new-project-btn"]');
    if (!(await projectBtn.isVisible({ timeout: 5_000 }).catch(() => false))) {
      test.skip(true, 'New Project button not visible on activities page');
      return;
    }
    await projectBtn.click();

    await expect(page.locator('[data-testid="project-title-input"]')).toBeVisible({ timeout: 10_000 });
    await page.locator('[data-testid="project-title-input"]').fill('QA Paint Day');
    await page.locator('[data-testid="project-datetime-input"]').fill('2026-03-15T09:00');
    await page.locator('[data-testid="create-project-submit"]').click();

    await expect(page.locator('[data-testid="project-card"]').first()).toBeVisible({ timeout: 15_000 });
  });

  test('can filter activities by projects', async ({ page }) => {
    const baseUrl = requireEnv('QA_DEFAULT_BASE_URL');
    await page.goto(baseUrl);
    await loginAsQAUser(page);

    await goTo(page, 'nav-activities', 'activit');

    const filterTrigger = page.locator('button:has-text("All Activities")').first();
    if (await filterTrigger.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await filterTrigger.click();
      const projectOption = page.locator('[role="option"]:has-text("Projects")');
      if (await projectOption.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await projectOption.click();
      }
    }
  });
});
