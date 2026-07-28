/**
 * useAIObservatory — Data hooks for the AI Observatory operator page.
 *
 * WHAT: Fetches global AI health, engine breakdown, workflow attribution, tenant intensity.
 * WHERE: /operator/machina/ai-observatory
 * WHY: Operator needs cost-aware, simulation-enabled AI governance visibility.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/sonner';

/* ── Global Health ── */
export interface GlobalAIHealth {
  totalCalls: number;
  estimatedCost: number;
  envelopeUsedPct: number;
  projectedMonthEnd: number;
  burnVelocityDelta: number;
  engineBreakdown: {
    lovable: { calls: number; cost: number };
    perplexity: { calls: number; cost: number };
    firecrawl: { calls: number; cost: number };
  };
}

export function useGlobalAIHealth() {
  return useQuery({
    queryKey: ['ai-observatory-health'],
    queryFn: async () => {
      const now = new Date();
      const periodStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);

      const [usageRes, budgetRes, costModelRes] = await Promise.all([
        supabase
          .from('tenant_usage_counters')
          .select('ai_calls, ai_calls_lovable, ai_calls_perplexity, ai_calls_firecrawl, ai_cost_estimated_usd, deep_mode_calls, essential_mode_calls')
          .gte('period_start', periodStart),
        supabase
          .from('operator_ai_budget')
          .select('*')
          .limit(1)
          .maybeSingle(),
        supabase
          .from('operator_ai_cost_model')
          .select('*')
          .limit(1)
          .maybeSingle(),
      ]);

      const rows = usageRes.data || [];
      let totalCalls = 0, lovableCalls = 0, perplexityCalls = 0, firecrawlCalls = 0, totalCost = 0;
      let deepCalls = 0, essentialCalls = 0;

      for (const row of rows) {
        totalCalls += (row as any).ai_calls || 0;
        lovableCalls += (row as any).ai_calls_lovable || 0;
        perplexityCalls += (row as any).ai_calls_perplexity || 0;
        firecrawlCalls += (row as any).ai_calls_firecrawl || 0;
        totalCost += Number((row as any).ai_cost_estimated_usd) || 0;
        deepCalls += (row as any).deep_mode_calls || 0;
        essentialCalls += (row as any).essential_mode_calls || 0;
      }

      const budget = budgetRes.data;
      const costModel = costModelRes.data;
      const envelope = Number(budget?.projected_cost_envelope_usd) || 500;
      const envelopeUsedPct = envelope > 0 ? Math.round((totalCost / envelope) * 100) : 0;

      // Projection: avg daily cost × 30
      const dayOfMonth = now.getDate();
      const avgDailyCost = dayOfMonth > 0 ? totalCost / dayOfMonth : 0;
      const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const projectedMonthEnd = Math.round(avgDailyCost * daysInMonth * 100) / 100;

      // Estimate engine costs from cost model
      const tokensPerCall = costModel?.avg_tokens_per_nri_call || 2000;
      const lovableCostPer1k = Number(costModel?.lovable_cost_per_1k_tokens) || 0.003;
      const perplexityCostPerCall = Number(costModel?.avg_perplexity_cost_per_call) || 0.005;

      const lovableCost = Math.round((lovableCalls * tokensPerCall / 1000 * lovableCostPer1k) * 100) / 100;
      const perplexityCost = Math.round(perplexityCalls * perplexityCostPerCall * 100) / 100;

      return {
        totalCalls,
        deepCalls,
        essentialCalls,
        estimatedCost: Math.round(totalCost * 100) / 100,
        envelopeUsedPct,
        projectedMonthEnd,
        burnVelocityDelta: 0, // TODO: compare with last 7 days
        envelope,
        engineBreakdown: {
          lovable: { calls: lovableCalls, cost: lovableCost },
          perplexity: { calls: perplexityCalls, cost: perplexityCost },
          firecrawl: { calls: firecrawlCalls, cost: Math.round(firecrawlCalls * 0.002 * 100) / 100 },
        },
        budget,
      };
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

/* ── Workflow Attribution ── */
export interface WorkflowUsageRow {
  workflow_key: string;
  engine: string;
  calls: number;
  cost: number;
  pctOfTotal: number;
}

export function useWorkflowAttribution() {
  return useQuery({
    queryKey: ['ai-observatory-workflows'],
    queryFn: async () => {
      const now = new Date();
      const periodStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      const { data, error } = await supabase
        .from('ai_workflow_usage')
        .select('workflow_key, engine_used, call_count, estimated_cost_usd')
        .gte('created_at', periodStart);

      if (error) throw error;

      // Aggregate by workflow_key
      const map = new Map<string, { calls: number; cost: number; engine: string }>();
      let totalCost = 0;

      for (const row of data || []) {
        const key = row.workflow_key;
        const existing = map.get(key) || { calls: 0, cost: 0, engine: row.engine_used };
        existing.calls += row.call_count;
        existing.cost += Number(row.estimated_cost_usd);
        totalCost += Number(row.estimated_cost_usd);
        map.set(key, existing);
      }

      const rows: WorkflowUsageRow[] = [];
      for (const [key, val] of map) {
        rows.push({
          workflow_key: key,
          engine: val.engine,
          calls: val.calls,
          cost: Math.round(val.cost * 1000) / 1000,
          pctOfTotal: totalCost > 0 ? Math.round((val.cost / totalCost) * 100) : 0,
        });
      }

      return rows.sort((a, b) => b.cost - a.cost);
    },
    staleTime: 60_000,
  });
}

/* ── Tenant Intensity ── */
export interface TenantIntensityRow {
  tenant_id: string;
  tenant_name: string;
  tier: string;
  ai_calls: number;
  deep_calls: number;
  essential_calls: number;
  estimated_cost: number;
  intensity: 'light' | 'active' | 'heavy_narrative' | 'research_intensive' | 'power_user';
}

export function useTenantIntensity() {
  return useQuery({
    queryKey: ['ai-observatory-tenants'],
    queryFn: async () => {
      const now = new Date();
      const periodStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);

      const [usageRes, tenantsRes, entsRes] = await Promise.all([
        supabase
          .from('tenant_usage_counters')
          .select('tenant_id, ai_calls, deep_mode_calls, essential_mode_calls, ai_cost_estimated_usd')
          .gte('period_start', periodStart),
        supabase.from('tenants').select('id, name'),
        supabase.from('tenant_entitlements').select('tenant_id, plan_key'),
      ]);

      const tenantMap = new Map((tenantsRes.data || []).map(t => [t.id, t.name]));
      const tierMap = new Map((entsRes.data || []).map(e => [e.tenant_id, e.plan_key]));

      const rows: TenantIntensityRow[] = [];

      for (const u of usageRes.data || []) {
        const calls = (u as any).ai_calls || 0;
        const deep = (u as any).deep_mode_calls || 0;
        const essential = (u as any).essential_mode_calls || 0;
        const cost = Number((u as any).ai_cost_estimated_usd) || 0;

        let intensity: TenantIntensityRow['intensity'] = 'light';
        if (calls > 200) intensity = 'power_user';
        else if (deep > 50) intensity = 'research_intensive';
        else if (calls > 100) intensity = 'heavy_narrative';
        else if (calls > 30) intensity = 'active';

        rows.push({
          tenant_id: u.tenant_id,
          tenant_name: tenantMap.get(u.tenant_id) || 'Unknown',
          tier: tierMap.get(u.tenant_id) || 'core',
          ai_calls: calls,
          deep_calls: deep,
          essential_calls: essential,
          estimated_cost: Math.round(cost * 100) / 100,
          intensity,
        });
      }

      return rows.sort((a, b) => b.estimated_cost - a.estimated_cost);
    },
    staleTime: 60_000,
  });
}

/* ── Governance Controls ── */
export function useGovernanceControls() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (updates: Record<string, unknown>) => {
      const { data: budget } = await supabase
        .from('operator_ai_budget')
        .select('id')
        .limit(1)
        .maybeSingle();

      if (!budget?.id) throw new Error('No AI budget configured');

      const { error } = await supabase
        .from('operator_ai_budget')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', budget.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-observatory-health'] });
      toast.success('Governance settings updated');
    },
    onError: () => toast.error('Failed to update governance settings'),
  });
}

/* ── AI Events Log ── */
export function useAIEvents(limit = 20) {
  return useQuery({
    queryKey: ['ai-observatory-events', limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('operator_ai_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    },
    staleTime: 30_000,
  });
}
