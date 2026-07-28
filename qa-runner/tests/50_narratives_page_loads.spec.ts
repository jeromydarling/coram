import { test, expect } from '@playwright/test';
import { requireEnv } from '../helpers/env';
import { loginAsQAUser } from '../helpers/auth';
import { goTo } from '../helpers/nav';

test.describe('Narratives: load & interact', () => {
  test('narratives page loads', async ({ page }) => {
    const baseUrl = requireEnv('QA_DEFAULT_BASE_URL');
    await page.goto(baseUrl);
    await loginAsQAUser(page);

    const trigger = page.locator('[data-testid="nav-group-metros-trigger"]');
    if (!(await trigger.isVisible({ timeout: 5_000 }).catch(() => false))) {
      test.skip(true, 'Metros nav group not visible — Civitas may be disabled for this tenant.');
      return;
    }

    await goTo(page, 'nav-narratives', 'narrative');

    // Accept either the narratives page or the metro intelligence gate (disabled)
    const narrativesRoot = page.locator('[data-testid="narratives-root"]');
    const gateBlock = page.locator('[data-testid="metro-intelligence-gate"]');
    const target = narrativesRoot.or(gateBlock).first();
    await expect(target).toBeVisible({ timeout: 20_000 });

    if (await gateBlock.isVisible().catch(() => false)) {
      test.skip(true, 'Metro Intelligence not enabled for this tenant — gate shown instead of narratives.');
      return;
    }
  });

  test('narrative content or empty state renders', async ({ page }) => {
    const baseUrl = requireEnv('QA_DEFAULT_BASE_URL');
    await page.goto(baseUrl);
    await loginAsQAUser(page);

    const trigger = page.locator('[data-testid="nav-group-metros-trigger"]');
    if (!(await trigger.isVisible({ timeout: 5_000 }).catch(() => false))) {
      test.skip(true, 'Metros nav group not visible — Civitas may be disabled for this tenant.');
      return;
    }

    await goTo(page, 'nav-narratives', 'narrative');

    const narrativesRoot = page.locator('[data-testid="narratives-root"]');
    const gateBlock = page.locator('[data-testid="metro-intelligence-gate"]');
    const target = narrativesRoot.or(gateBlock).first();
    await expect(target).toBeVisible({ timeout: 20_000 });

    if (await gateBlock.isVisible().catch(() => false)) {
      test.skip(true, 'Metro Intelligence not enabled — skipping content check.');
      return;
    }

    const content = page.locator('[class*="card"], [data-testid*="narrative"], [data-testid*="story"], article').or(page.getByText(/no narratives|no stories/i)).first();
    await expect(content).toBeVisible({ timeout: 15_000 });
  });
});
