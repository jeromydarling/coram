/**
 * Volunteer config integrity tests.
 *
 * WHAT: Tests reliability thresholds and import constants.
 * WHERE: src/lib/volunteerConfig.ts
 * WHY: Prevents misconfigured volunteer reliability labels.
 */
import { describe, it, expect } from 'vitest';
import {
  RELIABILITY_THRESHOLDS,
  RELIABILITY_DEFAULT,
  RELIABILITY_NEW,
  IMPORT_PREVIEW_MAX_ROWS,
  IMPORT_CSV_MAX_ROWS,
} from '@/lib/volunteerConfig';

describe('Reliability thresholds', () => {
  it('are sorted by ascending maxDays', () => {
    for (let i = 1; i < RELIABILITY_THRESHOLDS.length; i++) {
      expect(RELIABILITY_THRESHOLDS[i].maxDays).toBeGreaterThan(
        RELIABILITY_THRESHOLDS[i - 1].maxDays,
      );
    }
  });

  it('all have non-empty labels', () => {
    for (const t of RELIABILITY_THRESHOLDS) {
      expect(t.label.length).toBeGreaterThan(0);
      expect(t.className.length).toBeGreaterThan(0);
    }
  });

  it('default and new have labels', () => {
    expect(RELIABILITY_DEFAULT.label).toBeTruthy();
    expect(RELIABILITY_NEW.label).toBeTruthy();
  });
});

describe('Import constants', () => {
  it('preview max < csv max', () => {
    expect(IMPORT_PREVIEW_MAX_ROWS).toBeLessThan(IMPORT_CSV_MAX_ROWS);
  });

  it('csv max is reasonable', () => {
    expect(IMPORT_CSV_MAX_ROWS).toBeGreaterThanOrEqual(1000);
    expect(IMPORT_CSV_MAX_ROWS).toBeLessThanOrEqual(100_000);
  });
});
