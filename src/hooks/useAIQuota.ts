/**
 * useAIQuota — Dynamic AI quota for the current tenant.
 *
 * WHAT: Calls compute_tenant_ai_quota RPC and merges with usage counters.
 * WHERE: Tenant settings AI usage card, NRI inline nudges.
 * WHY: Per-user scaling requires server-side computation (tier × active users + bonus, operator ceiling).
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';

export interface AIQuota {
  calls: number;
  tokens: number;
  active_users: number;
  scaled: boolean;
  scale_factor?: number;
  raw_calls?: number;
}

export interface AIUsageSummary {
  quota: AIQuota;
  used: { calls: number; tokens: number };
  callPct: number;
  tokenPct: number;
  isNearLimit: boolean;
  isAtLimit: boolean;
  periodStart: string | null;
  periodEnd: string | null;
}

export function useAIQuota() {
  const { tenantId } = useTenant();

  return useQuery<AIUsageSummary | null>({
    queryKey: ['ai-quota', tenantId],
    queryFn: async () => {
      if (!tenantId) return null;

      // Parallel: compute quota + get usage
      const [quotaRes, entRes] = await Promise.all([
        supabase.rpc('compute_tenant_ai_quota', { p_tenant_id: tenantId }),
        supabase
          .from('tenant_entitlements')
          .select('current_period_start, current_period_end')
          .eq('tenant_id', tenantId)
          .maybeSingle(),
      ]);

      const quota: AIQuota = (quotaRes.data as unknown as AIQuota) ?? { calls: 200, tokens: 500000, active_users: 0, scaled: false };

      const now = new Date();
      const periodStart = entRes.data?.current_period_start
        || new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const periodEnd = entRes.data?.current_period_end
        || new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString();

      const { data: usage } = await supabase
        .from('tenant_usage_counters')
        .select('ai_calls, ai_tokens')
        .eq('tenant_id', tenantId)
        .gte('period_start', periodStart.slice(0, 10))
        .lte('period_end', periodEnd.slice(0, 10))
        .maybeSingle();

      const used = { calls: usage?.ai_calls ?? 0, tokens: usage?.ai_tokens ?? 0 };
      const callPct = quota.calls > 0 ? Math.round((used.calls / quota.calls) * 100) : 0;
      const tokenPct = quota.tokens > 0 ? Math.round((used.tokens / quota.tokens) * 100) : 0;

      return {
        quota,
        used,
        callPct,
        tokenPct,
        isNearLimit: Math.max(callPct, tokenPct) >= 80,
        isAtLimit: Math.max(callPct, tokenPct) >= 100,
        periodStart,
        periodEnd,
      };
    },
    enabled: !!tenantId,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}
