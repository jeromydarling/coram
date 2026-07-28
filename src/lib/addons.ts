/**
 * addons — À la carte add-on feature gating.
 *
 * WHAT: Defines purchasable add-ons that aren't tied to the cumulative plan hierarchy.
 * WHERE: Used alongside canUse() from features.ts for feature gating decisions.
 * WHY: Some orgs want Bridge integrations without Story exports, or campaigns without upgrading tier.
 */

export interface AddOn {
  key: string;
  label: string;
  description: string;
  /** Features unlocked by this add-on */
  features: string[];
  /** Monthly price in dollars (display only) */
  price: number;
}

export const ADD_ONS: AddOn[] = [
  {
    key: 'bridge',
    label: 'CROS Bridge™',
    description: 'Integration bridges, CRM migrations, and two-way sync with existing tools.',
    features: ['relatio_marketplace', 'crm_migrations', 'hubspot_two_way'],
    price: 49,
  },
  {
    key: 'campaigns',
    label: 'Relatio Campaigns™',
    description: 'Build and send relationship-first email campaigns.',
    features: ['outreach_campaigns'],
    price: 29,
  },
  {
    key: 'civitas',
    label: 'Civitas™',
    description: 'Full metro management with Local Pulse and narrative.',
    features: ['civitas_full', 'metro_management'],
    price: 39,
  },
  {
    key: 'expansion_capacity',
    label: 'Expansion Capacity',
    description: 'Additional metro beyond your plan allocation.',
    features: ['extra_metro'],
    price: 19,
  },
  {
    key: 'capacity_expansion_25',
    label: '+25 Active Team Capacity',
    description: 'Add 25 active team members beyond your plan allocation.',
    features: ['capacity_expansion'],
    price: 29,
  },
  {
    key: 'capacity_expansion_75',
    label: '+75 Active Team Capacity',
    description: 'Add 75 active team members beyond your plan allocation.',
    features: ['capacity_expansion'],
    price: 69,
  },
  {
    key: 'capacity_expansion_200',
    label: '+200 Active Team Capacity',
    description: 'Add 200 active team members beyond your plan allocation.',
    features: ['capacity_expansion'],
    price: 149,
  },
];

/**
 * Check if a feature is unlocked by any of the tenant's active add-ons.
 */
export function isFeatureInAddOn(featureKey: string, activeAddOnKeys: string[]): boolean {
  return ADD_ONS.some(
    addon => activeAddOnKeys.includes(addon.key) && addon.features.includes(featureKey),
  );
}

/**
 * Get the add-on that provides a feature, if any.
 */
export function getAddOnForFeature(featureKey: string): AddOn | null {
  return ADD_ONS.find(addon => addon.features.includes(featureKey)) ?? null;
}
