/**
 * weekDate + tenantAge — Date utility tests.
 *
 * WHAT: Tests week date helpers and tenant lifecycle predicates.
 * WHERE: src/test/weekDate-tenantAge.test.ts
 * WHY: Date calculations affect weekly plans and Compass sensitivity calibration.
 */
import { describe, it, expect } from 'vitest';
import { getWeekStartDate, getWeekDisplayRange, getWeekMode } from '@/lib/weekDate';
import {
  getTenantAgeDays,
  isFirstMonth,
  isFirstTwoWeeks,
  getWeeklyReflectionPrompt,
  FOUNDATIONAL_REFLECTION_PROMPTS,
} from '@/lib/tenantAge';

// ── weekDate ──

describe('getWeekStartDate', () => {
  it('returns Monday of the given week', () => {
    // Wednesday 2025-06-11 → Monday 2025-06-09
    expect(getWeekStartDate(new Date('2025-06-11'))).toBe('2025-06-09');
  });

  it('returns same date if already Monday', () => {
    expect(getWeekStartDate(new Date('2025-06-09'))).toBe('2025-06-09');
  });
});

describe('getWeekDisplayRange', () => {
  it('returns formatted range from Monday to Sunday', () => {
    const display = getWeekDisplayRange('2025-06-09');
    expect(display).toBe('Jun 9 - Jun 15, 2025');
  });
});

describe('getWeekMode', () => {
  it('returns focus for Mon-Thu', () => {
    expect(getWeekMode(new Date('2025-06-09'))).toBe('focus'); // Mon
    expect(getWeekMode(new Date('2025-06-12'))).toBe('focus'); // Thu
  });

  it('returns review for Fri-Sun', () => {
    expect(getWeekMode(new Date('2025-06-13'))).toBe('review'); // Fri
    expect(getWeekMode(new Date('2025-06-14'))).toBe('review'); // Sat
    expect(getWeekMode(new Date('2025-06-15'))).toBe('review'); // Sun
  });
});

// ── tenantAge ──

describe('isFirstMonth', () => {
  it('returns true within 30 days', () => {
    const recent = new Date(Date.now() - 10 * 86_400_000).toISOString();
    expect(isFirstMonth(recent)).toBe(true);
  });

  it('returns false after 30 days', () => {
    const old = new Date(Date.now() - 60 * 86_400_000).toISOString();
    expect(isFirstMonth(old)).toBe(false);
  });
});

describe('isFirstTwoWeeks', () => {
  it('returns true within 14 days', () => {
    const recent = new Date(Date.now() - 5 * 86_400_000).toISOString();
    expect(isFirstTwoWeeks(recent)).toBe(true);
  });

  it('returns false after 14 days', () => {
    const old = new Date(Date.now() - 20 * 86_400_000).toISOString();
    expect(isFirstTwoWeeks(old)).toBe(false);
  });
});

describe('getWeeklyReflectionPrompt', () => {
  it('returns a prompt during first month', () => {
    const recent = new Date(Date.now() - 7 * 86_400_000).toISOString();
    const prompt = getWeeklyReflectionPrompt(recent);
    expect(prompt).not.toBeNull();
    expect(FOUNDATIONAL_REFLECTION_PROMPTS).toContain(prompt);
  });

  it('returns null after day 30', () => {
    const old = new Date(Date.now() - 60 * 86_400_000).toISOString();
    expect(getWeeklyReflectionPrompt(old)).toBeNull();
  });
});
