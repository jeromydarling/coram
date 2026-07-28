/**
 * useCommunioAwareness — Fetches ambient awareness signals for tenants.
 *
 * WHAT: Queries communio_awareness_signals visible to the current tenant.
 * WHERE: Used by CommunioAwarenessCard on Dashboard, Visits, Opportunities.
 * WHY: Gentle cross-tenant learnings without exposing identities.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';

interface AwarenessSignal {
  id: string;
  source_signal_type: string;
  anonymized_message: string;
  suggested_action: string;
  role_scope: string;
  is_hipaa_safe: boolean;
  created_at: string;
}

export function useCommunioAwareness(limit = 3) {
  const { tenantId } = useTenant();

  return useQuery({
    queryKey: ['communio-awareness', tenantId, limit],
    enabled: !!tenantId,
    queryFn: async () => {
      // Check if tenant has awareness enabled
      const { data: settings } = await supabase
        .from('tenant_settings')
        .select('communio_awareness_enabled, compliance_posture')
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (settings?.communio_awareness_enabled === false) return [];

      const isHipaa = settings?.compliance_posture === 'hipaa_sensitive';

      let q = supabase
        .from('communio_awareness_signals')
        .select('id, source_signal_type, anonymized_message, suggested_action, role_scope, is_hipaa_safe, created_at')
        .in('visibility', ['tenant', 'both'])
        .order('created_at', { ascending: false })
        .limit(limit);

      // HIPAA tenants only see hipaa-safe signals
      if (isHipaa) {
        q = q.eq('is_hipaa_safe', true);
      }

      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as AwarenessSignal[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useDismissAwareness() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (signalId: string) => {
      // We don't delete — just remove from the local cache
      // Awareness signals are ambient and auto-expire weekly
      return signalId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['communio-awareness'] });
    },
  });
}
