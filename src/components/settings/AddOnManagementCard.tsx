/**
 * AddOnManagementCard — In-app add-on toggle cards for tenant billing.
 *
 * WHAT: Displays purchasable add-ons with toggle actions that call manage-addons edge function.
 * WHERE: Settings → Subscription section.
 * WHY: Tenants need to add/remove add-ons without leaving the app.
 */

import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { HelpCircle, Loader2, Plus, X, Link2, Users, Globe, Mail, MapPin } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from '@/components/ui/sonner';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { useEntitlements } from '@/hooks/useEntitlements';
import { useQueryClient } from '@tanstack/react-query';

interface AddonConfig {
  key: string;
  name: string;
  description: string;
  price: string;
  icon: React.ReactNode;
}

const addons: AddonConfig[] = [
  { key: 'bridge', name: 'CROS Bridge™', description: 'Integration bridges, CRM sync, and migration tools.', price: '$49/mo', icon: <Link2 className="h-4 w-4" /> },
  { key: 'campaigns', name: 'Relatio Campaigns™', description: 'Relationship-first email outreach via Gmail.', price: '$29/mo', icon: <Mail className="h-4 w-4" /> },
  { key: 'expanded_local_pulse', name: 'Expanded Local Pulse', description: 'Daily crawls and higher article caps.', price: '$25/mo', icon: <Globe className="h-4 w-4" /> },
  { key: 'expansion_capacity', name: 'Expansion Capacity', description: 'Additional metro activation for growing regions.', price: '$19/metro/mo', icon: <MapPin className="h-4 w-4" /> },
  { key: 'additional_users', name: 'Additional Users', description: 'Add more active team members beyond your plan.', price: '$29/block/mo', icon: <Users className="h-4 w-4" /> },
];

/** Maps addon keys to entitlement fields to detect active state */
function isAddonActive(key: string, entitlements: ReturnType<typeof useEntitlements>['entitlements']): boolean {
  switch (key) {
    case 'campaigns': return entitlements.campaigns_enabled;
    case 'expanded_ai': return entitlements.ai_tier === 'expanded';
    case 'expanded_local_pulse': return entitlements.local_pulse_tier === 'expanded';
    case 'advanced_nri': return entitlements.nri_tier === 'advanced';
    default: return false; // bridge, expansion_capacity, additional_users — can't detect from entitlements alone
  }
}

export function AddOnManagementCard() {
  const { t } = useTranslation('settings');
  const { subscription } = useTenant();
  const { entitlements } = useEntitlements();
  const queryClient = useQueryClient();
  const [loadingKey, setLoadingKey] = useState<string | null>(null);

  const handleToggle = useCallback(async (key: string, isActive: boolean) => {
    setLoadingKey(key);
    try {
      const { data, error } = await supabase.functions.invoke('manage-addons', {
        body: {
          action: isActive ? 'remove' : 'add',
          addon_key: key,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const addonName = addons.find(a => a.key === key)?.name ?? key;
      toast.success(
        isActive
          ? t('addons.removed', { name: addonName })
          : t('addons.added', { name: addonName })
      );

      // Refresh entitlements + subscription
      queryClient.invalidateQueries({ queryKey: ['tenant-entitlements'] });
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('addons.failedUpdate');
      toast.error(msg);
    } finally {
      setLoadingKey(null);
    }
  }, [queryClient]);

  if (!subscription.subscribed) return null;

  return (
    <TooltipProvider delayDuration={200}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Plus className="h-5 w-5" />
            {t('addons.title')}
            <Tooltip>
              <TooltipTrigger><HelpCircle className="h-4 w-4 text-muted-foreground" /></TooltipTrigger>
              <TooltipContent className="max-w-xs text-xs">
                <p><strong>What:</strong> {t('addons.tooltipWhat')}</p>
                <p><strong>Where:</strong> {t('addons.tooltipWhere')}</p>
                <p><strong>Why:</strong> {t('addons.tooltipWhy')}</p>
              </TooltipContent>
            </Tooltip>
          </CardTitle>
          <CardDescription>
            {t('addons.description')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {addons.map((addon) => {
              const isActive = isAddonActive(addon.key, entitlements);
              const isLoading = loadingKey === addon.key;

              return (
                <div
                  key={addon.key}
                  className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                    isActive
                      ? 'border-primary/20 bg-primary/5'
                      : 'border-border'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                    isActive ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                  }`}>
                    {addon.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{addon.name}</span>
                      {isActive && <Badge variant="default" className="text-[10px] h-5">{t('addons.active')}</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{addon.description}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs font-medium text-muted-foreground">{addon.price}</span>
                    <Button
                      variant={isActive ? 'outline' : 'default'}
                      size="sm"
                      className="rounded-full text-xs h-8"
                      disabled={isLoading}
                      onClick={() => handleToggle(addon.key, isActive)}
                    >
                      {isLoading ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : isActive ? (
                        <>{t('addons.remove')} <X className="ml-1 h-3 w-3" /></>
                      ) : (
                        <>{t('addons.add')} <Plus className="ml-1 h-3 w-3" /></>
                      )}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}