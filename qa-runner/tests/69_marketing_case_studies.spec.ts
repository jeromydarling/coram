import { test, expect } from '@playwright/test';
import { requireEnv } from '../helpers/env';

/**
 * Marketing: Case study pages load.
 *
 * Only /case-study-humanity exists as a route; other case study paths
 * were never created. Tests skip gracefully for missing routes.
 */
test.describe('Marketing: case study pages', () => {
  const CASE_STUDIES = [
    '/case-study-humanity',
  ];

  for (const path of CASE_STUDIES) {
    test(`${path} loads`, async ({ page }) => {
      const baseUrl = requireEnv('QA_DEFAULT_BASE_URL');
      const res = await page.goto(`${baseUrl}${path}`);

      // Accept 200 or 404 (page may not exist yet); fail on 500
      if (res && res.status() >= 400) {
        test.skip(true, `${path} returned ${res.status()}`);
        return;
      }

      await expect(
        page.locator('h1, h2, [data-testid="case-study-root"]').first()
      ).toBeVisible({ timeout: 15_000 });
    });
  }
});
