/**
 * backendFeatureCheck — Server-side feature gating for edge functions.
 *
 * WHAT: Checks tenant entitlements server-side to match UI FeatureGate.
 * WHERE: Used by edge functions that need to enforce plan/add-on gates.
 * WHY: Prevents direct API access from bypassing UI-level feature gates.
 *
 * This mirrors src/lib/features.ts canUse() but runs server-side.
 */

type PlanKey = 'core' | 'insight' | 'story';

const planFeatures: Record<PlanKey, string[]> = {
  core: [
    'relationships', 'journey', 'reflections',
    'signum_baseline', 'provisio', 'events',
    'voluntarium_basic', 'basic_narrative',
    'communio_opt_in', 'communio_groups',
    'communio_signals', 'communio_events',
    'communio_governance',
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

const planHierarchy: PlanKey[] = ['core', 'insight', 'story'];

const addonFeatures: Record<string, string[]> = {
  bridge: ['relatio_marketplace', 'crm_migrations', 'hubspot_two_way'],
  campaigns: ['outreach_campaigns'],
  civitas: ['civitas_full', 'metro_management'],
  expanded_pulse: ['expanded_pulse'],
  guided_activation: ['guided_activation'],
};

function getFeaturesForPlan(plan: string): string[] {
  const planIndex = planHierarchy.indexOf(plan as PlanKey);
  if (planIndex === -1) return planFeatures.core;
  const features: string[] = [];
  for (let i = 0; i <= planIndex; i++) {
    features.push(...planFeatures[planHierarchy[i]]);
  }
  return features;
}

/**
 * Server-side canUse check — mirrors src/lib/features.ts
 */
export function canUseServer(
  featureKey: string,
  tenantPlan: string,
  activeAddOns?: string[],
): boolean {
  const features = getFeaturesForPlan(tenantPlan);
  if (features.includes(featureKey)) return true;

  if (activeAddOns?.length) {
    for (const addonKey of activeAddOns) {
      const af = addonFeatures[addonKey];
      if (af?.includes(featureKey)) return true;
    }
  }

  return false;
}

/**
 * Fetches tenant tier and add-ons from the database and checks a feature.
 * Requires a service-role Supabase client.
 */
export async function checkTenantFeature(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  tenantId: string,
  featureKey: string,
): Promise<{ allowed: boolean; plan: string; addOns: string[] }> {
  const { data: tenant } = await supabase
    .from('tenants')
    .select('tier')
    .eq('id', tenantId)
    .single();

  const plan = tenant?.tier ?? 'core';

  const { data: addOns } = await supabase
    .from('tenant_entitlements')
    .select('addon_key')
    .eq('tenant_id', tenantId)
    .eq('active', true);

  const activeAddOns = (addOns || []).map((a: { addon_key: string }) => a.addon_key);
  const allowed = canUseServer(featureKey, plan, activeAddOns);

  return { allowed, plan, addOns: activeAddOns };
}
