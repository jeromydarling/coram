/**
 * useEnableMetroIntelligence — Mutation to toggle Metro Intelligence on for the current tenant.
 *
 * WHAT: Sets civitas_enabled = true on the tenant record.
 * WHERE: Discovery cards, MetroIntelligenceGate, settings.
 * WHY: Progressive reveal — tenants opt in when ready to grow.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { toast } from '@/components/ui/sonner';

export function useEnableMetroIntelligence() {
  const { tenantId, refreshFlags } = useTenant();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!tenantId) throw new Error('No tenant');
      const { error } = await supabase
        .from('tenants')
        .update({ civitas_enabled: true } as any)
        .eq('id', tenantId);
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success('Metro Intelligence enabled — welcome to multi-region awareness.');
      await refreshFlags();
      qc.invalidateQueries({ queryKey: ['tenant'] });
    },
    onError: () => {
      toast.error('Could not enable Metro Intelligence. Please try again.');
    },
  });
}
