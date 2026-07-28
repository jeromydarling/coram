import { test, expect } from '@playwright/test';
import { isEnabled } from '../helpers/features';
import { requireEnv } from '../helpers/env';
import { loginAsQAUser } from '../helpers/auth';
import { goTo } from '../helpers/nav';

/**
 * Visitor role: designed for in-field/elderly users.
 * - Can navigate to a partner/opportunity
 * - Can record a voice note (or upload audio)
 * - Audio is transcribed to text and stored as a reflection/activity so NRI can use it
 *
 * This is a future-facing spec. Enable once UI + transcription pipeline is shipped.
 */
test.describe('Visitor role: voice notes → transcription (spec)', () => {
  test('can add a voice note and see transcription (optional)', async ({ page }) => {
    test.skip(!isEnabled('QA_ENABLE_VISITOR_VOICE_NOTES'), 'Enable when visitor voice note feature is implemented.');

    const baseUrl = requireEnv('QA_DEFAULT_BASE_URL');
    await page.goto(baseUrl);
    await loginAsQAUser(page);

    // Go to an opportunity
    await goTo(page, 'nav-opportunities', 'opportunit');

    // Open first opportunity
    const firstRow = page.locator('[data-testid="opportunity-row"]').first();
    await firstRow.click();

    // Voice note button should exist
    const voiceBtn = page.locator('[data-testid="voice-note-start"], button:has-text("Voice note")').first();
    await expect(voiceBtn).toBeVisible({ timeout: 20_000 });

    // If using upload input instead of mic permissions
    const upload = page.locator('input[type="file"][data-testid="voice-note-upload"]');
    if (await upload.count()) {
      // Provide a small wav/mp3 fixture in repo, e.g. tests/fixtures/sample-voice-note.mp3
      await upload.setInputFiles('tests/fixtures/sample-voice-note.mp3');
    } else {
      await voiceBtn.click();
      const stop = page.locator('[data-testid="voice-note-stop"], button:has-text("Stop")').first();
      await stop.click();
    }

    // Wait for transcription to appear
    await expect(page.locator('[data-testid="voice-note-transcript"], text=Transcript')).toBeVisible({ timeout: 60_000 });
  });
});
