/**
 * useEntitlements — Reads tenant entitlements from the database.
 *
 * WHAT: Provides maxUsers, AI tier, pulse tier, NRI tier, and usage counters.
 * WHERE: Used by enforcement guards and billing page.
 * WHY: Central entitlement reader cached via React Query for fast reads.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';

export interface Entitlements {
  plan_key: string;
  included_users: number;
  addon_users: number;
  maxUsers: number;
  ai_tier: 'base' | 'expanded';
  local_pulse_tier: 'base' | 'expanded';
  nri_tier: 'standard' | 'advanced';
  campaigns_enabled: boolean;
  stripe_status: string;
  current_period_start: string | null;
  current_period_end: string | null;
  is_stale: boolean;
  last_synced_at: string;
}

export interface UsageCounters {
  ai_calls: number;
  ai_tokens: number;
  pulse_articles_ingested: number;
  pulse_runs: number;
  nri_rollups_run: number;
  nri_flags_emitted: number;
  period_start: string;
  period_end: string;
}

const DEFAULT_ENTITLEMENTS: Entitlements = {
  plan_key: 'core',
  included_users: 3,
  addon_users: 0,
  maxUsers: 3,
  ai_tier: 'base',
  local_pulse_tier: 'base',
  nri_tier: 'standard',
  campaigns_enabled: false,
  stripe_status: 'inactive',
  current_period_start: null,
  current_period_end: null,
  is_stale: false,
  last_synced_at: new Date().toISOString(),
};

export function useEntitlements() {
  const { tenantId } = useTenant();

  const entitlementsQuery = useQuery({
    queryKey: ['tenant-entitlements', tenantId],
    queryFn: async (): Promise<Entitlements> => {
      if (!tenantId) return DEFAULT_ENTITLEMENTS;

      const { data, error } = await supabase
        .from('tenant_entitlements')
        .select('*')
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (error || !data) return DEFAULT_ENTITLEMENTS;

      return {
        plan_key: data.plan_key,
        included_users: data.included_users,
        addon_users: data.addon_users,
        maxUsers: data.included_users + data.addon_users,
        ai_tier: data.ai_tier as 'base' | 'expanded',
        local_pulse_tier: data.local_pulse_tier as 'base' | 'expanded',
        nri_tier: data.nri_tier as 'standard' | 'advanced',
        campaigns_enabled: data.campaigns_enabled ?? false,
        stripe_status: data.stripe_status,
        current_period_start: data.current_period_start,
        current_period_end: data.current_period_end,
        is_stale: data.is_stale,
        last_synced_at: data.last_synced_at,
      };
    },
    enabled: !!tenantId,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const usageQuery = useQuery({
    queryKey: ['tenant-usage', tenantId],
    queryFn: async (): Promise<UsageCounters | null> => {
      if (!tenantId) return null;

      const { data, error } = await supabase
        .from('tenant_usage_counters')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('period_start', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error || !data) return null;

      return {
        ai_calls: data.ai_calls,
        ai_tokens: data.ai_tokens,
        pulse_articles_ingested: data.pulse_articles_ingested,
        pulse_runs: data.pulse_runs,
        nri_rollups_run: data.nri_rollups_run,
        nri_flags_emitted: data.nri_flags_emitted,
        period_start: data.period_start,
        period_end: data.period_end,
      };
    },
    enabled: !!tenantId,
    staleTime: 30_000,
  });

  return {
    entitlements: entitlementsQuery.data ?? DEFAULT_ENTITLEMENTS,
    usage: usageQuery.data ?? null,
    isLoading: entitlementsQuery.isLoading,
    isStale: entitlementsQuery.data?.is_stale ?? false,
  };
}
