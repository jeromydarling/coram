/**
 * useTenantSectors — Hooks for tenant sector tag management.
 *
 * WHAT: Fetches and manages sector assignments for a tenant.
 * WHERE: Onboarding wizard, Settings, Movement Intelligence filter, NRI context.
 * WHY: Sector tags enrich discovery relevance and narrative context without altering core logic.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { toast } from '@/components/ui/sonner';
import type { Database } from '@/integrations/supabase/types';

/** Fully typed Sector row from the generated schema. */
export type Sector = Database['public']['Tables']['sectors']['Row'];

/** Fully typed TenantSector row, with optional joined sector. */
export type TenantSector = Database['public']['Tables']['tenant_sectors']['Row'] & {
  sector?: Sector;
};

/** Fetch all active sectors from the catalog. */
export function useSectorCatalog() {
  return useQuery({
    queryKey: ['sector-catalog'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sectors')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return (data ?? []) as Sector[];
    },
  });
}

/** Fetch sector assignments for the current tenant. */
export function useTenantSectors() {
  const { tenantId } = useTenant();

  return useQuery({
    queryKey: ['tenant-sectors', tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tenant_sectors')
        .select('*, sectors(*)')
        .eq('tenant_id', tenantId!);
      if (error) throw error;
      return (data ?? []).map((row) => ({
        ...row,
        sector: row.sectors as unknown as Sector,
      })) as TenantSector[];
    },
  });
}

/** Sector names for the current tenant (convenience). */
export function useTenantSectorNames() {
  const { data: ts } = useTenantSectors();
  return (ts ?? []).map((t) => t.sector?.name).filter(Boolean) as string[];
}

/** Replace all tenant sector assignments at once (max 5, atomic via RPC). */
export function useSetTenantSectors() {
  const { tenantId } = useTenant();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (sectorIds: string[]) => {
      if (!tenantId) throw new Error('No tenant');
      if (sectorIds.length > 5) throw new Error('Maximum 5 sectors allowed');

      const { error } = await supabase.rpc('replace_tenant_sectors', {
        p_tenant_id: tenantId,
        p_sector_ids: sectorIds,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tenant-sectors', tenantId] });
      toast.success('Sectors updated');
    },
    onError: (e) => toast.error(`Failed to update sectors: ${e.message}`),
  });
}
