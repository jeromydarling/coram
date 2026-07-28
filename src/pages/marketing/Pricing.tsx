import { useState, useRef, useEffect } from 'react';
import { useDiscernmentSignal } from '@/hooks/useDiscernmentSignal';
import { Link, useSearchParams } from 'react-router-dom';
import PricingComparisonTable from '@/components/pricing/PricingComparisonTable';
import CostSavingsCalculator from '@/components/pricing/CostSavingsCalculator';
import { FoundingGardenBanner } from '@/components/pricing/FoundingGardenBanner';
import { Button } from '@/components/ui/button';
import { Check, ArrowRight, Sparkles, Plus, Minus, Loader2, ShoppingCart, X, Mail, Users, Zap, Globe, Brain, ChevronDown, MapPin, Smartphone, Tablet, Laptop, Link2, Heart } from 'lucide-react';
import RelationalFlowStrip from '@/components/marketing/RelationalFlowStrip';
import { tiers } from '@/config/brand';
import { pricing, addOns, coreLimits, guidedActivationOptions, annualPrice, MONTHLY_PRICES, ADDON_MONTHLY_PRICES } from '@/content/pricing';
import { stripeProducts, type StripeTierKey } from '@/config/stripe';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import SeoHead from '@/components/seo/SeoHead';
import SeoBreadcrumb from '@/components/seo/SeoBreadcrumb';
import SeoInternalLinks from '@/components/seo/SeoInternalLinks';
import { productSchema } from '@/lib/seo/seoConfig';
import pricingHero from '@/assets/pricing-hero.webp';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

/** Map module/feature labels → tooltip text (no links) */
const featureTips: Record<string, string> = {
  'Profunda (Relationship OS)': 'The relationship memory engine — contacts, journeys, reflections.',
  'Civitas (Community Awareness)': 'Metro-level community awareness, narrative, and local signals.',
  'Testimonium': 'Narrative storytelling layer — drift detection and story signals.',
  'Testimonium storytelling': 'Capture and share community impact stories.',
  'Drift Detection': 'NRI-powered alerts when relationships need attention.',
  'Heat Map Narrative Overlays': 'Visual narrative patterns across your metro.',
  'Heat Map Overlays': 'Visual narrative patterns across your metro.',
  'Story Signals': 'AI-surfaced community signals worth paying attention to.',
  'Story Signals (Signum Intelligence)': 'AI-surfaced community signals worth paying attention to.',
  'Impulsus': 'Private impact scrapbook journal for your team.',
  'Impulsus impact journal': 'Private impact scrapbook journal for your team.',
  'Executive storytelling exports': 'Board-ready impact narratives exported from your journal.',
  'Executive Exports': 'Board-ready impact narratives.',
  'Narrative reporting': 'Automated narrative reports from your relationship data.',
  'Narrative Reporting': 'Automated narrative reports from your relationship data.',
  'Relatio integrations': 'Integration bridges to existing tools and CRMs.',
  'Relatio Integrations': 'Integration bridges to existing tools and CRMs.',
  'HubSpot two-way sync': 'Bi-directional sync with HubSpot contacts and deals.',
  'HubSpot Two-Way Sync': 'Bi-directional sync with HubSpot contacts and deals.',
  'CRM Two-Way Sync': 'Bi-directional sync with HubSpot, Salesforce, and Microsoft Dynamics 365 — contacts, accounts, tasks, and activities with conflict detection.',
  'CRM migration tools': 'Guided migration from Salesforce, HubSpot, Dynamics 365, and others.',
  'CRM Migration Tools': 'Guided migration from Salesforce, HubSpot, Dynamics 365, and others.',
  'Signum (Local Pulse baseline)': 'Automated local event and signal discovery for your metro.',
  'Signum (Local Pulse)': 'Automated local event and signal discovery for your metro.',
  'Volunteers (Voluntārium)': 'Volunteer management, hours tracking, and recognition.',
  'Voluntārium': 'Volunteer management, hours tracking, and recognition.',
  'Assona': 'Shared relationship storytelling across your communio group.',
  'Communio (opt-in shared network)': 'Opt-in collaborative network for sharing anonymized signals with trusted peer organizations.',
  'Security & Trust': 'Enterprise-grade protection — idle timeouts, content security policies, data quality monitoring, and audit logging on every tier.',
  'Financial Moments': 'Accept generosity, participation payments, or send invoices — Stripe-secure, funds direct to your account.',
};

/** Render a feature label as a tooltip-only span (no navigation) */
function FeatureLabel({ label }: { label: string }) {
  const tip = featureTips[label];
  if (!tip) return <span>{label}</span>;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className="underline decoration-dotted underline-offset-2 text-[hsl(var(--marketing-navy)/0.65)] hover:text-[hsl(var(--marketing-navy))] transition-colors cursor-help"
        >
          {label}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[220px] text-xs">
        {tip}
      </TooltipContent>
    </Tooltip>
  );
}

const tierOrder: (keyof typeof tiers)[] = ['core', 'insight', 'story'];
const tierColors: Record<string, string> = {
  core: 'hsl(var(--marketing-blue))',
  insight: 'hsl(220 70% 55%)',
  story: 'hsl(270 50% 55%)',
};

const comparisonModules = [
  { label: 'Profunda (Relationship OS)', core: true, insight: true, story: true },
  { label: 'Civitas™ (Multi-Metro)', core: false, insight: false, story: false, addon: true },
  { label: 'Relationships & People', core: true, insight: true, story: true },
  { label: 'Journeys & Reflections', core: true, insight: true, story: true },
  { label: 'Voluntārium', core: true, insight: true, story: true },
  { label: 'Events & Calendar', core: true, insight: true, story: true },
  { label: 'Signum (Local Pulse)', core: true, insight: true, story: true },
  { label: 'Basic Narrative', core: true, insight: true, story: true },
  { label: 'Communio (opt-in shared network)', core: true, insight: true, story: true },
  { label: 'Security & Trust', core: true, insight: true, story: true },
  { label: 'Testimonium', core: false, insight: true, story: true },
  { label: 'Drift Detection', core: false, insight: true, story: true },
  { label: 'Heat Map Overlays', core: false, insight: true, story: true },
  { label: 'Story Signals', core: false, insight: true, story: true },
  { label: 'Impulsus', core: false, insight: false, story: true },
  { label: 'Executive Exports', core: false, insight: false, story: true },
  { label: 'Narrative Reporting', core: false, insight: false, story: true },
  { label: 'Relatio Integrations', core: false, insight: false, story: false, addon: true },
  { label: 'CRM Two-Way Sync', core: false, insight: false, story: false, addon: true },
  { label: 'CRM Migration Tools', core: false, insight: false, story: false, addon: true },
];

/** Tier keys that can be toggled as add-ons (core is always included) */
const addOnTierKeys: (keyof typeof tiers)[] = ['insight', 'story'];

/** Icons for capacity add-ons */
const addonIcons: Record<string, React.ReactNode> = {
  bridge: <Link2 className="h-5 w-5" />,
  capacity_expansion_25: <Users className="h-5 w-5" />,
  capacity_expansion_75: <Users className="h-5 w-5" />,
  expanded_local_pulse: <Globe className="h-5 w-5" />,
  campaigns: <Mail className="h-5 w-5" />,
  expansion_capacity: <MapPin className="h-5 w-5" />,
};

const jumpNavItems = [
  { label: 'Plans & Pricing', id: 'pricing-tiers' },
  { label: 'Cost Analysis', id: 'cost-analysis' },
  { label: 'Stack Comparison', id: 'stack-comparison' },
  { label: 'Savings Calculator', id: 'savings-calculator' },
  { label: 'Compare Plans', id: 'compare-plans' },
  { label: 'Financial Moments', id: 'financial-moments-pricing' },
];

function PricingJumpNav() {
  const [open, setOpen] = useState(false);

  const scrollTo = (id: string) => {
    setOpen(false);
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="flex justify-center mb-6">
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-[hsl(var(--marketing-border))] bg-[hsl(var(--marketing-surface))] text-sm font-medium text-[hsl(var(--marketing-navy)/0.7)] hover:text-[hsl(var(--marketing-navy))] hover:border-[hsl(var(--marketing-navy)/0.3)] transition-all"
        >
          Jump to section
          <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-50 w-56 bg-white rounded-xl border border-[hsl(var(--marketing-border))] shadow-lg py-2">
              {jumpNavItems.map(item => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => scrollTo(item.id)}
                  className="w-full text-left px-4 py-2.5 text-sm text-[hsl(var(--marketing-navy)/0.65)] hover:text-[hsl(var(--marketing-navy))] hover:bg-[hsl(var(--marketing-surface))] transition-colors"
                >
                  {item.label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function Pricing() {
  const emit = useDiscernmentSignal('pricing');
  useEffect(() => { emit('page_view'); }, [emit]);
  const [annual, setAnnual] = useState(false);
  const [loadingTier, setLoadingTier] = useState<string | null>(null);
  const [searchParams] = useSearchParams();
  // Cart state: core is always included
  const [cart, setCart] = useState<Set<string>>(new Set(['core']));
  // Capacity add-on state
  const [addonToggles, setAddonToggles] = useState<Record<string, boolean>>({});
  const [addonExpansionQty, setAddonExpansionQty] = useState(0);
  // Guided Activation selection
  const [selectedGA, setSelectedGA] = useState<string | null>(null);
  // Founding Garden opt-in
  const [foundingGardenOptIn, setFoundingGardenOptIn] = useState(false);

  const toggleCartItem = (key: string) => {
    if (key === 'core') return; // can't remove core
    setCart(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const toggleAddon = (key: string) => {
    setAddonToggles(prev => ({ ...prev, [key]: !prev[key] }));
  };

  /** Effective annual flag — Founding Garden members always get annual rates */
  const effectiveAnnual = annual || foundingGardenOptIn;

  const cartTotal = () => {
    let total = 0;
    // Tier prices
    cart.forEach(key => {
      const monthly = MONTHLY_PRICES[key];
      if (monthly == null) return;
      total += effectiveAnnual ? annualPrice(monthly) : monthly;
    });
    // Add-on prices
    addOns.forEach(a => {
      const monthlyPrice = ADDON_MONTHLY_PRICES[a.key];
      if (!monthlyPrice) return;
      if (a.key === 'expansion_capacity') {
        if (addonExpansionQty > 0) {
          total += effectiveAnnual ? annualPrice(monthlyPrice) * addonExpansionQty : monthlyPrice * addonExpansionQty;
        }
      } else if (addonToggles[a.key]) {
        total += effectiveAnnual ? annualPrice(monthlyPrice) : monthlyPrice;
      }
    });
    // Guided Activation (one-time, no annual discount)
    if (selectedGA) {
      const ga = guidedActivationOptions.find(g => g.key === selectedGA);
      if (ga) {
        const num = parseFloat(ga.price.replace(/[^0-9.]/g, ''));
        if (!isNaN(num)) total += num;
      }
    }
    return total;
  };

  /** Format a price for display */
  const displayPrice = (monthlyAmount: number, isAddon = false): string => {
    if (effectiveAnnual) {
      return `${isAddon ? '+' : ''}$${annualPrice(monthlyAmount)}/yr`;
    }
    return `${isAddon ? '+' : ''}$${monthlyAmount}/mo`;
  };

  const activeAddons = addOns.filter(a =>
    a.key === 'expansion_capacity' ? addonExpansionQty > 0 :
    addonToggles[a.key]
  );

  const handleCheckout = async () => {
    const selectedTiers = Array.from(cart);
    if (selectedTiers.length === 0) return;

    // Open tab synchronously on user gesture to avoid popup blockers + iframe issues in preview
    const checkoutTab = window.open('about:blank', '_blank', 'noopener,noreferrer');

    setLoadingTier('cart');
    try {
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: {
          tiers: selectedTiers,
          addons: {
            bridge: addonToggles['bridge'] || undefined,
            capacity_expansion_25: addonToggles['capacity_expansion_25'] || undefined,
            capacity_expansion_75: addonToggles['capacity_expansion_75'] || undefined,
            expanded_local_pulse: addonToggles['expanded_local_pulse'] || undefined,
            campaigns: addonToggles['campaigns'] || undefined,
            expansion_capacity_qty: addonExpansionQty > 0 ? addonExpansionQty : undefined,
          },
          guided_activation: selectedGA || undefined,
          founding_garden_opt_in: foundingGardenOptIn || undefined,
          annual: effectiveAnnual || undefined,
        },
      });

      if (error) throw error;
      if (!data?.url) throw new Error('No checkout URL returned');

      if (checkoutTab && !checkoutTab.closed) {
        checkoutTab.location.href = data.url;
      } else {
        window.location.assign(data.url);
      }
    } catch (err) {
      if (checkoutTab && !checkoutTab.closed) checkoutTab.close();
      const msg = err instanceof Error ? err.message : 'Checkout failed';
      toast({ title: 'Checkout error', description: msg, variant: 'destructive' });
    } finally {
      setLoadingTier(null);
    }
  };

  return (
    <TooltipProvider delayDuration={200}>
    <div className="bg-white" data-testid="pricing-root">
      <SeoHead
        title="Pricing"
        description="Simple, human pricing for CROS™. Start with Core for free. Expand with Insight, Story, and Bridge as your community grows."
        keywords={['CROS pricing', 'nonprofit CRM pricing', 'community relationship OS cost']}
        canonical="/pricing"
        jsonLd={productSchema({ name: 'CROS Core', description: 'The foundation for relationship-centered community work.', url: '/pricing', price: '0', priceCurrency: 'USD' })}
      />
      <section className="relative overflow-hidden">
        <img src={pricingHero} alt="" aria-hidden="true" loading="eager" className="pointer-events-none absolute inset-0 w-full h-full opacity-[0.15] object-cover object-center scale-[2.4] origin-top" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-16 sm:pt-24 pb-16 sm:pb-20">
        {/* Header */}
        <div className="text-center mb-4">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-[hsl(var(--marketing-navy))] leading-[1.15] tracking-tight mb-4" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>
            Simple, human pricing
          </h1>
          <p className="text-lg text-[hsl(var(--marketing-navy)/0.6)] max-w-xl mx-auto mb-2">
            Start with Core. Expand as your community grows.
          </p>
          <p className="text-sm text-[hsl(var(--marketing-navy)/0.5)] mb-2">
            Not sure how this compares to your current system?{' '}
            <Link to="/compare" className="text-[hsl(var(--marketing-blue))] hover:underline font-medium">
              See the comparison →
            </Link>
          </p>
        </div>
        </div>
      </section>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-12 sm:pt-16 pb-16 sm:pb-24">
        <SeoBreadcrumb items={[{ label: 'Home', to: '/' }, { label: 'Pricing' }]} />

        {/* Jump-nav dropdown */}
        <PricingJumpNav />


        <p
          className="text-center max-w-lg mx-auto text-sm text-[hsl(var(--marketing-navy)/0.45)] leading-relaxed mb-2"
          style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
        >
          CROS™ grows stronger the more you show up.
          The platform doesn't replace your work — it reveals the impact already unfolding.
        </p>
        <p
          className="text-center max-w-lg mx-auto text-xs text-[hsl(var(--marketing-navy)/0.4)] leading-relaxed mb-8"
          style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
        >
          CROS adapts to Shepherds, Companions, and Visitors — because every organization moves through people differently.
        </p>

        {/* Monthly / Annual toggle */}
        <div className="flex items-center justify-center gap-3 mb-12">
          <span className={`text-sm font-medium transition-colors ${!annual ? 'text-[hsl(var(--marketing-navy))]' : 'text-[hsl(var(--marketing-navy)/0.4)]'}`}>
            Monthly
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={annual}
            onClick={() => setAnnual(!annual)}
            className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
              annual ? 'bg-[hsl(var(--marketing-navy))]' : 'bg-[hsl(var(--marketing-navy)/0.2)]'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-[22px] w-[22px] rounded-full bg-white shadow-sm ring-0 transition-transform ${
                annual ? 'translate-x-[22px]' : 'translate-x-[1px]'
              } mt-[1px]`}
            />
          </button>
          <span className={`text-sm font-medium transition-colors ${annual ? 'text-[hsl(var(--marketing-navy))]' : 'text-[hsl(var(--marketing-navy)/0.4)]'}`}>
            Stability Commitment (Annual)
          </span>
        </div>

        {/* Founding Garden Banner — auto-hides when cap reached */}
        <FoundingGardenBanner optedIn={foundingGardenOptIn} onToggle={setFoundingGardenOptIn} />

        {/* Free Companion Card */}
        <div className="max-w-4xl mx-auto mb-8" id="companion-free">
          <div className="rounded-2xl border-2 border-dashed border-[hsl(var(--marketing-blue)/0.25)] bg-[hsl(var(--marketing-blue)/0.03)] p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6">
              <div className="w-12 h-12 rounded-xl bg-[hsl(var(--marketing-blue)/0.1)] flex items-center justify-center shrink-0">
                <Heart className="h-6 w-6 text-[hsl(var(--marketing-blue))]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-lg font-semibold text-[hsl(var(--marketing-navy))]">Companion (Solo)</h3>
                  <span className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--marketing-blue))] bg-[hsl(var(--marketing-blue)/0.08)] px-2 py-0.5 rounded-full">Free forever</span>
                </div>
                <p className="text-sm text-[hsl(var(--marketing-navy)/0.55)] mb-3 leading-relaxed">
                  A private workspace for independent caregivers, mentors, sponsors, spiritual directors, and anyone who walks closely with others.
                </p>
                <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-[hsl(var(--marketing-navy)/0.55)]">
                  <li className="flex items-center gap-1.5"><Check className="h-3 w-3 text-[hsl(var(--marketing-blue))] shrink-0" /> Private visit logs</li>
                  <li className="flex items-center gap-1.5"><Check className="h-3 w-3 text-[hsl(var(--marketing-blue))] shrink-0" /> Season summaries</li>
                  <li className="flex items-center gap-1.5"><Check className="h-3 w-3 text-[hsl(var(--marketing-blue))] shrink-0" /> Reflections</li>
                  <li className="flex items-center gap-1.5"><Check className="h-3 w-3 text-[hsl(var(--marketing-blue))] shrink-0" /> NRI assistance</li>
                  <li className="flex items-center gap-1.5"><Check className="h-3 w-3 text-[hsl(var(--marketing-blue))] shrink-0" /> No credit card required</li>
                </ul>
              </div>
              <div className="w-full sm:w-auto shrink-0">
                <Link to="/onboarding?tier=companion_free">
                  <Button className="w-full sm:w-auto rounded-full bg-[hsl(var(--marketing-navy))] text-white hover:bg-[hsl(var(--marketing-navy)/0.9)] px-6">
                    Start free <ArrowRight className="ml-1.5 h-4 w-4" />
                  </Button>
                </Link>
                <p className="text-[10px] text-center text-[hsl(var(--marketing-navy)/0.35)] mt-1.5">
                  For individuals — not organizations
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Tier Cards */}
        <div id="pricing-tiers" className="grid md:grid-cols-3 gap-5 max-w-4xl mx-auto scroll-mt-24">
          {tierOrder.map((key) => {
            const tier = tiers[key];
            const price = pricing[key];
            const isCore = key === 'core';
            const inCart = cart.has(key);

            return (
              <div
                key={key}
                data-testid={`pricing-tier-${key}`}
                className={`bg-white rounded-2xl border p-6 flex flex-col transition-all ${
                  inCart
                    ? 'border-[hsl(var(--marketing-blue))] ring-1 ring-[hsl(var(--marketing-blue)/0.2)]'
                    : 'border-[hsl(var(--marketing-border))]'
                }`}
              >
                {isCore && (
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--marketing-blue))] mb-2">
                    Always Included
                  </span>
                )}
                {inCart && !isCore && (
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--marketing-blue))] mb-2">
                    In Your Cart
                  </span>
                )}
                <div className="w-3 h-3 rounded-full mb-4" style={{ backgroundColor: tierColors[key] }} />
                <h3 className="text-lg font-semibold text-[hsl(var(--marketing-navy))] mb-1">{tier.name}</h3>
                <p className="text-sm text-[hsl(var(--marketing-navy)/0.5)] mb-4">{tier.tagline}</p>
                <div className="mb-1">
                  <span className="text-3xl font-bold text-[hsl(var(--marketing-navy))]">
                    {displayPrice(price.monthlyNum, price.isAddOn)}
                  </span>
                  {foundingGardenOptIn && !annual && (
                    <span className="ml-2 text-xs text-[hsl(var(--marketing-blue))] font-medium">Founding rate</span>
                  )}
                </div>
                {price.isAddOn && (
                  <p className="text-xs text-[hsl(var(--marketing-navy)/0.4)] mb-4">{price.addOnLabel}</p>
                )}
                {isCore && (
                 <div className="mb-4 mt-2 space-y-1">
                    {coreLimits.map((l) => (
                      <p key={l} className="text-xs text-[hsl(var(--marketing-navy)/0.45)]">• {l}</p>
                    ))}
                    <button
                      type="button"
                      onClick={() => {
                        const el = document.getElementById('capacity-upgrades');
                        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      }}
                      className="text-[10px] text-[hsl(var(--marketing-blue))] hover:underline italic mt-1 cursor-pointer"
                    >
                      Planning work in multiple cities? Add Expansion Capacity below.
                    </button>
                  </div>
                )}
                {!isCore && <div className="mb-4" />}
                <ul className="space-y-2.5 flex-1">
                  {tier.includes.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm text-[hsl(var(--marketing-navy)/0.65)]">
                      <Check className="h-4 w-4 text-[hsl(var(--marketing-blue))] mt-0.5 flex-shrink-0" />
                      <FeatureLabel label={item} />
                    </li>
                  ))}
                </ul>
                <div className="mt-6">
                  {isCore ? (
                    <div className="text-center text-xs text-[hsl(var(--marketing-navy)/0.4)] py-2">
                      Included in every plan
                    </div>
                  ) : (
                    <Button
                      variant={inCart ? 'default' : 'outline'}
                      className={`w-full rounded-full ${
                        inCart
                          ? 'bg-[hsl(var(--marketing-blue))] text-white hover:bg-[hsl(var(--marketing-blue)/0.9)]'
                          : 'border-[hsl(var(--marketing-navy)/0.2)] text-[hsl(var(--marketing-navy))]'
                      }`}
                      size="sm"
                      onClick={() => toggleCartItem(key)}
                    >
                      {inCart ? (
                        <>Remove <X className="ml-1 h-3 w-3" /></>
                      ) : (
                        <>Add to cart <Plus className="ml-1 h-3 w-3" /></>
                      )}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Cart Summary */}
        <div className="mt-8">
          <div className="max-w-md mx-auto bg-[hsl(var(--marketing-surface))] rounded-2xl p-6 border border-[hsl(var(--marketing-border))]">
            <div className="flex items-center gap-2 mb-4">
              <ShoppingCart className="h-5 w-5 text-[hsl(var(--marketing-navy))]" />
              <h3 className="font-semibold text-[hsl(var(--marketing-navy))]">Your Plan</h3>
            </div>
            <div className="space-y-2 mb-4">
              {Array.from(cart).map(key => (
                <div key={key} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: tierColors[key] }} />
                    <span className="text-[hsl(var(--marketing-navy))]">{tiers[key as keyof typeof tiers]?.name}</span>
                  </div>
                  <span className="text-[hsl(var(--marketing-navy)/0.6)]">
                    {displayPrice(pricing[key]?.monthlyNum ?? 0, pricing[key]?.isAddOn)}
                  </span>
                </div>
              ))}
              {/* Capacity add-ons in cart */}
              {activeAddons.map(a => (
                <div key={a.key} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <Plus className="h-2.5 w-2.5 text-[hsl(var(--marketing-blue))]" />
                    <span className="text-[hsl(var(--marketing-navy)/0.8)]">
                      {a.name}{a.key === 'expansion_capacity' ? ` ×${addonExpansionQty}` : ''}
                    </span>
                  </div>
                  <span className="text-[hsl(var(--marketing-navy)/0.6)]">
                    {(() => {
                      const mp = ADDON_MONTHLY_PRICES[a.key] ?? 0;
                      const qty = a.key === 'expansion_capacity' ? addonExpansionQty : 1;
                      const unitTotal = effectiveAnnual ? annualPrice(mp) * qty : mp * qty;
                      return `+$${unitTotal}${effectiveAnnual ? '/yr' : '/mo'}`;
                    })()}
                  </span>
                </div>
              ))}
              {/* Guided Activation in cart */}
              {selectedGA && (() => {
                const ga = guidedActivationOptions.find(g => g.key === selectedGA);
                return ga ? (
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-2.5 w-2.5 text-[hsl(var(--marketing-blue))]" />
                      <span className="text-[hsl(var(--marketing-navy)/0.8)]">{ga.name}</span>
                    </div>
                    <span className="text-[hsl(var(--marketing-navy)/0.6)]">{ga.price} one-time</span>
                  </div>
                ) : null;
              })()}
            </div>
            <div className="border-t border-[hsl(var(--marketing-border))] pt-3 mb-4 flex justify-between items-baseline">
              <span className="text-sm font-medium text-[hsl(var(--marketing-navy))]">Total</span>
              <span className="text-2xl font-bold text-[hsl(var(--marketing-navy))]" data-testid="pricing-cart-total">
                ${cartTotal()}{effectiveAnnual ? '/yr' : '/mo'}
              </span>
            </div>
            <Button
              className="w-full rounded-full bg-[hsl(var(--marketing-navy))] text-white hover:bg-[hsl(var(--marketing-navy)/0.9)]"
              disabled={!!loadingTier}
              onClick={handleCheckout}
              data-testid="checkout-button"
            >
              {loadingTier === 'cart' ? (
                <><Loader2 className="mr-1 h-4 w-4 animate-spin" /> Redirecting…</>
              ) : (
                <>Start your plan <ArrowRight className="ml-1.5 h-4 w-4" /></>
              )}
            </Button>
            <p className="text-[11px] text-center text-[hsl(var(--marketing-navy)/0.4)] mt-2">
              30-day guided onboarding included
            </p>
          </div>
        </div>

        {/* Bundle hint */}
        <div className="mt-8 text-center">
          <div className="inline-flex items-center gap-2 bg-[hsl(var(--marketing-surface))] rounded-full px-5 py-2.5 border border-[hsl(var(--marketing-border))]">
            <Sparkles className="h-4 w-4 text-[hsl(var(--marketing-blue))]" />
            <span className="text-sm text-[hsl(var(--marketing-navy)/0.7)]">
              Most teams start with <strong className="text-[hsl(var(--marketing-navy))]">Core + Insight</strong>
            </span>
          </div>
        </div>


        {/* Capacity Add-ons */}
        <div className="mt-16" id="capacity-upgrades">
          <div className="flex items-center justify-center gap-2 mb-3">
            <h2 className="text-2xl font-bold text-[hsl(var(--marketing-navy))]">Team Capacity & Upgrades</h2>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[hsl(var(--marketing-navy)/0.35)] hover:text-[hsl(var(--marketing-navy)/0.6)] transition-colors"
                  aria-label="About NRI learning"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[240px] text-xs">
                NRI™ learns from reflections, events, and relationship activity — not automation alone.
              </TooltipContent>
            </Tooltip>
          </div>
          <p
            className="text-center text-sm text-[hsl(var(--marketing-navy)/0.5)] mb-3 max-w-lg mx-auto"
            style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
          >
            CROS™ grows with your community.<br />
            Visitors and volunteers are always welcome —<br />
            capacity reflects the core team guiding the mission.
          </p>
          <p className="text-center text-sm text-[hsl(var(--marketing-navy)/0.5)] mb-8 max-w-lg mx-auto">
            Add these to any plan. They appear in your cart and checkout together.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 max-w-5xl mx-auto">
            {addOns.map((a) => {
              const isActive = a.key === 'expansion_capacity' ? addonExpansionQty > 0 : addonToggles[a.key];
              return (
                <div
                  key={a.key}
                  className={`rounded-2xl p-6 border transition-all ${
                    isActive
                      ? 'border-[hsl(var(--marketing-blue))] ring-1 ring-[hsl(var(--marketing-blue)/0.2)] bg-white'
                      : 'border-[hsl(var(--marketing-border))] bg-[hsl(var(--marketing-surface))]'
                  }`}
                >
                  <div className="flex items-start gap-3 mb-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      isActive ? 'bg-[hsl(var(--marketing-blue)/0.1)] text-[hsl(var(--marketing-blue))]' : 'bg-[hsl(var(--marketing-navy)/0.06)] text-[hsl(var(--marketing-navy)/0.4)]'
                    }`}>
                      {addonIcons[a.key] ?? <Plus className="h-5 w-5" />}
                    </div>
                    <div className="min-w-0">
                      {a.learnMoreUrl ? (
                        <Link to={a.learnMoreUrl} className="font-semibold text-sm text-[hsl(var(--marketing-navy))] hover:text-[hsl(var(--marketing-blue))] transition-colors underline-offset-2 hover:underline">
                          {a.name}
                        </Link>
                      ) : (
                        <h3 className="font-semibold text-sm text-[hsl(var(--marketing-navy))]">{a.name}</h3>
                      )}
                      <p className="text-xs text-[hsl(var(--marketing-navy)/0.45)] italic">{a.headline}</p>
                    </div>
                  </div>
                  <p className="text-xs text-[hsl(var(--marketing-navy)/0.55)] mb-3 leading-relaxed">{a.description}</p>
                  <ul className="space-y-1.5 mb-4">
                    {a.bullets.map(b => (
                      <li key={b} className="flex items-center gap-2 text-xs text-[hsl(var(--marketing-navy)/0.6)]">
                        <Check className="h-3 w-3 text-[hsl(var(--marketing-blue))] shrink-0" />
                        {b}
                      </li>
                    ))}
                  </ul>
                  <div className="flex items-center justify-between pt-3 border-t border-[hsl(var(--marketing-border)/0.5)]">
                    <span className="text-lg font-bold text-[hsl(var(--marketing-navy))]">
                      {a.price}<span className="text-xs font-normal text-[hsl(var(--marketing-navy)/0.4)]">{a.priceSuffix}</span>
                    </span>
                    {a.quantityMode === 'stepper' ? (
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-7 w-7 rounded-full border-[hsl(var(--marketing-navy)/0.15)]"
                          disabled={addonExpansionQty <= 0}
                          onClick={() => setAddonExpansionQty(q => Math.max(0, q - 1))}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="text-sm font-medium w-6 text-center text-[hsl(var(--marketing-navy))]">
                          {addonExpansionQty}
                        </span>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-7 w-7 rounded-full border-[hsl(var(--marketing-navy)/0.15)]"
                          disabled={addonExpansionQty >= (a.maxQty ?? 50)}
                          onClick={() => setAddonExpansionQty(q => Math.min(a.maxQty ?? 50, q + 1))}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant={isActive ? 'default' : 'outline'}
                        size="sm"
                        className={`rounded-full text-xs ${
                          isActive
                            ? 'bg-[hsl(var(--marketing-blue))] text-white hover:bg-[hsl(var(--marketing-blue)/0.9)]'
                            : 'border-[hsl(var(--marketing-navy)/0.2)] text-[hsl(var(--marketing-navy))]'
                        }`}
                        onClick={() => toggleAddon(a.key)}
                      >
                        {isActive ? <>Added <X className="ml-1 h-3 w-3" /></> : <>Add <Plus className="ml-1 h-3 w-3" /></>}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Guided Activation Add-on */}
        <div className="mt-16">
          <h2 className="text-2xl font-bold text-[hsl(var(--marketing-navy))] text-center mb-2">Guided Activation™</h2>
          <p className="text-center text-sm text-[hsl(var(--marketing-navy)/0.5)] mb-8 max-w-lg mx-auto"
            style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
          >
            Not support. Not training videos. A working session — done with you.
          </p>
          <div className="grid sm:grid-cols-2 gap-5 max-w-3xl mx-auto">
            {guidedActivationOptions.map((ga) => {
              const isSelected = selectedGA === ga.key;
              return (
                <div
                  key={ga.key}
                  className={`rounded-2xl p-6 border transition-all ${
                    isSelected
                      ? 'border-[hsl(var(--marketing-blue))] ring-1 ring-[hsl(var(--marketing-blue)/0.2)] bg-white'
                      : 'border-[hsl(var(--marketing-border))] bg-[hsl(var(--marketing-surface))]'
                  }`}
                >
                  <div className="flex items-start gap-3 mb-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      isSelected ? 'bg-[hsl(var(--marketing-blue)/0.1)] text-[hsl(var(--marketing-blue))]' : 'bg-[hsl(var(--marketing-navy)/0.06)] text-[hsl(var(--marketing-navy)/0.4)]'
                    }`}>
                      <Sparkles className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-sm text-[hsl(var(--marketing-navy))]">{ga.name}</h3>
                      <p className="text-xs text-[hsl(var(--marketing-navy)/0.45)] italic">{ga.headline}</p>
                    </div>
                  </div>
                  <p className="text-xs text-[hsl(var(--marketing-navy)/0.55)] mb-3 leading-relaxed">{ga.description}</p>
                  <ul className="space-y-1.5 mb-4">
                    {ga.bullets.map(b => (
                      <li key={b} className="flex items-center gap-2 text-xs text-[hsl(var(--marketing-navy)/0.6)]">
                        <Check className="h-3 w-3 text-[hsl(var(--marketing-blue))] shrink-0" />
                        {b}
                      </li>
                    ))}
                  </ul>
                  <div className="flex items-center justify-between pt-3 border-t border-[hsl(var(--marketing-border)/0.5)]">
                    <span className="text-lg font-bold text-[hsl(var(--marketing-navy))]">
                      {ga.price}<span className="text-xs font-normal text-[hsl(var(--marketing-navy)/0.4)]"> one-time</span>
                    </span>
                    <Button
                      variant={isSelected ? 'default' : 'outline'}
                      size="sm"
                      className={`rounded-full text-xs ${
                        isSelected
                          ? 'bg-[hsl(var(--marketing-blue))] text-white hover:bg-[hsl(var(--marketing-blue)/0.9)]'
                          : 'border-[hsl(var(--marketing-navy)/0.2)] text-[hsl(var(--marketing-navy))]'
                      }`}
                      onClick={() => setSelectedGA(isSelected ? null : ga.key)}
                    >
                      {isSelected ? <>Added <X className="ml-1 h-3 w-3" /></> : <>Add <Plus className="ml-1 h-3 w-3" /></>}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div id="compare-plans" className="mt-20 scroll-mt-24">
          <h2 className="text-2xl font-bold text-[hsl(var(--marketing-navy))] text-center mb-3">Compare plans</h2>
          <p
            className="text-center text-xs text-[hsl(var(--marketing-navy)/0.4)] mb-8 max-w-lg mx-auto italic"
            style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
          >
            CROS removes the burden of structuring human stories into rows and columns — letting AI handle structure while people handle relationships.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[hsl(var(--marketing-border))]">
                  <th className="text-left py-3 pr-4 font-medium text-[hsl(var(--marketing-navy)/0.5)]">Module</th>
                  {tierOrder.map((key) => (
                    <th key={key} className="text-center py-3 px-3 font-semibold text-[hsl(var(--marketing-navy))]">
                      <div className="flex flex-col items-center gap-1">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: tierColors[key] }} />
                        <span className="text-xs">{tiers[key].name.replace('CROS ', '')}</span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {comparisonModules.map((mod) => {
                  const labelEl = <FeatureLabel label={mod.label} />;
                  return (
                  <tr key={mod.label} className="border-b border-[hsl(var(--marketing-border)/0.5)]">
                    <td className="py-2.5 pr-4">{labelEl}</td>
                    {tierOrder.map((key) => (
                      <td key={key} className="text-center py-2.5 px-3">
                        {mod[key as keyof typeof mod] === true ? (
                          <Check className="h-4 w-4 text-[hsl(var(--marketing-blue))] mx-auto" />
                        ) : (mod as any).addon ? (
                          <span className="text-[10px] font-medium text-[hsl(var(--marketing-navy)/0.35)]">Add-on</span>
                        ) : (
                          <span className="text-[hsl(var(--marketing-navy)/0.15)]">—</span>
                        )}
                      </td>
                    ))}
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Cost Savings Narrative */}
        <section id="cost-analysis" className="mt-20 max-w-3xl mx-auto scroll-mt-24">
          <h2
            className="text-2xl sm:text-3xl font-bold text-[hsl(var(--marketing-navy))] text-center mb-6"
            style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
          >
            How Much Are You Really Paying To Stay Fragmented?
          </h2>
          <div className="space-y-4 text-sm text-[hsl(var(--marketing-navy)/0.6)] leading-relaxed"
            style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
          >
            <p>Most organizations didn't choose complexity — it accumulated over time.</p>
            <p>A typical ministry or nonprofit today might be paying for:</p>
            <ul className="space-y-1.5 pl-1">
              {[
                'A CRM they barely use',
                'An email marketing platform',
                'A volunteer scheduling tool',
                'A project manager',
                'A calendar system',
                'A reporting dashboard',
                'A notes or journaling tool',
                'An integration service to make them talk to each other',
              ].map(item => (
                <li key={item} className="flex items-start gap-2">
                  <span className="text-[hsl(var(--marketing-navy)/0.3)] mt-0.5">•</span>
                  {item}
                </li>
              ))}
            </ul>
            <p>Each tool solves one small problem.<br />Together, they quietly drain time, money, and focus.</p>
            <p className="text-[hsl(var(--marketing-navy)/0.75)] font-medium">
              CROS™ wasn't built to replace your mission.<br />
              It was built to remove the layers between your mission and the people you serve.
            </p>
          </div>
        </section>

        {/* Real Cost Scenario Cards */}
        <section className="mt-16">
          <div className="grid md:grid-cols-3 gap-5 max-w-5xl mx-auto">
            {/* Church */}
            <div className="bg-[hsl(var(--marketing-surface))] rounded-2xl border border-[hsl(var(--marketing-border))] p-6">
              <h3
                className="text-base font-bold text-[hsl(var(--marketing-navy))] mb-3"
                style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
              >
                The Communications Stack — Churches
              </h3>
              <p className="text-xs text-[hsl(var(--marketing-navy)/0.5)] mb-2">Typical tools in use today:</p>
              <ul className="text-xs text-[hsl(var(--marketing-navy)/0.55)] space-y-1 mb-4">
                <li>• Flocknote or Mailchimp — $25–$75/mo</li>
                <li>• Planning Center add-ons — $20–$60/mo</li>
                <li>• Volunteer scheduling tools — $15–$40/mo</li>
                <li>• Project management — $20–$50/mo</li>
                <li>• Automation tools — $20–$60/mo</li>
              </ul>
              <p className="text-sm font-semibold text-[hsl(var(--marketing-navy))] mb-1">$120–$285/month</p>
              <p className="text-[10px] text-[hsl(var(--marketing-navy)/0.4)] mb-4">(before hidden staff time)</p>
              <p className="text-xs text-[hsl(var(--marketing-navy)/0.6)] italic leading-relaxed"
                style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
              >
                With CROS™ Core + NRI™: Relationship memory, volunteer coordination, outreach, narrative reporting — without juggling multiple platforms.
              </p>
            </div>

            {/* Nonprofit */}
            <div className="bg-[hsl(var(--marketing-surface))] rounded-2xl border border-[hsl(var(--marketing-border))] p-6">
              <h3
                className="text-base font-bold text-[hsl(var(--marketing-navy))] mb-3"
                style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
              >
                The Operations Tangle — Nonprofits
              </h3>
              <p className="text-xs text-[hsl(var(--marketing-navy)/0.5)] mb-2">Many nonprofits run:</p>
              <ul className="text-xs text-[hsl(var(--marketing-navy)/0.55)] space-y-1 mb-4">
                <li>• HubSpot or Salesforce Essentials — $25–$90/user/mo</li>
                <li>• Mailchimp or Constant Contact — $20–$80/mo</li>
                <li>• Airtable or spreadsheets — $12–$24/user/mo</li>
              </ul>
              <p className="text-sm font-semibold text-[hsl(var(--marketing-navy))] mb-1">$250–$600/month</p>
              <p className="text-[10px] text-[hsl(var(--marketing-navy)/0.4)] mb-4">for small teams</p>
              <p className="text-xs text-[hsl(var(--marketing-navy)/0.6)] italic leading-relaxed"
                style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
              >
                CROS™ consolidates relationships, journeys, reflections, and outreach into one narrative spine.
              </p>
            </div>

            {/* Social Enterprise */}
            <div className="bg-[hsl(var(--marketing-surface))] rounded-2xl border border-[hsl(var(--marketing-border))] p-6">
              <h3
                className="text-base font-bold text-[hsl(var(--marketing-navy))] mb-3"
                style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
              >
                Tool Sprawl — Social Enterprises
              </h3>
              <p className="text-xs text-[hsl(var(--marketing-navy)/0.5)] mb-2">Common stack:</p>
              <ul className="text-xs text-[hsl(var(--marketing-navy)/0.55)] space-y-1 mb-4">
                <li>• CRM (Zoho/Pipedrive/HubSpot)</li>
                <li>• Email marketing platform</li>
                <li>• Volunteer tracking</li>
                <li>• Event platforms</li>
                <li>• Reporting dashboards</li>
              </ul>
              <p className="text-sm font-semibold text-[hsl(var(--marketing-navy))] mb-1">$300–$900/month</p>
              <p className="text-[10px] text-[hsl(var(--marketing-navy)/0.4)] mb-4">depending on users</p>
              <p className="text-xs text-[hsl(var(--marketing-navy)/0.6)] italic leading-relaxed"
                style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
              >
                CROS™ replaces fragmented tools with Narrative Relationship Intelligence™ — keeping human context at the center.
              </p>
            </div>
          </div>
        </section>

        {/* Old Stack vs CROS Comparison Table */}
        <PricingComparisonTable />

        {/* Savings Calculator */}
        <CostSavingsCalculator />

        {/* Works Anywhere callout */}
        <section className="mt-16 max-w-xl mx-auto">
          <div className="bg-[hsl(var(--marketing-surface))] rounded-2xl border border-[hsl(var(--marketing-border))] p-6 sm:p-8 text-center">
            <h3
              className="text-lg font-semibold text-[hsl(var(--marketing-navy))] mb-3"
              style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
            >
              Works anywhere your work happens.
            </h3>
            <p className="text-sm text-[hsl(var(--marketing-navy)/0.55)] leading-relaxed mb-5 max-w-md mx-auto">
              CROS™ is mobile-friendly by design. Open it in a browser on any device — and if you like, add it to your home screen for a fast, app-like feel.
            </p>
            <ul className="space-y-2 text-sm text-[hsl(var(--marketing-navy)/0.6)] max-w-xs mx-auto">
              <li className="flex items-center gap-2"><Smartphone className="h-4 w-4 text-[hsl(var(--marketing-blue))] shrink-0" /> Phone-ready for visits and events</li>
              <li className="flex items-center gap-2"><Tablet className="h-4 w-4 text-[hsl(var(--marketing-blue))] shrink-0" /> Tablet-friendly for meetings</li>
              <li className="flex items-center gap-2"><Laptop className="h-4 w-4 text-[hsl(var(--marketing-blue))] shrink-0" /> Full power on desktop for planning</li>
            </ul>
          </div>
        </section>

        {/* Closing Message */}
        <section className="mt-16 max-w-2xl mx-auto text-center">
          <div className="space-y-4" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>
            <p className="text-lg text-[hsl(var(--marketing-navy)/0.75)] leading-relaxed">
              The biggest savings isn't money.
            </p>
            <p className="text-2xl font-bold text-[hsl(var(--marketing-navy))]">
              It's attention.
            </p>
            <p className="text-sm text-[hsl(var(--marketing-navy)/0.55)] leading-relaxed max-w-lg mx-auto">
              Every extra system creates another login, another training session, another place where the story gets lost.
            </p>
            <p className="text-sm text-[hsl(var(--marketing-navy)/0.65)] leading-relaxed max-w-lg mx-auto font-medium">
              CROS™ keeps the relationship alive — and lets technology serve the human work instead of replacing it.
            </p>
          </div>
        </section>

        {/* Shared Intelligence Capacity */}
        <div className="mt-16 max-w-xl mx-auto bg-[hsl(var(--marketing-blue)/0.04)] rounded-2xl p-8 border border-[hsl(var(--marketing-blue)/0.15)]">
          <h3
            className="text-lg font-semibold text-[hsl(var(--marketing-navy))] mb-3"
            style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
          >
            Shared Intelligence Capacity
          </h3>
          <p className="text-sm text-[hsl(var(--marketing-navy)/0.6)] leading-relaxed mb-6">
            CROS plans include a shared intelligence capacity designed to grow with your community.
            There are no surprise AI overages — just gentle safeguards that help intelligence remain
            a tool for discernment rather than pressure.
          </p>
          <div className="border-t border-[hsl(var(--marketing-border))] pt-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--marketing-navy)/0.4)] mb-2">
              Common question
            </p>
            <p className="text-sm font-medium text-[hsl(var(--marketing-navy))] mb-1">
              Will we be charged extra for AI?
            </p>
            <p className="text-sm text-[hsl(var(--marketing-navy)/0.55)] leading-relaxed">
              No. Each plan includes shared intelligence capacity.
              If your community grows, your capacity grows with it.
            </p>
          </div>
        </div>

        {/* Communio coming soon */}
        <div className="mt-16 max-w-xl mx-auto text-center bg-[hsl(var(--marketing-surface))] rounded-2xl p-8 border border-[hsl(var(--marketing-border))]">
          <Sparkles className="h-6 w-6 text-[hsl(var(--marketing-blue))] mx-auto mb-3" />
          <h3 className="font-semibold text-[hsl(var(--marketing-navy))] mb-2">Communio — Shared Narrative</h3>
          <p className="text-sm text-[hsl(var(--marketing-navy)/0.5)] mb-4">
            The opt-in community network. Connect your CROS workspace with neighboring organizations for shared awareness — without sharing data.
          </p>
          <Link to="/communio-feature" className="text-sm text-[hsl(var(--marketing-blue))] hover:underline font-medium">
            Learn more <ArrowRight className="inline h-3 w-3 ml-1" />
          </Link>
        </div>

        {/* Financial Moments — Simple Payments */}
        <div id="financial-moments-pricing" className="mt-16 max-w-2xl mx-auto">
          <div className="rounded-2xl border border-[hsl(var(--marketing-border))] bg-white p-8 sm:p-10">
            <h3
              className="text-xl font-semibold text-[hsl(var(--marketing-navy))] mb-4"
              style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
            >
              Simple Payments When You Need Them
            </h3>
            <div className="space-y-4 mb-8">
              <p className="text-sm text-[hsl(var(--marketing-navy)/0.6)] leading-relaxed" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>
                Many organizations juggle several tools just to accept payments or send invoices.
              </p>
              <p className="text-sm text-[hsl(var(--marketing-navy)/0.6)] leading-relaxed" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>
                CROS keeps things simple.
              </p>
              <p className="text-sm text-[hsl(var(--marketing-navy)/0.6)] leading-relaxed" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>
                You can accept payments for events, send invoices, or receive generosity through secure Stripe-hosted checkout pages.
              </p>
              <p className="text-sm text-[hsl(var(--marketing-navy)/0.6)] leading-relaxed" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>
                Stripe handles all financial processing and compliance.
                Funds go directly to your account.
              </p>
              <p className="text-sm text-[hsl(var(--marketing-navy)/0.6)] leading-relaxed" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>
                CROS simply takes a small platform fee to support the infrastructure that makes these moments possible.
              </p>
            </div>

            {/* Fee structure */}
            <div className="rounded-xl bg-[hsl(var(--marketing-surface))] border border-[hsl(var(--marketing-border))] p-6 mb-6">
              <div className="space-y-3">
                <div className="flex justify-between items-baseline">
                  <span className="text-sm font-medium text-[hsl(var(--marketing-navy))]">Stripe processing fees</span>
                  <span className="text-sm text-[hsl(var(--marketing-navy)/0.55)]">Standard Stripe rates</span>
                </div>
                <div className="border-t border-[hsl(var(--marketing-border))]" />
                <div className="flex justify-between items-baseline">
                  <span className="text-sm font-medium text-[hsl(var(--marketing-navy))]">CROS platform fee</span>
                  <span className="text-sm text-[hsl(var(--marketing-navy)/0.55)]">1% per transaction</span>
                </div>
              </div>
            </div>

            {/* Example */}
            <div className="rounded-xl border border-[hsl(var(--marketing-navy)/0.08)] bg-[hsl(var(--marketing-navy)/0.02)] p-5 mb-8">
              <p className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--marketing-navy)/0.4)] mb-3">Example</p>
              <p className="text-sm text-[hsl(var(--marketing-navy)/0.6)] mb-3">If someone contributes $100:</p>
              <div className="space-y-1.5 text-sm text-[hsl(var(--marketing-navy)/0.55)]">
                <p>Stripe processing: ~$3.20</p>
                <p>CROS platform support: $1.00</p>
                <div className="border-t border-[hsl(var(--marketing-navy)/0.08)] pt-1.5 mt-1.5">
                  <p className="font-medium text-[hsl(var(--marketing-navy))]">
                    Your organization receives: $95.80
                  </p>
                </div>
              </div>
            </div>

            {/* Positioning */}
            <p
              className="text-sm text-[hsl(var(--marketing-navy)/0.5)] italic leading-relaxed mb-6"
              style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
            >
              CROS is not built to turn relationships into transactions.
              It simply makes it easier for the work to move when money is part of the moment.
            </p>

            {/* CTA */}
            <div className="text-center pt-2">
              <p
                className="text-sm text-[hsl(var(--marketing-navy)/0.6)] mb-4"
                style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
              >
                Continue the work without juggling tools.
              </p>
              <Link to="/onboarding">
                <Button
                  size="lg"
                  className="rounded-full bg-[hsl(var(--marketing-navy))] text-white hover:bg-[hsl(var(--marketing-navy)/0.9)] px-8 h-11 text-sm"
                >
                  Start your CROS community <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Relational Flow Strip */}
        <RelationalFlowStrip />
      </div>

      <SeoInternalLinks
        heading="Explore More"
        links={[
          { label: 'Compare', to: '/compare', description: 'See how CROS differs from legacy CRMs.' },
          { label: 'Archetypes', to: '/archetypes', description: 'Find the archetype that fits your mission.' },
          { label: 'Insights', to: '/insights', description: 'Narrative essays on relationship and technology.' },
        ]}
      />
    </div>
    </TooltipProvider>
  );
}
