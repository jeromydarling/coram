/**
 * useRichnessEligibility — Suggests upgrading a person's view when thresholds are met.
 *
 * WHAT: Counts visits, life events, and movement signals for a person entity.
 * WHERE: PersonDetail (richness suggestion banner).
 * WHY: In institution-focused tenants, people start light; this gently suggests richer views.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { useRelationalOrientation } from './useRelationalOrientation';

interface EligibilityResult {
  eligible: boolean;
  reason: string | null;
  visitCount: number;
  lifeEventCount: number;
}

export function useRichnessEligibility(personId: string | undefined) {
  const { tenantId } = useTenant();
  const { orientation, peopleRichness } = useRelationalOrientation();

  return useQuery<EligibilityResult>({
    queryKey: ['richness-eligibility', tenantId, personId],
    enabled: !!tenantId && !!personId && orientation === 'institution_focused' && peopleRichness === 1,
    staleTime: 60_000,
    queryFn: async () => {
      if (!tenantId || !personId) return { eligible: false, reason: null, visitCount: 0, lifeEventCount: 0 };

      // Count visits (care-related activities for this contact)
      const { count: visitCount } = await supabase
        .from('activities')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('contact_id', personId)
        .eq('activity_type', 'Care Visit');

      // Count life events
      const { count: lifeEventCount } = await supabase
        .from('life_events')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('person_id', personId);

      const visits = visitCount ?? 0;
      const events = lifeEventCount ?? 0;

      if (visits >= 10) {
        return { eligible: true, reason: 'This relationship has grown through many visits.', visitCount: visits, lifeEventCount: events };
      }
      if (events >= 5) {
        return { eligible: true, reason: 'Several life moments have been recorded for this person.', visitCount: visits, lifeEventCount: events };
      }

      return { eligible: false, reason: null, visitCount: visits, lifeEventCount: events };
    },
  });
}
