/**
 * OperatorOverridesPage — Global Feature Overrides (kill switches).
 *
 * WHAT: Toggle platform-wide feature flags that override tenant settings.
 * WHERE: /operator/overrides
 * WHY: Operator override ALWAYS wins — safety kill switches for campaigns, migrations, etc.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { HelpCircle, ShieldAlert, Loader2 } from 'lucide-react';
import { toast } from '@/components/ui/sonner';

const FEATURE_LABELS: Record<string, { label: string; description: string }> = {
  campaigns: { label: 'Email Campaigns', description: 'Controls all campaign sending across tenants' },
  migrations: { label: 'CRM Migrations', description: 'Controls import/migration flows' },
  communio_sharing: { label: 'Communio Sharing', description: 'Controls cross-tenant signal sharing' },
  ai_suggestions: { label: 'AI Suggestions', description: 'Controls AI-powered recommendations' },
};

export default function OperatorOverridesPage() {
  const queryClient = useQueryClient();

  const { data: overrides, isLoading } = useQuery({
    queryKey: ['operator-feature-overrides'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('operator_feature_overrides')
        .select('*')
        .order('feature_key');
      if (error) throw error;
      return data ?? [];
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ featureKey, enabled }: { featureKey: string; enabled: boolean }) => {
      const { error } = await supabase
        .from('operator_feature_overrides')
        .update({ enabled, set_at: new Date().toISOString() })
        .eq('feature_key', featureKey);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['operator-feature-overrides'] });
      toast.success(`${vars.featureKey} ${vars.enabled ? 'enabled' : 'disabled'}`);
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-2">
        <ShieldAlert className="h-5 w-5 text-primary" />
        <div>
          <h1 className="text-xl font-semibold text-foreground">Global Overrides</h1>
          <p className="text-sm text-muted-foreground">Platform-wide kill switches. These override all tenant settings.</p>
        </div>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger><HelpCircle className="h-4 w-4 text-muted-foreground" /></TooltipTrigger>
            <TooltipContent className="max-w-xs text-xs space-y-1">
              <p><strong>What:</strong> Master toggles that override tenant-level feature flags.</p>
              <p><strong>Where:</strong> Operator → Global Overrides.</p>
              <p><strong>Why:</strong> Emergency control without touching individual tenant configs.</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {overrides?.map((o) => {
            const config = FEATURE_LABELS[o.feature_key] || {
              label: o.feature_key.replace(/_/g, ' '),
              description: o.reason || '',
            };
            return (
              <Card key={o.feature_key}>
                <CardContent className="py-4 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground capitalize">{config.label}</p>
                    <p className="text-xs text-muted-foreground">{config.description}</p>
                    {!o.enabled && (
                      <Badge variant="destructive" className="mt-1 text-[10px]">DISABLED</Badge>
                    )}
                  </div>
                  <Switch
                    checked={o.enabled}
                    disabled={toggleMutation.isPending}
                    onCheckedChange={(checked) =>
                      toggleMutation.mutate({ featureKey: o.feature_key, enabled: checked })
                    }
                  />
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
