import { test, expect } from '@playwright/test';
import { requireEnv } from '../helpers/env';
import { loginAsQAUser } from '../helpers/auth';
import { goTo } from '../helpers/nav';

test.describe('Projects via Activities: create, detail, notes', () => {
  test('can create a project from activities page and view detail', async ({ page }) => {
    const baseUrl = requireEnv('QA_DEFAULT_BASE_URL');
    await page.goto(baseUrl);
    await loginAsQAUser(page);

    // Navigate to Activities (projects now live here)
    await goTo(page, 'nav-activities', 'activit');

    // Click New Project
    const projectBtn = page.locator('[data-testid="new-project-btn"]');
    await expect(projectBtn).toBeVisible({ timeout: 15_000 });
    await projectBtn.click();

    await expect(page.locator('[data-testid="project-title-input"]')).toBeVisible({ timeout: 10_000 });
    await page.locator('[data-testid="project-title-input"]').fill('QA Food Drive');
    await page.locator('[data-testid="project-datetime-input"]').fill('2026-03-20T10:00');
    await page.locator('[data-testid="create-project-submit"]').click();

    // Project card should appear in activities
    const card = page.locator('[data-testid="project-card"]').first();
    await expect(card).toBeVisible({ timeout: 15_000 });

    // Click to open detail
    await card.click();
    await expect(page.locator('[data-testid="project-detail-root"]')).toBeVisible({ timeout: 15_000 });
  });

  test('can add a note on project detail', async ({ page }) => {
    const baseUrl = requireEnv('QA_DEFAULT_BASE_URL');
    await page.goto(baseUrl);
    await loginAsQAUser(page);

    await goTo(page, 'nav-activities', 'activit');

    const card = page.locator('[data-testid="project-card"]').first();
    if (!(await card.count())) {
      test.skip(true, 'No projects to open');
      return;
    }

    await card.click();
    await expect(page.locator('[data-testid="project-detail-root"]')).toBeVisible({ timeout: 15_000 });

    // Add a typed note
    await page.locator('[data-testid="add-note-btn"]').click();
    await expect(page.locator('[data-testid="project-note-textarea"]')).toBeVisible({ timeout: 10_000 });
    await page.locator('[data-testid="project-note-textarea"]').fill('QA test reflection — food drive went well');
    await page.locator('[data-testid="submit-project-note"]').click();

    // Note should appear in timeline
    await expect(page.locator('text=QA test reflection')).toBeVisible({ timeout: 15_000 });
  });
});
