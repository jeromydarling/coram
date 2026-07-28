// Pricing configuration — update values here, not in JSX

/** Numeric monthly prices (source of truth — display strings derived below) */
export const MONTHLY_PRICES: Record<string, number> = {
  core: 49,
  insight: 39,
  story: 29,
};

/** Numeric monthly prices for add-ons */
export const ADDON_MONTHLY_PRICES: Record<string, number> = {
  bridge: 49,
  capacity_expansion_25: 29,
  capacity_expansion_75: 69,
  expanded_local_pulse: 25,
  campaigns: 29,
  expansion_capacity: 19,
};

/**
 * Annual price = whichever is cheaper: 10% off 12 months OR 10 months (2 free).
 * For all current prices, 10 months is always the higher discount.
 */
export function annualPrice(monthly: number): number {
  const tenPercent = Math.round(monthly * 12 * 0.9);
  const twoMonthsFree = monthly * 10;
  return Math.min(tenPercent, twoMonthsFree);
}

export type PricingTier = {
  monthly: string;
  annual: string;
  monthlyNum: number;
  annualNum: number;
  isAddOn?: boolean;
  addOnLabel?: string;
};

export const pricing: Record<string, PricingTier> = {
  core:    { monthlyNum: 49, annualNum: annualPrice(49), monthly: '$49/mo', annual: `$${annualPrice(49)}/yr`, },
  insight: { monthlyNum: 39, annualNum: annualPrice(39), monthly: '+$39/mo', annual: `+$${annualPrice(39)}/yr`, isAddOn: true, addOnLabel: 'Add to Core' },
  story:   { monthlyNum: 29, annualNum: annualPrice(29), monthly: '+$29/mo', annual: `+$${annualPrice(29)}/yr`, isAddOn: true, addOnLabel: 'Add to Core + Insight' },
};

export type AddOn = {
  key: string;
  name: string;
  headline: string;
  description: string;
  bullets: string[];
  price: string;
  priceSuffix?: string;
  quantityMode: 'toggle' | 'stepper';
  maxQty?: number;
  learnMoreUrl?: string;
};

export const addOns: AddOn[] = [
  {
    key: 'bridge',
    name: 'CROS Bridge™',
    headline: 'Your past relationships become living memory',
    description: 'Bridge helps your past relationships become living memory inside CROS — preserving continuity, story, and relational history as you transition from legacy systems.',
    bullets: ['Relatio integration bridges', 'HubSpot two-way sync', 'Story-preserving migration tools'],
    price: '+$49',
    priceSuffix: '/mo',
    quantityMode: 'toggle',
    learnMoreUrl: '/integrations',
  },
  {
    key: 'capacity_expansion_25',
    name: 'Team Capacity Expansion',
    headline: 'Grow your active team',
    description: 'Add blocks of active team capacity. Visitors, volunteers, and imported contacts are always free — capacity reflects the core team guiding the mission.',
    bullets: ['+25 active team members', 'Instant activation', 'Same permissions model'],
    price: '+$29',
    priceSuffix: '/block/mo',
    quantityMode: 'toggle',
  },
  {
    key: 'capacity_expansion_75',
    name: 'Team Capacity Expansion (75)',
    headline: 'Scale your team further',
    description: 'A larger capacity block for growing organizations. Visitors, volunteers, and imported contacts remain free.',
    bullets: ['+75 active team members', 'Best value per seat', 'Instant activation'],
    price: '+$69',
    priceSuffix: '/block/mo',
    quantityMode: 'toggle',
  },
  {
    key: 'expanded_local_pulse',
    name: 'Expanded Local Pulse',
    headline: 'More sources, faster awareness',
    description: 'Upgrade from weekly to daily crawls with a higher article cap — so your community awareness stays current, not stale.',
    bullets: ['Daily crawl cadence', 'Higher article cap per run', 'More source diversity'],
    price: '+$25',
    priceSuffix: '/mo',
    quantityMode: 'toggle',
  },
  {
    key: 'campaigns',
    name: 'Relatio Campaigns™',
    headline: 'Outreach built on relationships',
    description: 'Send thoughtful email through Gmail or Outlook — directly from the relationships you already track. No CSV exports, no separate tools.',
    bullets: ['Gmail & Outlook sending', 'Narrative-safe outreach', 'Migration from Mailchimp & others'],
    price: '+$29',
    priceSuffix: '/mo',
    quantityMode: 'toggle',
    learnMoreUrl: '/relatio-campaigns',
  },
  {
    key: 'expansion_capacity',
    name: 'Expansion Capacity',
    headline: 'Grow into new regions',
    description: 'Designed for organizations growing into new regions. Unlock additional metros, expansion planning tools, and readiness tracking powered by NRI™.',
    bullets: ['Additional metro activation', 'Expansion Planning Canvas', 'Metro readiness signals', 'Expansion trajectory tracking'],
    price: '+$19',
    priceSuffix: '/metro/mo',
    quantityMode: 'stepper',
    maxQty: 20,
  },
];

export type GuidedActivationOption = {
  key: string;
  name: string;
  headline: string;
  description: string;
  bullets: string[];
  price: string;
  disclaimer: string;
  sessionsTotal: number;
};

export const guidedActivationOptions: GuidedActivationOption[] = [
  {
    key: 'guided_activation',
    name: 'Guided Activation™',
    headline: 'A working session — done with you',
    description: 'A calm, 90-minute working session to get your space set up, migrate what matters, and shape your first living relationship story. Some organizations prefer to walk this path together.',
    bullets: [
      'We\'ll help connect your email/calendar (optional)',
      'We\'ll migrate contacts + relationship history from your current system',
      'We\'ll tailor your first Journey + mission template',
      'You\'ll leave with your first narrative already forming',
    ],
    price: '$249',
    disclaimer: 'Not support. Not training videos. A working session — done with you.',
    sessionsTotal: 1,
  },
  {
    key: 'guided_activation_plus',
    name: 'Guided Activation Plus™',
    headline: 'Setup + follow-through',
    description: 'Two sessions \u2014 setup + follow-through \u2014 so your team isn\'t left holding the bag after week one.',
    bullets: [
      'Everything in Guided Activation™',
      'Second 90-minute session within 2 weeks',
      'Review, refine, and deepen your narratives',
      'Team onboarding support',
    ],
    price: '$449',
    disclaimer: 'Not support. Not training videos. A working session — done with you.',
    sessionsTotal: 2,
  },
];

/** Active team capacity included per plan tier */
export const planCapacity: Record<string, number> = {
  core: 10,
  insight: 25,
  story: 50,
};

export const coreLimits = [
  '10 active team members included',
  '1 metro included — additional metros available as expansion add-on',
  'Standard AI usage pool',
  'Visitors, volunteers & imported contacts are always free',
];
