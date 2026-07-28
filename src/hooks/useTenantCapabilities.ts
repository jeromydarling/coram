/**
 * useTenantCapabilities — Computes boolean capability flags for the current tenant.
 *
 * WHAT: Determines which modules, features, and data are present for the current tenant.
 * WHERE: Used by Mission Rhythm, Reports, and any archetype-aware UI.
 * WHY: Different tenants have radically different needs — a parish vs. a workforce org.
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { useMetroIntelligence } from './useMetroIntelligence';
import { useProvisionMode } from './useProvisionMode';
import { useEntitlements } from './useEntitlements';
import { getFeaturesForPlan } from '@/lib/features';

export interface TenantCapabilities {
  // Module presence
  hasMetros: boolean;
  hasProvisio: boolean;
  hasVolunteers: boolean;
  hasGrants: boolean;
  hasOutreach: boolean;
  hasBridge: boolean;
  hasEvents: boolean;
  hasVisits: boolean;
  hasCommunio: boolean;
  hasTestimonium: boolean;
  hasImpulsus: boolean;

  // Legacy Profunda artifacts
  hasPipelineData: boolean;
  hasAnchorData: boolean;

  // Computed
  activeFeatures: string[];
  tablesWithData: string[];
  archetype: string | undefined;
  provisionMode: string;

  isLoading: boolean;
}

export function useTenantCapabilities(): TenantCapabilities {
  const { tenant, isLoading: tenantLoading } = useTenant();
  const { enabled: metrosEnabled } = useMetroIntelligence();
  const { mode: provisionMode, showStandalone: provisioActive } = useProvisionMode();
  const { entitlements, isLoading: entLoading } = useEntitlements();

  const plan = (tenant as any)?.tier ?? 'core';
  const archetype = (tenant as any)?.archetype;
  const tenantId = (tenant as any)?.id;

  // Lightweight data presence checks — counts only, cached
  const { data: dataCounts, isLoading: countsLoading } = useQuery({
    queryKey: ['tenant-data-presence', tenantId],
    enabled: !!tenantId,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const counts: Record<string, number> = {};
      
      const tables = [
        'anchors', 'anchor_pipeline', 'grants', 'volunteers',
        'events', 'activities', 'provisions',
      ] as const;

      // Run all counts in parallel
      const results = await Promise.all(
        tables.map(async (table) => {
          const { count } = await supabase
            .from(table)
            .select('id', { count: 'exact', head: true })
            .limit(1);
          return { table, count: count ?? 0 };
        })
      );

      results.forEach(r => { counts[r.table] = r.count; });

      // Check metros via tenant flag rather than counting
      if (metrosEnabled) counts['metros'] = 1;

      return counts;
    },
  });

  return useMemo(() => {
    const activeFeatures = getFeaturesForPlan(plan);
    const tablesWithData = Object.entries(dataCounts || {})
      .filter(([, count]) => count > 0)
      .map(([table]) => table);

    return {
      hasMetros: metrosEnabled,
      hasProvisio: provisioActive,
      hasVolunteers: (dataCounts?.volunteers ?? 0) > 0,
      hasGrants: (dataCounts?.grants ?? 0) > 0,
      hasOutreach: entitlements.campaigns_enabled ?? false,
      hasBridge: activeFeatures.includes('communio_opt_in'),
      hasEvents: (dataCounts?.events ?? 0) > 0,
      hasVisits: (dataCounts?.activities ?? 0) > 0,
      hasCommunio: activeFeatures.includes('communio_opt_in'),
      hasTestimonium: activeFeatures.includes('testimonium'),
      hasImpulsus: activeFeatures.includes('impulsus'),

      hasPipelineData: (dataCounts?.anchor_pipeline ?? 0) > 0,
      hasAnchorData: (dataCounts?.anchors ?? 0) > 0,

      activeFeatures,
      tablesWithData,
      archetype,
      provisionMode,

      isLoading: tenantLoading || entLoading || countsLoading,
    };
  }, [plan, archetype, dataCounts, metrosEnabled, provisioActive, entitlements, tenantLoading, entLoading, countsLoading, provisionMode]);
}
