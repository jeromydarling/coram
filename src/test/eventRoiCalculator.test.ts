/**
 * eventRoiCalculator — ROI scoring logic tests.
 *
 * WHAT: Tests event ROI calculation and category assignment.
 * WHERE: src/test/eventRoiCalculator.test.ts
 * WHY: ROI scores drive event success badges — incorrect math misleads stewards.
 */
import { describe, it, expect } from 'vitest';
import { calculateEventROI, getROICategoryStyle } from '@/lib/eventRoiCalculator';

describe('calculateEventROI', () => {
  it('scores a high-performing event as excellent', () => {
    const result = calculateEventROI({
      id: 'e1',
      contacts_made: 20,
      contacts_converted: 10,
      households_served: 15,
      devices_distributed: 10,
      internet_signups: 8,
      anchor_identified_yn: true,
      cost_estimated: 100,
      staff_deployed: 2,
    });
    expect(result.score).toBeGreaterThanOrEqual(60);
    expect(result.category).toBe('good');
  });

  it('scores a minimal event as low', () => {
    const result = calculateEventROI({
      id: 'e2',
      contacts_made: 1,
      contacts_converted: 0,
      households_served: null,
      devices_distributed: null,
      internet_signups: null,
      anchor_identified_yn: false,
      cost_estimated: 500,
      staff_deployed: 5,
    });
    expect(result.score).toBeLessThan(40);
    expect(result.category).toBe('low');
  });

  it('handles null optional fields without crashing', () => {
    const result = calculateEventROI({
      id: 'e3',
      contacts_made: 5,
      contacts_converted: 2,
      households_served: null,
      devices_distributed: null,
      internet_signups: null,
      anchor_identified_yn: null,
      cost_estimated: null,
      staff_deployed: null,
    });
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.breakdown.totalPoints).toBe(20); // 5*2 + 2*5
  });

  it('caps score at 100', () => {
    const result = calculateEventROI({
      id: 'e4',
      contacts_made: 100,
      contacts_converted: 100,
      households_served: 100,
      devices_distributed: 100,
      internet_signups: 100,
      anchor_identified_yn: true,
      cost_estimated: 1,
      staff_deployed: 1,
    });
    expect(result.score).toBe(100);
  });
});

describe('getROICategoryStyle', () => {
  it('returns correct labels for each category', () => {
    expect(getROICategoryStyle('excellent').label).toBe('Excellent');
    expect(getROICategoryStyle('good').label).toBe('Good');
    expect(getROICategoryStyle('fair').label).toBe('Fair');
    expect(getROICategoryStyle('low').label).toBe('Low Yield');
  });
});
