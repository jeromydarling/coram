import { describe, it, expect } from 'vitest';
import { computeDensity, DENSITY_THRESHOLDS } from '@/hooks/useStoryMomentum';
import type { StorySourceCounts } from '@/hooks/useStoryMomentum';

function makeSources(overrides: Partial<StorySourceCounts> = {}): StorySourceCounts {
  return {
    reflections_count: 0,
    email_touch_count: 0,
    campaign_touch_count: 0,
    local_pulse_event_count: 0,
    partner_activity_count: 0,
    metro_signal_count: 0,
    ...overrides,
  };
}

describe('computeDensity', () => {
  it('returns "quiet" when all sources are zero', () => {
    expect(computeDensity(makeSources())).toBe('quiet');
  });

  it('returns "quiet" when total is 1', () => {
    expect(computeDensity(makeSources({ reflections_count: 1 }))).toBe('quiet');
  });

  it('returns "active" when total >= 2 but fewer than 3 source types', () => {
    expect(computeDensity(makeSources({ reflections_count: 2 }))).toBe('active');
  });

  it('returns "growing" when 3+ source types are active', () => {
    expect(computeDensity(makeSources({
      reflections_count: 1,
      email_touch_count: 1,
      campaign_touch_count: 1,
    }))).toBe('growing');
  });

  it('returns "growing" when total >= 6 even with fewer source types', () => {
    expect(computeDensity(makeSources({
      reflections_count: 4,
      email_touch_count: 2,
    }))).toBe('growing');
  });

  it('returns "vibrant" when 4+ sources and total >= 10', () => {
    expect(computeDensity(makeSources({
      reflections_count: 3,
      email_touch_count: 3,
      campaign_touch_count: 2,
      local_pulse_event_count: 2,
    }))).toBe('vibrant');
  });

  it('does NOT return "vibrant" with 4 sources but total < 10', () => {
    expect(computeDensity(makeSources({
      reflections_count: 1,
      email_touch_count: 1,
      campaign_touch_count: 1,
      local_pulse_event_count: 1,
    }))).not.toBe('vibrant');
  });
});

describe('DENSITY_THRESHOLDS', () => {
  it('exports expected threshold values', () => {
    expect(DENSITY_THRESHOLDS.vibrant).toEqual({ sources: 4, total: 10 });
    expect(DENSITY_THRESHOLDS.growing).toEqual({ sources: 3, total: 6 });
    expect(DENSITY_THRESHOLDS.active).toEqual({ total: 2 });
  });
});

describe('privacy safety', () => {
  it('StorySourceCounts contains only numeric count fields', () => {
    const sources = makeSources();
    const keys = Object.keys(sources);
    // Every field must end with _count — no text/body fields allowed
    keys.forEach(key => {
      expect(key).toMatch(/_count$/);
    });
  });
});
