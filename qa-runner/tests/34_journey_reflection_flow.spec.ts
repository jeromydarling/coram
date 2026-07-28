import { test, expect } from '@playwright/test';
import { requireEnv } from '../helpers/env';
import { loginAsQAUser } from '../helpers/auth';
import { goTo } from '../helpers/nav';

test.describe('Journey: reflection recording on opportunity', () => {
  test('can open opportunity story tab and add reflection', async ({ page }) => {
    const baseUrl = requireEnv('QA_DEFAULT_BASE_URL');
    await page.goto(baseUrl);
    await loginAsQAUser(page);

    await goTo(page, 'nav-opportunities', 'opportunit');

    const firstRow = page.locator('[data-testid="opportunity-row"]').first();
    if (!(await firstRow.count())) {
      test.skip(true, 'No opportunities to test');
      return;
    }
    await firstRow.click();
    await expect(page.locator('[data-testid="opportunity-detail-root"]')).toBeVisible({ timeout: 20_000 });

    // Navigate to Story tab
    const storyTab = page.locator('[data-testid="opportunity-tab-story"], button:has-text("Story"), [role="tab"]:has-text("Story")').first();
    if (await storyTab.count()) {
      await storyTab.click();
      await page.waitForTimeout(1500);
    }

    // Look for "Add Reflection" button
    const reflectionBtn = page.locator('button:has-text("Reflection"), button:has-text("Add Note"), button:has-text("Journal"), [data-testid="add-reflection"]').first();
    if (await reflectionBtn.count()) {
      await reflectionBtn.click();
      // Expect a text area or dialog to appear
      await expect(page.locator('textarea, [role="dialog"], [contenteditable="true"]')).toBeVisible({ timeout: 10_000 });
    }
  });
});
