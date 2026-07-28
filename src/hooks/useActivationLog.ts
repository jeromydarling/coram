/**
 * useActivationLog — Silent telemetry + timeline data for metro activation.
 *
 * WHAT: Inserts + reads metro_activation_log rows.
 * WHERE: ActivationTimeline, testimonium integration.
 * WHY: Records first movements for narrative and timeline display.
 */

import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { useCallback } from 'react';

export interface ActivationLogEntry {
  id: string;
  tenant_id: string;
  metro_id: string;
  event_type: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export function useActivationLog(metroId: string | null) {
  const { tenant } = useTenant();
  const tenantId = (tenant as any)?.id;

  const { data: entries, isLoading } = useQuery({
    queryKey: ['activation-log', metroId, tenantId],
    queryFn: async () => {
      if (!metroId || !tenantId) return [];
      const { data, error } = await supabase
        .from('metro_activation_log')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('metro_id', metroId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data || []) as ActivationLogEntry[];
    },
    enabled: !!metroId && !!tenantId,
  });

  const logEvent = useCallback(
    async (metroIdParam: string, eventType: string, metadata: Record<string, unknown> = {}) => {
      if (!tenantId) return;
      try {
        const { error } = await supabase
          .from('metro_activation_log')
          .insert([{
            tenant_id: tenantId,
            metro_id: metroIdParam,
            event_type: eventType,
            metadata: metadata as unknown as import('@/integrations/supabase/types').Json,
          }]);
        if (error) console.warn('[ActivationLog] insert failed:', error.message);
      } catch (err) {
        console.warn('[ActivationLog] unexpected error:', err);
      }
    },
    [tenantId],
  );

  return {
    entries: entries || [],
    isLoading,
    logEvent,
  };
}
