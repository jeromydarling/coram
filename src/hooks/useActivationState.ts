/**
 * useActivationState — Manages metro activation lifecycle.
 *
 * WHAT: CRUD for metro_activation_states + auto-progression logic.
 * WHERE: ActivationPanel, metro detail page, expansion canvas.
 * WHY: Tracks gentle progression from considering → community_entry.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';

export type ActivationStage =
  | 'considering'
  | 'scouting'
  | 'first_presence'
  | 'early_relationships'
  | 'community_entry';

const STAGE_ORDER: ActivationStage[] = [
  'considering',
  'scouting',
  'first_presence',
  'early_relationships',
  'community_entry',
];

export interface ActivationState {
  id: string;
  tenant_id: string;
  metro_id: string;
  activation_stage: ActivationStage;
  activated_at: string | null;
  last_activity_at: string | null;
  created_at: string;
  updated_at: string;
}

export function useActivationState(metroId: string | null) {
  const { user } = useAuth();
  const { tenant } = useTenant();
  const tenantId = (tenant as any)?.id;
  const queryClient = useQueryClient();

  const queryKey = ['activation-state', metroId, tenantId];

  const { data: state, isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!metroId || !tenantId) return null;
      const { data, error } = await supabase
        .from('metro_activation_states')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('metro_id', metroId)
        .maybeSingle();
      if (error) throw error;
      return data as ActivationState | null;
    },
    enabled: !!metroId && !!tenantId,
  });

  const upsertState = useMutation({
    mutationFn: async (stage: ActivationStage) => {
      if (!metroId || !tenantId || !user?.id) return;
      const row = {
        tenant_id: tenantId,
        metro_id: metroId,
        activation_stage: stage,
        last_activity_at: new Date().toISOString(),
        created_by: user.id,
        ...(stage === 'community_entry' ? { activated_at: new Date().toISOString() } : {}),
      };
      const { error } = await supabase
        .from('metro_activation_states')
        .upsert(row, { onConflict: 'tenant_id,metro_id' });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const advanceStage = useMutation({
    mutationFn: async () => {
      if (!state) return;
      const currentIdx = STAGE_ORDER.indexOf(state.activation_stage);
      if (currentIdx >= 3) return;
      const nextStage = STAGE_ORDER[currentIdx + 1];
      await upsertState.mutateAsync(nextStage);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  return {
    state,
    isLoading,
    upsertState,
    advanceStage,
    stageOrder: STAGE_ORDER,
  };
}
