import { test, expect } from '@playwright/test';
import { requireEnv } from '../helpers/env';
import { loginAsQAUser } from '../helpers/auth';
import { goTo } from '../helpers/nav';

test.describe('Pipeline: board view & interact', () => {
  test('pipeline page loads with stage columns', async ({ page }) => {
    const baseUrl = requireEnv('QA_DEFAULT_BASE_URL');
    await page.goto(baseUrl);
    await loginAsQAUser(page);

    await goTo(page, 'nav-pipeline', 'pipeline');
    await expect(
      page.locator('[data-testid="pipeline-root"]')
    ).toBeVisible({ timeout: 20_000 });

    // Verify stage columns or tab structure exists
    const stageIndicator = page.locator('[data-testid*="stage"]')
      .or(page.getByText('Target Identified'))
      .or(page.getByText('Contacted'))
      .or(page.getByText('Discovery'))
      .first();
    await expect(stageIndicator).toBeVisible({ timeout: 10_000 });
  });

  test('pipeline card is clickable', async ({ page }) => {
    const baseUrl = requireEnv('QA_DEFAULT_BASE_URL');
    await page.goto(baseUrl);
    await loginAsQAUser(page);

    await goTo(page, 'nav-pipeline', 'pipeline');
    await expect(
      page.locator('[data-testid="pipeline-root"]')
    ).toBeVisible({ timeout: 20_000 });

    // Find a card in any stage column
    const card = page.locator('[data-testid*="pipeline-card"], [class*="card"], [draggable="true"]').first();
    if (!(await card.count())) {
      test.skip(true, 'No pipeline cards to interact with');
      return;
    }
    await card.click();
    await page.waitForTimeout(2000);

    // Should navigate to detail or open drawer
    const detail = page.locator('[role="dialog"]').or(page.locator('[data-testid*="detail"]')).or(page.locator('h1')).first();
    await expect(detail).toBeVisible({ timeout: 10_000 });
  });
});
