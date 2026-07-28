/**
 * Feature gating / plan entitlement tests.
 *
 * WHAT: Tests canUse(), getFeaturesForPlan(), minimumPlanFor().
 * WHERE: src/lib/features.ts
 * WHY: Ensures paid features are properly gated by plan tier.
 */
import { describe, it, expect } from 'vitest';
import { canUse, getFeaturesForPlan, minimumPlanFor } from '@/lib/features';

describe('getFeaturesForPlan()', () => {
  it('core includes base features', () => {
    const features = getFeaturesForPlan('core');
    expect(features).toContain('relationships');
    expect(features).toContain('journey');
    expect(features).toContain('reflections');
    expect(features).toContain('provisio');
  });

  it('core does NOT include insight features', () => {
    const features = getFeaturesForPlan('core');
    expect(features).not.toContain('testimonium');
    expect(features).not.toContain('drift_detection');
  });

  it('insight includes core + insight features', () => {
    const features = getFeaturesForPlan('insight');
    expect(features).toContain('relationships'); // from core
    expect(features).toContain('testimonium'); // from insight
    expect(features).toContain('drift_detection');
  });

  it('story includes all tiers', () => {
    const features = getFeaturesForPlan('story');
    expect(features).toContain('relationships');
    expect(features).toContain('testimonium');
    expect(features).toContain('impulsus');
    expect(features).toContain('narrative_reporting');
  });

  it('unknown plan falls back to core', () => {
    const features = getFeaturesForPlan('enterprise');
    expect(features).toEqual(getFeaturesForPlan('core'));
  });
});

describe('canUse()', () => {
  it('grants core features on core plan', () => {
    expect(canUse('relationships', 'core')).toBe(true);
  });

  it('denies insight features on core plan', () => {
    expect(canUse('testimonium', 'core')).toBe(false);
  });

  it('flagOverride=true overrides plan restrictions', () => {
    expect(canUse('testimonium', 'core', true)).toBe(true);
  });

  it('flagOverride=false blocks even if plan includes it', () => {
    expect(canUse('testimonium', 'insight', false)).toBe(false);
  });

  it('null flagOverride falls through to plan check', () => {
    expect(canUse('testimonium', 'insight', null)).toBe(true);
    expect(canUse('testimonium', 'core', null)).toBe(false);
  });
});

describe('minimumPlanFor()', () => {
  it('relationships requires core', () => {
    expect(minimumPlanFor('relationships')).toBe('core');
  });

  it('testimonium requires insight', () => {
    expect(minimumPlanFor('testimonium')).toBe('insight');
  });

  it('impulsus requires story', () => {
    expect(minimumPlanFor('impulsus')).toBe('story');
  });

  it('unknown feature returns null', () => {
    expect(minimumPlanFor('nonexistent_feature')).toBeNull();
  });
});
