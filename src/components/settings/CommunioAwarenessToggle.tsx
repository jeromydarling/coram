/**
 * CommunioAwarenessToggle — Opt-in/out control for network learnings.
 *
 * WHAT: Toggle to enable/disable communio awareness signals for the tenant.
 * WHERE: Settings page, Communio section.
 * WHY: Privacy-first — tenants choose whether to receive gentle network learnings.
 */
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Users } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { toast } from '@/components/ui/sonner';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { HelpCircle } from 'lucide-react';

export function CommunioAwarenessToggle() {
  const { t } = useTranslation('settings');
  const { tenantId } = useTenant();
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ['tenant-communio-awareness', tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tenant_settings')
        .select('communio_awareness_enabled')
        .eq('tenant_id', tenantId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const toggle = useMutation({
    mutationFn: async (enabled: boolean) => {
      const { error } = await supabase
        .from('tenant_settings')
        .update({ communio_awareness_enabled: enabled })
        .eq('tenant_id', tenantId!);
      if (error) throw error;
    },
    onSuccess: (_, enabled) => {
      queryClient.invalidateQueries({ queryKey: ['tenant-communio-awareness'] });
      queryClient.invalidateQueries({ queryKey: ['communio-awareness'] });
      toast.success(enabled ? t('communio.enabled') : t('communio.paused'));
    },
  });

  const isEnabled = settings?.communio_awareness_enabled ?? true;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          <CardTitle>{t('communio.title')}</CardTitle>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <HelpCircle className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs text-xs">
                <p><strong>What:</strong> {t('communio.tooltipWhat')}</p>
                <p><strong>Where:</strong> {t('communio.tooltipWhere')}</p>
                <p><strong>Why:</strong> {t('communio.tooltipWhy')}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <CardDescription>
          {t('communio.description')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="communio-awareness">{t('communio.label')}</Label>
            <p className="text-xs text-muted-foreground">
              {t('communio.privacy')}
            </p>
          </div>
          <Switch
            id="communio-awareness"
            checked={isEnabled}
            onCheckedChange={(checked) => toggle.mutate(checked)}
            disabled={isLoading || toggle.isPending}
          />
        </div>
      </CardContent>
    </Card>
  );
}
