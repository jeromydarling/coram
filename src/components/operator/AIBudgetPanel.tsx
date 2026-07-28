/**
 * AIBudgetPanel — Operator-level unified AI budget configuration.
 *
 * WHAT: Set monthly AI call ceiling across all engines (Lovable AI + Perplexity).
 * WHERE: Operator Console → System (MACHINA zone).
 * WHY: Operator controls total AI spend; CROS distributes to tenants proportionally.
 */
import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Save, Brain, AlertTriangle, Sparkles, Search } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/sonner';
import { HelpTooltip } from '@/components/ui/help-tooltip';
import { Progress } from '@/components/ui/progress';

interface BudgetConfig {
  id: string;
  monthly_call_cap: number;
  calls_per_user_core: number;
  calls_per_user_insight: number;
  calls_per_user_story: number;
  tokens_per_user_core: number;
  tokens_per_user_insight: number;
  tokens_per_user_story: number;
}

interface EngineUsage {
  lovable: number;
  perplexity: number;
  firecrawl: number;
  total: number;
}

export function AIBudgetPanel() {
  const queryClient = useQueryClient();

  const { data: budget, isLoading } = useQuery({
    queryKey: ['operator-ai-budget'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('operator_ai_budget')
        .select('*')
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as BudgetConfig | null;
    },
  });

  // Current period usage across all engines
  const { data: engineUsage } = useQuery({
    queryKey: ['operator-engine-usage'],
    queryFn: async () => {
      const now = new Date();
      const periodStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);

      const { data, error } = await supabase
        .from('tenant_usage_counters')
        .select('ai_calls, ai_calls_lovable, ai_calls_perplexity, ai_calls_firecrawl')
        .gte('period_start', periodStart);

      if (error) return { lovable: 0, perplexity: 0, firecrawl: 0, total: 0 } as EngineUsage;

      const usage: EngineUsage = { lovable: 0, perplexity: 0, firecrawl: 0, total: 0 };
      for (const row of data || []) {
        usage.lovable += (row as any).ai_calls_lovable || 0;
        usage.perplexity += (row as any).ai_calls_perplexity || 0;
        usage.firecrawl = (usage.firecrawl || 0) + ((row as any).ai_calls_firecrawl || 0);
        usage.total += (row as any).ai_calls || 0;
      }
      return usage;
    },
    refetchInterval: 60_000,
  });

  // Estimated total platform demand
  const { data: demandEstimate } = useQuery({
    queryKey: ['operator-ai-demand'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tenant_entitlements')
        .select('plan_key, tenant_id');
      if (error) return { totalDemand: 0, tenantCount: 0 };
      const tenantCount = data?.length ?? 0;
      return { totalDemand: tenantCount * 30 * 3, tenantCount };
    },
  });

  const [form, setForm] = useState<Partial<BudgetConfig>>({});

  useEffect(() => {
    if (budget) setForm(budget);
  }, [budget]);

  const save = useMutation({
    mutationFn: async () => {
      if (!budget?.id) return;
      const { error } = await supabase
        .from('operator_ai_budget')
        .update({
          monthly_call_cap: form.monthly_call_cap,
          calls_per_user_core: form.calls_per_user_core,
          calls_per_user_insight: form.calls_per_user_insight,
          calls_per_user_story: form.calls_per_user_story,
          tokens_per_user_core: form.tokens_per_user_core,
          tokens_per_user_insight: form.tokens_per_user_insight,
          tokens_per_user_story: form.tokens_per_user_story,
          updated_at: new Date().toISOString(),
        })
        .eq('id', budget.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['operator-ai-budget'] });
      toast.success('AI budget updated');
    },
    onError: () => toast.error('Failed to save AI budget'),
  });

  if (isLoading) {
    return <Card><CardContent className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></CardContent></Card>;
  }

  const cap = form.monthly_call_cap ?? 500;
  const totalUsed = engineUsage?.total ?? 0;
  const usagePct = cap > 0 ? Math.min(Math.round((totalUsed / cap) * 100), 100) : 0;
  const overBudget = (demandEstimate?.totalDemand ?? 0) > cap;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="h-5 w-5" />
          Unified AI Budget
          <HelpTooltip content="One ceiling governs all AI engines — Lovable AI (NRI, chat, email analysis) and Perplexity (search, org enrichment, discovery). CROS distributes this budget across tenants based on their tier and team size." />
        </CardTitle>
        <CardDescription>
          Your platform-wide NRI capacity ceiling — shared across all engines.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Current period usage */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>This Month's Usage</Label>
            <span className="text-sm font-medium">{totalUsed.toLocaleString()} / {cap.toLocaleString()}</span>
          </div>
          <Progress value={usagePct} className="h-2" />
          
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2 rounded-md border p-3">
              <Sparkles className="h-4 w-4 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">Lovable AI</p>
                <p className="text-sm font-medium">{(engineUsage?.lovable ?? 0).toLocaleString()} calls</p>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-md border p-3">
              <Search className="h-4 w-4 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">Perplexity</p>
                <p className="text-sm font-medium">{(engineUsage?.perplexity ?? 0).toLocaleString()} calls</p>
              </div>
            </div>
          </div>
        </div>

        {/* Monthly ceiling */}
        <div className="space-y-2">
          <Label htmlFor="monthly-cap">Monthly AI Call Ceiling (all engines)</Label>
          <div className="flex items-center gap-3">
            <Input
              id="monthly-cap"
              type="number"
              min={100}
              value={form.monthly_call_cap ?? 500}
              onChange={(e) => setForm(f => ({ ...f, monthly_call_cap: parseInt(e.target.value) || 0 }))}
              className="w-40"
            />
            <span className="text-sm text-muted-foreground">calls / month</span>
          </div>
          {overBudget && (
            <div className="flex items-center gap-1.5 text-sm text-warning">
              <AlertTriangle className="h-3.5 w-3.5" />
              Estimated tenant demand may exceed your ceiling — allocations will scale down proportionally.
            </div>
          )}
        </div>

        {/* Per-user rates by tier */}
        <div className="space-y-3">
          <Label>Calls per Active User per Month</Label>
          <div className="grid grid-cols-3 gap-3">
            {[
              { key: 'calls_per_user_core' as const, label: 'Core' },
              { key: 'calls_per_user_insight' as const, label: 'Insight' },
              { key: 'calls_per_user_story' as const, label: 'Story' },
            ].map(({ key, label }) => (
              <div key={key} className="space-y-1">
                <Badge variant="outline" className="text-xs">{label}</Badge>
                <Input
                  type="number"
                  min={1}
                  value={form[key] ?? 30}
                  onChange={(e) => setForm(f => ({ ...f, [key]: parseInt(e.target.value) || 0 }))}
                />
              </div>
            ))}
          </div>
        </div>

        {demandEstimate && (
          <p className="text-xs text-muted-foreground">
            {demandEstimate.tenantCount} tenant{demandEstimate.tenantCount !== 1 ? 's' : ''} active.
            Estimated demand: ~{demandEstimate.totalDemand.toLocaleString()} calls/month.
          </p>
        )}

        <Button onClick={() => save.mutate()} disabled={save.isPending} className="w-full sm:w-auto">
          {save.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
          Save Budget
        </Button>
      </CardContent>
    </Card>
  );
}
