/**
 * useDeepInsightStatus — Tenant-facing Deep Insight allowance awareness.
 *
 * WHAT: Checks the tenant's current Deep Insight usage vs allowance for gentle banners.
 * WHERE: Used by tenant UI components to show 80%/95%/100% status messaging.
 * WHY: Provides calm, non-alarmist awareness of Deep Insight capacity without exposing economics.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface DeepInsightStatus {
  pct: number;
  used: number;
  allowance: number;
  atLimit: boolean;
  nearLimit: boolean;    // ≥80%
  criticalLimit: boolean; // ≥95%
  tier: string;
}

const TIER_ALLOWANCES: Record<string, number> = {
  core: 100,
  insight: 250,
  story: 600,
};

export function useDeepInsightStatus() {
  return useQuery({
    queryKey: ['deep-insight-status'],
    queryFn: async () => {
      // Get user's tenant
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data: tenantLink } = await supabase
        .from('tenant_users')
        .select('tenant_id')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle();

      if (!tenantLink?.tenant_id) return null;

      const tenantId = tenantLink.tenant_id;

      // Get tenant tier
      const { data: ent } = await supabase
        .from('tenant_entitlements')
        .select('plan_key')
        .eq('tenant_id', tenantId)
        .maybeSingle();

      const tier = ent?.plan_key || 'core';

      // Check if operator has overridden allowances
      const { data: budget } = await supabase
        .from('operator_ai_budget')
        .select('deep_allowance_core, deep_allowance_insight, deep_allowance_story, force_essential_mode')
        .limit(1)
        .maybeSingle();

      const allowance = tier === 'story'
        ? (budget?.deep_allowance_story ?? 600)
        : tier === 'insight'
          ? (budget?.deep_allowance_insight ?? 250)
          : (budget?.deep_allowance_core ?? 100);

      // If force essential mode, report at limit
      if (budget?.force_essential_mode) {
        return {
          pct: 100,
          used: 0,
          allowance,
          atLimit: true,
          nearLimit: true,
          criticalLimit: true,
          tier,
        } as DeepInsightStatus;
      }

      // Get current period usage
      const now = new Date();
      const periodStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);

      const { data: usage } = await supabase
        .from('tenant_usage_counters')
        .select('deep_mode_calls')
        .eq('tenant_id', tenantId)
        .eq('period_start', periodStart)
        .maybeSingle();

      const used = (usage as Record<string, number>)?.deep_mode_calls ?? 0;
      const pct = allowance > 0 ? Math.round((used / allowance) * 100) : 0;

      return {
        pct,
        used,
        allowance,
        atLimit: pct >= 100,
        nearLimit: pct >= 80 && pct < 100,
        criticalLimit: pct >= 95 && pct < 100,
        tier,
      } as DeepInsightStatus;
    },
    staleTime: 120_000,
    refetchInterval: 300_000,
  });
}
