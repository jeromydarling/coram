/**
 * SubscriptionSettingsCard — Full billing overview with upgrade/downgrade.
 *
 * WHAT: Shows current plan, active tiers, upgrade options, billing period, and Stripe portal access.
 * WHERE: Settings → Billing tab.
 * WHY: Tenants need self-service billing and plan management without leaving their workspace.
 */

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useTenant } from '@/contexts/TenantContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/sonner';
import { CreditCard, ExternalLink, Loader2, RefreshCw, Check, Plus, ArrowUpRight, Sparkles } from 'lucide-react';
import { format } from 'date-fns';
import { HelpTooltip } from '@/components/ui/help-tooltip';
import { pricing, MONTHLY_PRICES } from '@/content/pricing';

/** All available plan tiers with descriptions and pricing */
const allTiers = [
  {
    key: 'core',
    name: 'CROS Core',
    description: 'Relationship OS, Signum baseline, Voluntārium, events, and basic narrative.',
    price: MONTHLY_PRICES.core,
    color: 'hsl(var(--primary))',
  },
  {
    key: 'insight',
    name: 'CROS Insight',
    description: 'Testimonium, Drift Detection, Momentum Map Overlays, and Story Signals.',
    price: MONTHLY_PRICES.insight,
    additive: true,
  },
  {
    key: 'story',
    name: 'CROS Story',
    description: 'Impulsus journal, executive exports, and narrative reporting.',
    price: MONTHLY_PRICES.story,
    additive: true,
  },
];

const tierLabels: Record<string, string> = {
  core: 'CROS Core',
  insight: 'CROS Insight',
  story: 'CROS Story',
  bridge: 'CROS Bridge™',
};

export function SubscriptionSettingsCard() {
  const { tenant, subscription, checkSubscription, openCustomerPortal } = useTenant();
  const [isPortalLoading, setIsPortalLoading] = useState(false);
  const [upgradingTier, setUpgradingTier] = useState<string | null>(null);

  const isOperatorGranted = (tenant as any)?.billing_mode === 'operator_granted' || (tenant as any)?.is_operator_granted;
  const activeTiers = new Set(subscription.tiers);
  const availableUpgrades = allTiers.filter(t => !activeTiers.has(t.key));

  const handleManageSubscription = async () => {
    setIsPortalLoading(true);
    try {
      await openCustomerPortal();
    } finally {
      setIsPortalLoading(false);
    }
  };

  const handleUpgrade = async (tierKeys: string[]) => {
    const targetKey = tierKeys[tierKeys.length - 1];
    setUpgradingTier(targetKey);
    try {
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: { tiers: tierKeys },
      });
      if (error) throw error;
      if (data?.url) {
        window.open(data.url, '_blank');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Checkout failed';
      toast.error(msg);
    } finally {
      setUpgradingTier(null);
    }
  };

  /** Monthly total from active tiers */
  const monthlyTotal = Array.from(activeTiers).reduce((sum, t) => {
    return sum + (MONTHLY_PRICES[t] ?? 0);
  }, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          Plan & Billing
          <HelpTooltip content="View your current CROS plan, upgrade or add tiers, and manage billing through the customer portal." />
        </CardTitle>
        <CardDescription>
          Your organization's subscription and plan details
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Status + Refresh */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Status</p>
            {subscription.isChecking ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : subscription.subscribed || isOperatorGranted ? (
              <div className="flex items-center gap-2">
                <Badge variant="default" className="bg-primary hover:bg-primary/90">
                  Active
                </Badge>
                {isOperatorGranted && (
                  <Badge variant="outline" className="text-xs">
                    <Sparkles className="h-3 w-3 mr-1" />
                    Community Grant
                  </Badge>
                )}
              </div>
            ) : (
              <Badge variant="secondary">No active subscription</Badge>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={checkSubscription}
            disabled={subscription.isChecking}
            title="Refresh subscription status"
          >
            <RefreshCw className={`h-4 w-4 ${subscription.isChecking ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        {/* Active Tiers */}
        {(subscription.subscribed || isOperatorGranted) && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Active Plan</p>
            <div className="space-y-2">
              {allTiers.map(tier => {
                const isActive = activeTiers.has(tier.key) || (isOperatorGranted && tier.key === (tenant?.tier ?? 'core'));
                if (!isActive) return null;
                return (
                  <div
                    key={tier.key}
                    className="flex items-center gap-3 p-3 rounded-xl border border-primary/20 bg-primary/5"
                  >
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-primary/10 text-primary">
                      <Check className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold">{tier.name}</p>
                      <p className="text-xs text-muted-foreground">{tier.description}</p>
                    </div>
                    <span className="text-sm font-medium text-muted-foreground shrink-0">
                      {tier.additive ? '+' : ''}${tier.price}/mo
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Monthly total */}
            {monthlyTotal > 0 && !isOperatorGranted && (
              <div className="flex justify-between items-center pt-1 px-1">
                <span className="text-xs text-muted-foreground">Monthly total</span>
                <span className="text-sm font-semibold">${monthlyTotal}/mo</span>
              </div>
            )}
          </div>
        )}

        {/* Period end */}
        {subscription.subscribed && subscription.subscriptionEnd && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Current Period Ends</p>
            <p className="text-sm text-foreground">
              {format(new Date(subscription.subscriptionEnd), 'MMMM d, yyyy')}
            </p>
          </div>
        )}

        {/* Available Upgrades */}
        {(subscription.subscribed || isOperatorGranted) && availableUpgrades.length > 0 && !isOperatorGranted && (
          <div className="space-y-2 pt-3 border-t">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Available Upgrades</p>
            <div className="space-y-2">
              {availableUpgrades.map(tier => {
                const isUpgrading = upgradingTier === tier.key;
                const upgradeTiers = [...subscription.tiers, tier.key];
                return (
                  <div
                    key={tier.key}
                    className="flex items-center gap-3 p-3 rounded-xl border bg-muted/30 hover:bg-muted/50 transition-colors"
                  >
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-muted text-muted-foreground">
                      <Plus className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{tier.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{tier.description}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs font-medium text-muted-foreground">+${tier.price}/mo</span>
                      <Button
                        variant="default"
                        size="sm"
                        className="rounded-full text-xs h-8"
                        disabled={isUpgrading || !!upgradingTier}
                        onClick={() => handleUpgrade(upgradeTiers)}
                      >
                        {isUpgrading ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <>Add</>
                        )}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col gap-2 pt-2">
          {subscription.subscribed && !isOperatorGranted && (
            <Button
              variant="outline"
              onClick={handleManageSubscription}
              disabled={isPortalLoading}
              className="w-full"
            >
              {isPortalLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ExternalLink className="mr-2 h-4 w-4" />
              )}
              Manage Billing & Payment
            </Button>
          )}

          {!subscription.subscribed && !subscription.isChecking && !isOperatorGranted && (
            <Button
              onClick={() => handleUpgrade(['core'])}
              disabled={!!upgradingTier}
              className="w-full"
            >
              {upgradingTier ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ArrowUpRight className="mr-2 h-4 w-4" />
              )}
              Subscribe to CROS
            </Button>
          )}

          {isOperatorGranted && (
            <p className="text-xs text-muted-foreground text-center">
              Your organization has been granted access by the CROS team. To upgrade or add capabilities, please reach out to your community steward.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}