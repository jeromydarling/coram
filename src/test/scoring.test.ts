/**
 * Weekly plan scoring weight tests.
 *
 * WHAT: Tests scoring constants and thresholds.
 * WHERE: src/lib/weeklyPlanScoring.ts
 * WHY: Ensures scoring invariants are maintained.
 */
import { describe, it, expect } from 'vitest';
import {
  SCORING_WEIGHTS,
  MIN_SCORE_THRESHOLD,
  MAX_ITEMS,
  MAX_PER_CATEGORY,
} from '@/lib/weeklyPlanScoring';

describe('Scoring weights', () => {
  it('all positive weights are > 0', () => {
    // Check known positive weights
    expect(SCORING_WEIGHTS.OVERDUE_NEXT_ACTION).toBeGreaterThan(0);
    expect(SCORING_WEIGHTS.GRANT_DEADLINE_14_DAYS).toBeGreaterThan(0);
    expect(SCORING_WEIGHTS.ANCHOR_PROBABILITY_70_PLUS).toBeGreaterThan(0);
  });

  it('dampening weights are negative', () => {
    expect(SCORING_WEIGHTS.RECENT_ACTIVITY_3_DAYS).toBeLessThan(0);
    expect(SCORING_WEIGHTS.OPPORTUNITY_ON_HOLD).toBeLessThan(0);
    expect(SCORING_WEIGHTS.MARKED_DONE_THIS_WEEK).toBeLessThan(0);
  });

  it('MARKED_DONE_THIS_WEEK is the strongest dampener', () => {
    expect(SCORING_WEIGHTS.MARKED_DONE_THIS_WEEK).toBeLessThan(
      SCORING_WEIGHTS.OPPORTUNITY_ON_HOLD,
    );
  });

  it('OVERDUE_NEXT_ACTION is the highest priority signal', () => {
    const positiveValues = Object.values(SCORING_WEIGHTS).filter((v) => v > 0);
    expect(SCORING_WEIGHTS.OVERDUE_NEXT_ACTION).toBe(Math.max(...positiveValues));
  });
});

describe('Scoring thresholds', () => {
  it('MIN_SCORE_THRESHOLD is positive', () => {
    expect(MIN_SCORE_THRESHOLD).toBeGreaterThan(0);
  });

  it('MAX_ITEMS is reasonable (5-20)', () => {
    expect(MAX_ITEMS).toBeGreaterThanOrEqual(5);
    expect(MAX_ITEMS).toBeLessThanOrEqual(20);
  });

  it('MAX_PER_CATEGORY is less than MAX_ITEMS', () => {
    expect(MAX_PER_CATEGORY).toBeLessThan(MAX_ITEMS);
  });
});
