/**
 * useCompliancePosture — Fetches the current tenant's compliance posture.
 *
 * WHAT: Reads compliance_posture from tenant_settings for the active tenant.
 * WHERE: ContactModal, Testimonium, PublicPresencePage, narrative components.
 * WHY: Centralizes privacy-sensitive mode detection for UI and narrative engines.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import type { CompliancePosture } from '@/lib/operator/privacyPosture';

export function useCompliancePosture(): {
  posture: CompliancePosture;
  isHipaaSensitive: boolean;
  isLoading: boolean;
} {
  const { tenantId } = useTenant();

  const { data, isLoading } = useQuery({
    queryKey: ['compliance-posture', tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data: settings } = await supabase
        .from('tenant_settings')
        .select('compliance_posture')
        .eq('tenant_id', tenantId!)
        .maybeSingle();
      return (settings?.compliance_posture as CompliancePosture) ?? 'standard';
    },
    staleTime: 5 * 60 * 1000, // 5 min cache
  });

  const posture = data ?? 'standard';

  return {
    posture,
    isHipaaSensitive: posture === 'hipaa_sensitive',
    isLoading,
  };
}
