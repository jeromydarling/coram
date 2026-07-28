/**
 * useCommunioGovernance — admin-only governance metrics hook.
 *
 * WHAT: Queries communio_group_metrics + nri_usage_metrics for the Operator Console.
 * WHERE: Used by the "Communio Health" tab in OperatorConsole.
 * WHY: Provides aggregated, privacy-safe governance visibility for CROS leadership.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface CommunioGroupMetric {
  id: string;
  group_id: string;
  tenant_count: number;
  signals_shared_count: number;
  events_shared_count: number;
  collaboration_levels: Record<string, number>;
  week_start: string;
  created_at: string;
}

export interface NriUsageMetric {
  tenant_id: string;
  week_start: string;
  signals_generated: number;
  signals_shared_to_communio: number;
  reflections_triggered: number;
  testimonium_flags_generated: number;
  created_at: string;
}

export function useCommunioGovernance() {
  const groupMetrics = useQuery({
    queryKey: ['operator', 'communioHealth', 'groups'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('communio_group_metrics')
        .select('*')
        .order('week_start', { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as unknown as CommunioGroupMetric[];
    },
  });

  const nriMetrics = useQuery({
    queryKey: ['operator', 'communioHealth', 'nri'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('nri_usage_metrics')
        .select('*')
        .order('week_start', { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as unknown as NriUsageMetric[];
    },
  });

  // Derive latest week's group data
  const latestWeek = groupMetrics.data?.[0]?.week_start;
  const latestGroupMetrics = groupMetrics.data?.filter(
    (m) => m.week_start === latestWeek,
  ) ?? [];

  const totalGroups = latestGroupMetrics.length;
  const avgTenantsPerGroup =
    totalGroups > 0
      ? Math.round(
          latestGroupMetrics.reduce((s, m) => s + m.tenant_count, 0) /
            totalGroups,
        )
      : 0;
  const signalsThisWeek = latestGroupMetrics.reduce(
    (s, m) => s + m.signals_shared_count,
    0,
  );

  // Sharing levels distribution (aggregate across all groups)
  const sharingDistribution: Record<string, number> = {};
  for (const m of latestGroupMetrics) {
    for (const [level, count] of Object.entries(m.collaboration_levels)) {
      sharingDistribution[level] =
        (sharingDistribution[level] || 0) + (count as number);
    }
  }

  // Quiet groups: 0 signals + 0 events in latest week
  const quietGroups = latestGroupMetrics.filter(
    (m) => m.signals_shared_count === 0 && m.events_shared_count === 0,
  );

  return {
    groupMetrics,
    nriMetrics,
    totalGroups,
    avgTenantsPerGroup,
    signalsThisWeek,
    sharingDistribution,
    quietGroups,
    isLoading: groupMetrics.isLoading || nriMetrics.isLoading,
  };
}
