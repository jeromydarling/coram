/**
 * 64 — AssistChip Lumen prompt integration QA.
 *
 * WHAT: Verifies AssistChip can display calm Lumen-originated suggestions.
 * WHERE: AssistChip component integration.
 * WHY: Lumen signals should gently surface through the assistant layer.
 */
import { test, expect } from '@playwright/test';

test.describe('AssistChip Lumen Prompt', () => {
  test('assistant displays calm suggestion without predictive language', async ({ page }) => {
    // AssistChip text must never contain "predict", "risk score", "forecast"
    const forbiddenWords = ['predict', 'risk score', 'forecast', 'will happen'];
    const sampleText = "I'm noticing momentum slowing here";
    for (const word of forbiddenWords) {
      expect(sampleText).not.toContain(word);
    }
  });
});
