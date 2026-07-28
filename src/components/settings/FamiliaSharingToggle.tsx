/**
 * FamiliaSharingToggle — Opt-in toggle for sharing aggregated stewardship signals with Familia.
 *
 * WHAT: Toggle to enable/disable familia_sharing_enabled on tenant_provision_settings.
 * WHERE: Settings page, appears when tenant belongs to a Familia.
 * WHY: Privacy-first — tenants choose whether aggregated care patterns are shared.
 */

import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Users } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { useFamiliaStatus } from '@/hooks/useFamilia';
import { toast } from '@/components/ui/sonner';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { HelpCircle } from 'lucide-react';

export function FamiliaSharingToggle() {
  const { t } = useTranslation('settings');
  const { tenantId } = useTenant();
  const { data: familiaStatus } = useFamiliaStatus();
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ['provision-familia-sharing', tenantId],
    enabled: !!tenantId && !!familiaStatus?.isInFamilia,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tenant_provision_settings')
        .select('familia_sharing_enabled')
        .eq('tenant_id', tenantId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const toggle = useMutation({
    mutationFn: async (enabled: boolean) => {
      const { error } = await supabase
        .from('tenant_provision_settings')
        .upsert({ tenant_id: tenantId, familia_sharing_enabled: enabled } as any, { onConflict: 'tenant_id' });
      if (error) throw error;
    },
    onSuccess: (_, enabled) => {
      queryClient.invalidateQueries({ queryKey: ['provision-familia-sharing'] });
      toast.success(enabled ? t('familiaSharing.enabled') : t('familiaSharing.paused'));
    },
  });

  // Only show when tenant is in a Familia
  if (!familiaStatus?.isInFamilia) return null;

  const isEnabled = settings?.familia_sharing_enabled ?? false;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          <CardTitle className="text-base">Walking Together</CardTitle>
          <Tooltip>
            <TooltipTrigger asChild>
              <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
            </TooltipTrigger>
            <TooltipContent side="right" className="max-w-xs text-xs space-y-1">
              <p><strong>What:</strong> Share anonymized care patterns with your Familia.</p>
              <p><strong>Where:</strong> Aggregated signals visible to Familia members only.</p>
              <p><strong>Why:</strong> Helps your wider community notice emerging needs — individual details are never shared.</p>
            </TooltipContent>
          </Tooltip>
        </div>
        <CardDescription>
          Share aggregated stewardship signals with your Familia
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="familia-sharing">Share aggregated patterns</Label>
            <p className="text-xs text-muted-foreground">
              This helps your wider community notice emerging needs. Individual details are never shared.
            </p>
          </div>
          <Switch
            id="familia-sharing"
            checked={isEnabled}
            onCheckedChange={(checked) => toggle.mutate(checked)}
            disabled={isLoading || toggle.isPending}
          />
        </div>
      </CardContent>
    </Card>
  );
}
