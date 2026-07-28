/**
 * Help content integrity tests.
 *
 * WHAT: Tests HELP_CONTENT for no empty strings.
 * WHERE: src/lib/helpContent.ts
 * WHY: Prevents blank tooltips and help panels in the UI.
 */
import { describe, it, expect } from 'vitest';
import { HELP_CONTENT } from '@/lib/helpContent';

describe('HELP_CONTENT registry', () => {
  it('has entries', () => {
    const keys = Object.keys(HELP_CONTENT);
    expect(keys.length).toBeGreaterThan(5);
  });

  it('no empty string values', () => {
    for (const [key, value] of Object.entries(HELP_CONTENT)) {
      expect(value, `HELP_CONTENT["${key}"] is empty`).toBeTruthy();
      expect(typeof value).toBe('string');
      expect((value as string).trim().length, `HELP_CONTENT["${key}"] is whitespace-only`).toBeGreaterThan(0);
    }
  });

  it('page-level keys follow naming convention', () => {
    const pageKeys = Object.keys(HELP_CONTENT).filter((k) => k.startsWith('page.'));
    expect(pageKeys.length).toBeGreaterThan(3);
    for (const key of pageKeys) {
      expect(key).toMatch(/^page\.[a-z\-]+$/);
    }
  });
});
