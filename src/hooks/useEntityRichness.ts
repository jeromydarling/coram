/**
 * useEntityRichness — Returns effective richness for a specific entity.
 *
 * WHAT: Checks entity_richness_overrides first, falls back to tenant default.
 * WHERE: EntityDetailLayout, PersonDetail, OpportunityDetail.
 * WHY: Per-entity opt-in to richer views without changing tenant-wide settings.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { useRelationalOrientation } from './useRelationalOrientation';
import { toast } from '@/components/ui/sonner';

export function useEntityRichness(entityType: 'person' | 'partner', entityId: string | undefined) {
  const { tenantId } = useTenant();
  const { peopleRichness, partnerRichness } = useRelationalOrientation();
  const queryClient = useQueryClient();
  const queryKey = ['entity-richness-override', tenantId, entityType, entityId];

  const defaultRichness = entityType === 'person' ? peopleRichness : partnerRichness;

  const { data: override, isLoading } = useQuery({
    queryKey,
    enabled: !!tenantId && !!entityId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('entity_richness_overrides')
        .select('richness_level')
        .eq('tenant_id', tenantId!)
        .eq('entity_type', entityType)
        .eq('entity_id', entityId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const setOverrideMutation = useMutation({
    mutationFn: async (richness: number) => {
      if (!tenantId || !entityId) throw new Error('Missing context');
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('entity_richness_overrides')
        .upsert({
          tenant_id: tenantId,
          entity_type: entityType,
          entity_id: entityId,
          richness_level: richness,
          created_by: user?.id ?? null,
          updated_at: new Date().toISOString(),
        } as any, { onConflict: 'tenant_id,entity_type,entity_id' });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success('View updated');
    },
    onError: () => toast.error('Could not update view'),
  });

  const clearOverrideMutation = useMutation({
    mutationFn: async () => {
      if (!tenantId || !entityId) throw new Error('Missing context');
      const { error } = await supabase
        .from('entity_richness_overrides')
        .delete()
        .eq('tenant_id', tenantId)
        .eq('entity_type', entityType)
        .eq('entity_id', entityId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success('Reset to tenant default');
    },
    onError: () => toast.error('Could not reset view'),
  });

  return {
    effectiveRichness: override?.richness_level ?? defaultRichness,
    hasOverride: !!override,
    isLoading,
    setOverride: setOverrideMutation.mutateAsync,
    isSettingOverride: setOverrideMutation.isPending,
    clearOverride: clearOverrideMutation.mutateAsync,
    isClearingOverride: clearOverrideMutation.isPending,
  };
}
