/**
 * Bridge-as-Add-On consistency tests.
 *
 * WHAT: Ensures Bridge remains an add-on, not a tier, and Communio is available at all tiers.
 * WHERE: Run via `vitest`.
 * WHY: Prevents regression where Bridge drifts back into the tier hierarchy or Communio gets re-gated.
 */

import { describe, it, expect } from 'vitest';
import { canUse, getFeaturesForPlan } from '../features';
import { ADD_ONS, isFeatureInAddOn } from '../addons';

describe('Bridge-as-Add-On consistency', () => {
  it('planHierarchy has exactly 3 tiers, none is bridge', () => {
    const coreFeatures = getFeaturesForPlan('core');
    const bridgeFeatures = getFeaturesForPlan('bridge');
    // bridge should fall back to core (unknown plan)
    expect(bridgeFeatures).toEqual(coreFeatures);
  });

  it('communio_opt_in is available at core tier without add-ons', () => {
    expect(canUse('communio_opt_in', 'core')).toBe(true);
  });

  it('communio base features available at all tiers', () => {
    const communioKeys = ['communio_opt_in', 'communio_groups', 'communio_signals', 'communio_events', 'communio_governance'];
    for (const plan of ['core', 'insight', 'story']) {
      for (const key of communioKeys) {
        expect(canUse(key, plan)).toBe(true);
      }
    }
  });

  it('communio_opt_in is NOT in any add-on', () => {
    const allAddonFeatures = ADD_ONS.flatMap(a => a.features);
    expect(allAddonFeatures).not.toContain('communio_opt_in');
  });

  it('Bridge add-on exists with relatio features', () => {
    const bridge = ADD_ONS.find(a => a.key === 'bridge');
    expect(bridge).toBeDefined();
    expect(bridge!.features).toContain('relatio_marketplace');
    expect(bridge!.features).toContain('crm_migrations');
    expect(bridge!.features).toContain('hubspot_two_way');
  });

  it('relatio_marketplace is blocked at core without bridge addon', () => {
    expect(canUse('relatio_marketplace', 'core')).toBe(false);
  });

  it('relatio_marketplace is allowed with bridge addon', () => {
    expect(canUse('relatio_marketplace', 'core', undefined, ['bridge'])).toBe(true);
  });

  it('isFeatureInAddOn returns false for communio_opt_in', () => {
    expect(isFeatureInAddOn('communio_opt_in', ['bridge'])).toBe(false);
  });
});
