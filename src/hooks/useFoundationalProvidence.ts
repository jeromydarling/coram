/**
 * useFoundationalProvidence — Auto-triggers first Providence reflection at day 21–30.
 *
 * WHAT: Checks tenant age + minimum meaningful actions, then triggers a "foundational"
 *       Providence generation if none exists yet.
 * WHERE: Mounted once in AIChatDrawer or CompassDrawer.
 * WHY: Ensures every new tenant gets at least one arc reflection in their first month,
 *       without requiring manual action.
 */

import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { useProvidenceReport } from './useProvidenceReport';
import { getTenantAgeDays } from '@/lib/tenantAge';

export function useFoundationalProvidence() {
  const { tenant, tenantId } = useTenant();
  const { report, generate, isGenerating } = useProvidenceReport();
  const triggered = useRef(false);

  const ageDays = tenant?.created_at ? getTenantAgeDays(tenant.created_at) : 0;
  const inWindow = ageDays >= 21 && ageDays <= 30;
  const hasExistingReport = !!report;

  // Count meaningful actions (entity created, life event, visit, partner)
  const { data: actionCount } = useQuery({
    queryKey: ['foundational-action-count', tenantId],
    enabled: !!tenantId && inWindow && !hasExistingReport,
    staleTime: 30 * 60_000,
    queryFn: async () => {
      const [opps, lifeEvents, activities] = await Promise.all([
        supabase
          .from('opportunities')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId!),
        supabase
          .from('life_events')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId!),
        supabase
          .from('activities')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId!)
          .in('activity_type', ['Visit', 'Site Visit', 'Meeting', 'Care Visit']),
      ]);
      return (opps.count || 0) + (lifeEvents.count || 0) + (activities.count || 0);
    },
  });

  useEffect(() => {
    if (
      triggered.current ||
      isGenerating ||
      !inWindow ||
      hasExistingReport ||
      actionCount == null ||
      actionCount < 3
    ) return;

    triggered.current = true;
    generate('foundational' as any).catch(() => {
      // Keep lock for current mount to prevent toast loops on repeated failures.
      // A fresh session/remount can try again.
    });
  }, [inWindow, hasExistingReport, actionCount, isGenerating, generate]);
}
