import { test, expect } from '@playwright/test';
import { requireEnv } from '../helpers/env';
import { loginAsQAUser } from '../helpers/auth';
import { goTo } from '../helpers/nav';

test.describe('Opportunities: create new partner', () => {
  test('can open create dialog and fill required fields', async ({ page }) => {
    const baseUrl = requireEnv('QA_DEFAULT_BASE_URL');
    await page.goto(baseUrl);
    await loginAsQAUser(page);

    await goTo(page, 'nav-opportunities', 'opportunit');

    // Click "Add" / "New" / "Create" button
    const addBtn = page.locator('button:has-text("Add"), button:has-text("New"), button:has-text("Create"), [data-testid="add-opportunity"]').first();
    await expect(addBtn).toBeVisible({ timeout: 15_000 });
    await addBtn.click();

    // Wait for dialog / drawer
    await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 10_000 });

    // Fill organization name
    const orgInput = page.locator('input[name="organization"], input[placeholder*="Organization"], input[placeholder*="organization"], label:has-text("Organization") + input, label:has-text("Organization") ~ input').first();
    if (await orgInput.count()) {
      await orgInput.fill(`QA Test Org ${Date.now()}`);
    }

    // Look for submit / save button in the dialog
    const saveBtn = page.locator('[role="dialog"] button:has-text("Save"), [role="dialog"] button:has-text("Create"), [role="dialog"] button[type="submit"]').first();
    if (await saveBtn.count()) {
      // Don't actually submit to avoid polluting data — just verify the form is functional
      await expect(saveBtn).toBeEnabled();
    }
  });
});
