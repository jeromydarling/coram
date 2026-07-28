// Feature gating — single source of truth for plan → feature mapping
// canUse(featureKey, tenantPlan, flagOverride?, activeAddOns?) → boolean

import { isFeatureInAddOn } from './addons';

type PlanKey = 'core' | 'insight' | 'story';

/** Active team capacity included per plan tier */
export const planActiveCapacity: Record<PlanKey, number> = {
  core: 10,
  insight: 25,
  story: 50,
};

// Features granted by each plan tier (cumulative)
const planFeatures: Record<PlanKey, string[]> = {
  core: [
    'relationships', 'journey', 'reflections',
    'signum_baseline', 'provisio', 'events',
    'voluntarium_basic', 'basic_narrative',
    'communio_opt_in', 'communio_groups',
    'communio_signals', 'communio_events',
    'communio_governance',
    'care_logging', 'season_summaries',
    'care_completion_ritual',
  ],
  insight: [
    'testimonium', 'drift_detection',
    'momentum_map_overlays', 'story_signals',
    'ingestion_confidence',
  ],
  story: [
    'impulsus', 'exec_exports', 'narrative_reporting',
  ],
};

// Plan hierarchy — each tier includes all lower tiers
const planHierarchy: PlanKey[] = ['core', 'insight', 'story'];

/**
 * Returns all features available for a given plan tier.
 */
export function getFeaturesForPlan(plan: string): string[] {
  const planIndex = planHierarchy.indexOf(plan as PlanKey);
  if (planIndex === -1) return planFeatures.core;

  const features: string[] = [];
  for (let i = 0; i <= planIndex; i++) {
    features.push(...planFeatures[planHierarchy[i]]);
  }
  return features;
}

/**
 * Check if a feature is available for a given plan + optional tenant flag override.
 *
 * @param featureKey - The feature to check
 * @param tenantPlan - The tenant's plan tier (core | insight | story)
 * @param flagOverride - Optional tenant-level flag override (from tenant_feature_flags)
 * @param activeAddOns - Optional list of purchased add-on keys
 * @returns boolean
 */
export function canUse(
  featureKey: string,
  tenantPlan: string,
  flagOverride?: boolean | null,
  activeAddOns?: string[],
): boolean {
  // If there's an explicit tenant-level override, it wins
  if (flagOverride === true) return true;
  if (flagOverride === false) return false;

  // Check plan grants
  const features = getFeaturesForPlan(tenantPlan);
  if (features.includes(featureKey)) return true;

  // Check à la carte add-ons
  if (activeAddOns?.length) {
    return isFeatureInAddOn(featureKey, activeAddOns);
  }

  return false;
}

/**
 * Returns the minimum plan required for a feature, or null if not found.
 */
export function minimumPlanFor(featureKey: string): PlanKey | null {
  for (const plan of planHierarchy) {
    if (planFeatures[plan].includes(featureKey)) {
      return plan;
    }
  }
  return null;
}
