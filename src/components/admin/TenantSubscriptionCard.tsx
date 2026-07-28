/**
 * TenantSubscriptionCard — Subscription management for tenant admins.
 *
 * WHAT: Shows current plan, active tiers, available upgrades, and billing management.
 * WHERE: Tenant admin panel (/:slug/admin)
 * WHY: Tenant admins need self-service billing and upgrade control without contacting the operator.
 */
import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useTenant } from '@/contexts/TenantContext';
import { CreditCard, ExternalLink, Loader2, RefreshCw, ArrowUpRight, Plus, Check } from 'lucide-react';
import { format } from 'date-fns';
import { HelpTooltip } from '@/components/ui/help-tooltip';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/sonner';

/** All available tiers with descriptions */
const allTiers = [
  { key: 'core', name: 'CROS Core', description: 'Relationship OS, Civitas, Signum baseline' },
  { key: 'insight', name: 'CROS Insight', description: 'Testimonium, Drift Detection, Story Signals' },
  { key: 'story', name: 'CROS Story', description: 'Impulsus journal, Executive exports, Narrative reporting' },
];

export function TenantSubscriptionCard() {
  const { tenant, subscription, checkSubscription, openCustomerPortal } = useTenant();
  const [isPortalLoading, setIsPortalLoading] = useState(false);
  const [upgradingTier, setUpgradingTier] = useState<string | null>(null);

  const handleManageSubscription = async () => {
    setIsPortalLoading(true);
    try {
      await openCustomerPortal();
    } finally {
      setIsPortalLoading(false);
    }
  };

  const handleUpgrade = async (tierKeys: string[]) => {
    if (!tenant) return;
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
      console.error('Checkout error:', err);
      toast.error('Failed to start checkout. Please try again.');
    } finally {
      setUpgradingTier(null);
    }
  };

  const tierLabel = (tier: string) => {
    const labels: Record<string, string> = {
      core: 'CROS Core',
      insight: 'CROS Insight',
      story: 'CROS Story',
      bridge: 'CROS Bridge (Add-on)',
    };
    return labels[tier] ?? tier;
  };

  const activeTiers = new Set(subscription.tiers);
  const availableUpgrades = allTiers.filter(t => !activeTiers.has(t.key));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          Subscription
          <HelpTooltip content="Manage your CROS subscription plan, billing, and payment method through the Stripe customer portal." />
        </CardTitle>
        <CardDescription>
          Manage your organization's CROS subscription and billing
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status row */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">Status</p>
            {subscription.isChecking ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : subscription.subscribed ? (
              <Badge variant="default" className="bg-primary hover:bg-primary/90">
                Active
              </Badge>
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

        {/* Active tiers */}
        {subscription.subscribed && subscription.tiers.length > 0 && (
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">Active Tiers</p>
            <div className="flex flex-wrap gap-1.5">
              {subscription.tiers.map(tier => (
                <Badge key={tier} variant="outline" className="capitalize">
                  <Check className="h-3 w-3 mr-1" />
                  {tierLabel(tier)}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Period end */}
        {subscription.subscribed && subscription.subscriptionEnd && (
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">Current Period Ends</p>
            <p className="text-sm text-foreground">
              {format(new Date(subscription.subscriptionEnd), 'MMMM d, yyyy')}
            </p>
          </div>
        )}

        {/* Tenant tier from DB */}
        {tenant?.tier && (
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">Organization Tier</p>
            <Badge variant="secondary" className="capitalize">{tenant.tier}</Badge>
          </div>
        )}

        {/* Available Upgrades */}
        {subscription.subscribed && availableUpgrades.length > 0 && (
          <div className="space-y-2 pt-2 border-t">
            <p className="text-sm font-medium text-muted-foreground">Available Upgrades</p>
            <div className="space-y-2">
              {availableUpgrades.map(tier => {
                const isUpgrading = upgradingTier === tier.key;
                // Build the tiers array: current tiers + the new one
                const upgradeTiers = [...subscription.tiers, tier.key];
                return (
                  <div
                    key={tier.key}
                    className="flex items-center justify-between p-3 rounded-lg border bg-muted/30"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{tier.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{tier.description}</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="shrink-0 ml-3"
                      disabled={isUpgrading || !!upgradingTier}
                      onClick={() => handleUpgrade(upgradeTiers)}
                    >
                      {isUpgrading ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <>
                          <Plus className="h-3 w-3 mr-1" />
                          Add
                        </>
                      )}
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col gap-2 pt-2">
          {subscription.subscribed && (
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
              Manage Subscription
            </Button>
          )}

          {!subscription.subscribed && !subscription.isChecking && (
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
        </div>
      </CardContent>
    </Card>
  );
}
