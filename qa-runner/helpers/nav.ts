import type { Page } from '@playwright/test';
import { NAV_ITEM_TO_GROUP } from './navRegistry';

/**
 * Expand a collapsible sidebar group safely.
 *
 * Contract from app:
 * - Trigger:   [data-testid="{groupId}-trigger"]
 * - Content:   [data-testid="{groupId}-content"][data-state="open"]
 *
 * Radix may unmount content when closed, so we must click trigger then wait for content to exist+open.
 */
export async function openNavGroup(page: Page, groupId: string) {
  if (!groupId) return;

  const trigger = page.locator(`[data-testid="${groupId}-trigger"]`);
  const contentOpen = page.locator(`[data-testid="${groupId}-content"][data-state="open"]`);

  // If content is already open, we're done.
  if (await contentOpen.count()) return;

  // Click trigger (retry-safe)
  await trigger.click({ timeout: 15_000 });

  // Wait for open state (content exists + open). Use generous timeout for animations.
  await contentOpen.waitFor({ timeout: 15_000 });
}

/**
 * Click a sidebar nav item reliably, expanding its parent group if necessary.
 */
export async function clickNav(page: Page, navTestId: string) {
  const groupId = NAV_ITEM_TO_GROUP[navTestId] || '';
  if (groupId) {
    await openNavGroup(page, groupId);
  }
  const item = page.locator(`[data-testid="${navTestId}"]`);
  await item.waitFor({ timeout: 15_000 });
  await item.click({ timeout: 15_000 });
}

/**
 * Convenience: from an authenticated page, navigate to a page via sidebar nav.
 * Waits for the page to settle after navigation to avoid screenshots of loading states.
 */
export async function goTo(page: Page, navTestId: string, expectedPathContains?: string) {
  await clickNav(page, navTestId);
  if (expectedPathContains) {
    await page.waitForURL(new RegExp(expectedPathContains.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), { timeout: 20_000 });
  }
  // Let the target page settle before any assertions or screenshots
  await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
  await page.waitForTimeout(800);
}
