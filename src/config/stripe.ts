// Stripe product + price mapping — single source of truth
// These IDs come from the Stripe dashboard / API
// LIVE account: CROS LLC (acct_1TAgVAIuo9wd3dMd)

export const stripeProducts = {
  core: {
    product_id: 'prod_U8z6jlvVhKv9qZ',
    price_id: 'price_1TAh8YIuo9wd3dMdDsWk0zXv',
    name: 'CROS Core',
  },
  insight: {
    product_id: 'prod_U8z6LGUkXDJpx2',
    price_id: 'price_1TAh8ZIuo9wd3dMdXAIoOK9R',
    name: 'CROS Insight',
  },
  story: {
    product_id: 'prod_U8z6GphHgzYNTO',
    price_id: 'price_1TAh8bIuo9wd3dMd4YKAeOoK',
    name: 'CROS Story',
  },
} as const;

export type StripeTierKey = keyof typeof stripeProducts;

/** Capacity add-on products */
export const stripeAddons = {
  bridge: {
    product_id: 'prod_U8z6Mc849SLYzz',
    price_id: 'price_1TAh8cIuo9wd3dMdLjH7qASI',
    name: 'CROS Bridge™',
    lookup_key: 'cros_addon_bridge',
  },
  additional_users: {
    product_id: 'prod_U8z6AcbAKtOtgW',
    price_id: 'price_1TAh8dIuo9wd3dMdIFYzeUI6',
    name: 'Additional Users',
    lookup_key: 'cros_addon_additional_users',
  },
  capacity_expansion_25: {
    product_id: 'prod_U8z6LscJnGCo2o',
    price_id: 'price_1TAh8fIuo9wd3dMd6jHf5xR4',
    name: '+25 Active Team Capacity',
    lookup_key: 'cros_addon_capacity_25',
  },
  capacity_expansion_75: {
    product_id: 'prod_U8z6Kxoi1huUdx',
    price_id: 'price_1TAh8gIuo9wd3dMdXqcnBkuz',
    name: '+75 Active Team Capacity',
    lookup_key: 'cros_addon_capacity_75',
  },
  capacity_expansion_200: {
    product_id: 'prod_U8z6mFGK3qHILi',
    price_id: 'price_1TAh8iIuo9wd3dMd6hCL1yrn',
    name: '+200 Active Team Capacity',
    lookup_key: 'cros_addon_capacity_200',
  },
  campaigns: {
    product_id: 'prod_U8z6shptP92O13',
    price_id: 'price_1TAh8jIuo9wd3dMdm1801HLv',
    name: 'Relatio Campaigns™',
    lookup_key: 'cros_addon_campaigns',
  },
  expansion_capacity: {
    product_id: 'prod_U8z6SZSAN3c5aH',
    price_id: 'price_1TAh8kIuo9wd3dMdJs8QxN9A',
    name: 'Expansion Capacity',
    lookup_key: 'cros_addon_expansion_capacity',
  },
} as const;

export type StripeAddonKey = keyof typeof stripeAddons;

/** Guided Activation™ one-time products */
export const stripeGuidedActivation = {
  guided_activation: {
    product_id: 'prod_U8z7bcl9YJ1ZVF',
    price_id: 'price_1TAh8mIuo9wd3dMdTPBCfjiw',
    name: 'Guided Activation™',
    sessions_total: 1,
  },
  guided_activation_plus: {
    product_id: 'prod_U8z7VJMpoSzHut',
    price_id: 'price_1TAh8oIuo9wd3dMdxaqqP4pi',
    name: 'Guided Activation Plus™',
    sessions_total: 2,
  },
} as const;

export type GuidedActivationKey = keyof typeof stripeGuidedActivation;

/** Founding Garden membership (recognition, $0/mo subscription add-on) */
export const stripeFoundingGarden = {
  product_id: 'prod_U8z7jevbYtgnnZ',
  price_id: 'price_1TAh8pIuo9wd3dMdQ8uq3jGf',
  name: 'Founding Garden Membership',
  program_key: 'founding_garden_2026_launch',
} as const;

/** Reverse lookup: price_id → addon key */
export const addonPriceToKey: Record<string, StripeAddonKey> = Object.fromEntries(
  Object.entries(stripeAddons).map(([k, v]) => [v.price_id, k as StripeAddonKey]),
) as Record<string, StripeAddonKey>;

/** Reverse lookup: price_id → base tier key */
export const basePriceToTier: Record<string, StripeTierKey> = Object.fromEntries(
  Object.entries(stripeProducts).map(([k, v]) => [v.price_id, k as StripeTierKey]),
) as Record<string, StripeTierKey>;
