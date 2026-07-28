/**
 * computations — Pure logic tests for metro readiness, anchor scoring, cycle times.
 *
 * WHAT: Tests all exported computation functions.
 * WHERE: src/test/computations.test.ts
 * WHY: These calculations drive dashboards and pipeline views — correctness is critical.
 */
import { describe, it, expect } from 'vitest';
import {
  countActiveAnchors,
  countAnchorsFormedInPeriod,
  calculateAnchorScore,
  calculateDemandScore,
  calculateOpsScore,
  getMetroStatus,
  computeMetroReadiness,
  calculateDaysInStage,
  calculateAverageVolume,
  calculateMedianCycleTime,
  computeProductionStatus,
  calculateCycleTime,
} from '@/lib/computations';

// ── countActiveAnchors ──

describe('countActiveAnchors', () => {
  it('counts only anchors with non-null first_volume_date', () => {
    const anchors = [
      { first_volume_date: '2025-01-01' },
      { first_volume_date: null },
      { first_volume_date: '2025-06-15' },
      { first_volume_date: undefined },
      { first_volume_date: '' },
    ];
    expect(countActiveAnchors(anchors)).toBe(2);
  });

  it('returns 0 for empty array', () => {
    expect(countActiveAnchors([])).toBe(0);
  });
});

// ── countAnchorsFormedInPeriod ──

describe('countAnchorsFormedInPeriod', () => {
  it('counts anchors within the period', () => {
    const ref = new Date('2025-06-15');
    const anchors = [
      { first_volume_date: '2025-06-10' }, // 5 days ago — in 30-day window
      { first_volume_date: '2025-01-01' }, // too old
      { first_volume_date: null },
      { first_volume_date: '2025-06-01' }, // 14 days ago — in 30-day window
    ];
    expect(countAnchorsFormedInPeriod(anchors, 30, ref)).toBe(2);
  });

  it('excludes future dates', () => {
    const ref = new Date('2025-06-15');
    const anchors = [{ first_volume_date: '2025-07-01' }];
    expect(countAnchorsFormedInPeriod(anchors, 30, ref)).toBe(0);
  });
});

// ── calculateAnchorScore ──

describe('calculateAnchorScore', () => {
  it('returns 0 for 0 anchors', () => expect(calculateAnchorScore(0)).toBe(0));
  it('returns 20 for 1 anchor', () => expect(calculateAnchorScore(1)).toBe(20));
  it('returns 40 for 2+ anchors', () => {
    expect(calculateAnchorScore(2)).toBe(40);
    expect(calculateAnchorScore(5)).toBe(40);
  });
});

// ── calculateDemandScore ──

describe('calculateDemandScore', () => {
  it('computes referrals*5 + inquiries*3, capped at 30', () => {
    expect(calculateDemandScore(2, 3)).toBe(19); // 10 + 9
    expect(calculateDemandScore(10, 10)).toBe(30); // capped
  });

  it('returns 0 for no activity', () => {
    expect(calculateDemandScore(0, 0)).toBe(0);
  });
});

// ── calculateOpsScore ──

describe('calculateOpsScore', () => {
  it('sums boolean + staff capped at 10', () => {
    expect(calculateOpsScore(true, true, 5)).toBe(30); // 10+10+10
    expect(calculateOpsScore(false, false, 0)).toBe(0);
    expect(calculateOpsScore(true, false, 3)).toBe(16); // 10+0+6
  });
});

// ── getMetroStatus ──

describe('getMetroStatus', () => {
  it('returns Expansion Ready for >= 75', () => expect(getMetroStatus(75)).toBe('Expansion Ready'));
  it('returns Anchor Build for >= 50', () => expect(getMetroStatus(50)).toBe('Anchor Build'));
  it('returns Ecosystem Dev for < 50', () => expect(getMetroStatus(30)).toBe('Ecosystem Dev'));
});

// ── computeMetroReadiness ──

describe('computeMetroReadiness', () => {
  it('aggregates across anchors and pipeline for a metro', () => {
    const metro = {
      id: 'm1', metro_id: 'm1', metro: 'Test Metro',
      referrals_per_month: 3, partner_inquiries_per_month: 2,
      distribution_partner_yn: true, storage_ready_yn: true, staff_coverage_1to5: 4,
    };
    const anchors = [
      { metro_id: 'm1', first_volume_date: '2025-01-01' },
      { metro_id: 'm1', first_volume_date: null },
      { metro_id: 'm2', first_volume_date: '2025-01-01' },
    ];
    const pipeline = [
      { metro_id: 'm1', stage: 'contacted' },
      { metro_id: 'm1', stage: 'proposal' },
      { metro_id: 'm2', stage: 'contacted' },
    ];
    const result = computeMetroReadiness(metro, anchors, pipeline);
    expect(result.activeAnchors).toBe(1);
    expect(result.anchorsInPipeline).toBe(2);
    expect(result.anchorScore).toBe(20);
    expect(result.demandScore).toBe(21); // 3*5 + 2*3
    expect(result.opsScore).toBe(28); // 10+10+min(10,8)
    expect(result.metroReadinessIndex).toBe(69);
    expect(result.metroStatus).toBe('Anchor Build');
  });
});

// ── calculateDaysInStage ──

describe('calculateDaysInStage', () => {
  it('returns days since stage entry', () => {
    const ref = new Date('2025-06-15');
    expect(calculateDaysInStage('2025-06-10', ref)).toBe(5);
  });

  it('returns 0 for null/invalid', () => {
    expect(calculateDaysInStage(null)).toBe(0);
    expect(calculateDaysInStage('not-a-date')).toBe(0);
  });

  it('returns 0 for future dates', () => {
    const ref = new Date('2025-06-15');
    expect(calculateDaysInStage('2025-07-01', ref)).toBe(0);
  });
});

// ── calculateAverageVolume ──

describe('calculateAverageVolume', () => {
  it('excludes null/zero volumes', () => {
    const anchors = [
      { avg_monthly_volume: 100 },
      { avg_monthly_volume: null },
      { avg_monthly_volume: 0 },
      { avg_monthly_volume: 200 },
    ];
    expect(calculateAverageVolume(anchors)).toBe(150);
  });

  it('returns 0 for empty/all-null', () => {
    expect(calculateAverageVolume([])).toBe(0);
    expect(calculateAverageVolume([{ avg_monthly_volume: null }])).toBe(0);
  });
});

// ── calculateMedianCycleTime ──

describe('calculateMedianCycleTime', () => {
  it('computes median for contact_to_agreement', () => {
    const anchors = [
      { first_contact_date: '2025-01-01', agreement_signed_date: '2025-01-11' }, // 10
      { first_contact_date: '2025-01-01', agreement_signed_date: '2025-01-21' }, // 20
      { first_contact_date: '2025-01-01', agreement_signed_date: '2025-02-01' }, // 31
    ];
    expect(calculateMedianCycleTime(anchors, 'contact_to_agreement')).toBe(20);
  });

  it('returns 0 when no valid pairs', () => {
    expect(calculateMedianCycleTime([{ first_contact_date: null }], 'contact_to_agreement')).toBe(0);
  });
});

// ── computeProductionStatus ──

describe('computeProductionStatus', () => {
  it('returns Pre-Production without first_volume_date', () => {
    expect(computeProductionStatus({ anchor_id: 'a1' })).toBe('Pre-Production');
  });

  it('returns Ramp within 3 months', () => {
    const ref = new Date('2025-06-15');
    expect(computeProductionStatus({ first_volume_date: '2025-05-01' }, ref)).toBe('Ramp');
  });

  it('returns Scale for high volume after 3 months', () => {
    const ref = new Date('2025-06-15');
    expect(computeProductionStatus(
      { first_volume_date: '2025-01-01', avg_monthly_volume: 150 }, ref
    )).toBe('Scale');
  });

  it('returns Stable for moderate volume after 3 months', () => {
    const ref = new Date('2025-06-15');
    expect(computeProductionStatus(
      { first_volume_date: '2025-01-01', avg_monthly_volume: 50 }, ref
    )).toBe('Stable');
  });
});

// ── calculateCycleTime ──

describe('calculateCycleTime', () => {
  it('returns days between two dates', () => {
    expect(calculateCycleTime('2025-01-01', '2025-01-11')).toBe(10);
  });

  it('returns null for missing dates', () => {
    expect(calculateCycleTime(null, '2025-01-11')).toBeNull();
    expect(calculateCycleTime('2025-01-01', null)).toBeNull();
  });

  it('returns null for negative cycle', () => {
    expect(calculateCycleTime('2025-02-01', '2025-01-01')).toBeNull();
  });
});
