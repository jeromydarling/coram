/**
 * useProvisionMode — Resolves the tenant's Prōvīsiō mode and visibility rules.
 *
 * WHAT: Fetches tenant_provision_settings and determines whether the standalone
 *       Prōvīsiō workspace should appear in navigation.
 * WHERE: Consumed by Sidebar, Settings, and provision-related components.
 * WHY: Prōvīsiō begins embedded; standalone surfaces only when the tenant's
 *      usage outgrows simple care tracking.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { useToast } from '@/hooks/use-toast';
import { useDemoMode } from '@/contexts/DemoModeContext';

export type ProvisionMode = 'care' | 'stewardship' | 'enterprise';

export interface ProvisionSettings {
  tenant_id: string;
  mode: ProvisionMode;
  catalog_enabled: boolean;
  pricing_enabled: boolean;
}

const DEFAULT_SETTINGS: Omit<ProvisionSettings, 'tenant_id'> = {
  mode: 'care',
  catalog_enabled: false,
  pricing_enabled: false,
};

/** Map archetypes to default provision modes. */
function archetypeDefaultMode(archetype: string | null | undefined): ProvisionMode {
  if (!archetype) return 'care';
  const key = archetype.toLowerCase();
  if (key.includes('social_enterprise') || key === 'social_enterprise') return 'enterprise';
  if (key.includes('workforce') || key.includes('housing') || key.includes('nonprofit')) return 'stewardship';
  return 'care';
}

export function useProvisionMode() {
  const { tenant, tenantId } = useTenant();
  const { isDemoMode } = useDemoMode();

  const { data: settings, isLoading } = useQuery({
    queryKey: ['provision-settings', tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tenant_provision_settings' as any)
        .select('*')
        .eq('tenant_id', tenantId!)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as ProvisionSettings | null;
    },
  });

  const resolved: Omit<ProvisionSettings, 'tenant_id'> = settings
    ? { mode: settings.mode, catalog_enabled: settings.catalog_enabled, pricing_enabled: settings.pricing_enabled }
    : { ...DEFAULT_SETTINGS, mode: archetypeDefaultMode(tenant?.archetype) };

  // Standalone visibility: shown when mode != care, catalog enabled, pricing used,
  // OR in demo mode (BT-010: always show Provisions in demo for feature exploration)
  const showStandalone = isDemoMode || resolved.mode !== 'care' || resolved.catalog_enabled || resolved.pricing_enabled;

  return {
    ...resolved,
    showStandalone,
    isLoading,
    isConfigured: !!settings,
  };
}

export function useProvisionSettingsMutation() {
  const { tenantId } = useTenant();
  const { toast } = useToast();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (updates: Partial<Omit<ProvisionSettings, 'tenant_id'>>) => {
      if (!tenantId) throw new Error('No tenant');
      const { error } = await supabase
        .from('tenant_provision_settings' as any)
        .upsert({ tenant_id: tenantId, ...updates } as any, { onConflict: 'tenant_id' });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['provision-settings'] });
      toast({ title: 'Saved', description: 'Shared resources settings updated.' });
    },
    onError: (err: any) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });
}
