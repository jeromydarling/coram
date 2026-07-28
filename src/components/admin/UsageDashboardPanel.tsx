import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, TrendingUp, AlertTriangle, BarChart3, Layers } from 'lucide-react';
import { useUsageDailyByOrg, useUsageByWorkflow, useUsageByUnit, useCurrentMonthUsage } from '@/hooks/useUsageData';
import { workflowLabel } from '@/lib/automationHealthFormatters';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useState } from 'react';
import { Progress } from '@/components/ui/progress';

// Per-unit monthly soft caps for billing readiness display
// These are internal estimates — not enforced here, just for projection visibility
const MONTHLY_CAPS: Record<string, { cap: number; label: string }> = {
  perplexity_search: { cap: 500, label: 'Perplexity Searches' },
  token: { cap: 500_000, label: 'LLM Tokens' },
  run: { cap: 300, label: 'Workflow Runs' },
  count: { cap: 200, label: 'Generated Items' },
  email: { cap: 2000, label: 'Emails Sent' },
};

function UsageTrendChart({ windowDays }: { windowDays: number }) {
  const { data, isLoading } = useUsageDailyByOrg(windowDays);

  if (isLoading) return <LoadingCard />;
  if (!data?.length) return <EmptyCard message="No usage data in this period" />;

  // Aggregate by date for chart
  const byDate = new Map<string, number>();
  for (const row of data) {
    byDate.set(row.usage_date, (byDate.get(row.usage_date) ?? 0) + row.total_quantity);
  }
  const chartData = Array.from(byDate.entries()).map(([date, qty]) => ({
    date: date.slice(5), // MM-DD
    quantity: qty,
  }));

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <TrendingUp className="w-4 h-4" />
          Daily Usage Trend
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="quantity" fill="hsl(var(--primary))" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

function WorkflowBreakdown({ windowDays }: { windowDays: number }) {
  const { data, isLoading } = useUsageByWorkflow(windowDays);

  if (isLoading) return <LoadingCard />;
  if (!data?.length) return <EmptyCard message="No workflow usage data" />;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <BarChart3 className="w-4 h-4" />
          Usage by Workflow
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {data.map((row) => (
          <div key={row.workflow_key} className="flex items-center justify-between">
            <span className="text-sm">{workflowLabel(row.workflow_key)}</span>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs font-mono">
                {row.total_quantity.toLocaleString()} units
              </Badge>
              <Badge variant="secondary" className="text-xs">
                {row.event_count} runs
              </Badge>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function UnitBreakdown({ windowDays }: { windowDays: number }) {
  const { data, isLoading } = useUsageByUnit(windowDays);

  if (isLoading) return <LoadingCard />;
  if (!data?.length) return <EmptyCard message="No unit usage data" />;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Layers className="w-4 h-4" />
          Usage by Unit
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {data.map((row) => (
          <div key={row.unit} className="flex items-center justify-between">
            <span className="text-sm capitalize">{row.unit}</span>
            <Badge variant="outline" className="text-xs font-mono">
              {row.total_quantity.toLocaleString()}
            </Badge>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function BillingReadinessPanel() {
  const { data, isLoading } = useCurrentMonthUsage();

  if (isLoading) return <LoadingCard />;
  if (!data) return <EmptyCard message="No billing data available" />;

  // Build per-unit utilization from byUnit
  const unitEntries = Object.entries(data.byUnit) as [string, number][];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          Billing Readiness — Current Month
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* KPI row */}
        <div className="grid grid-cols-3 gap-3">
          <KPIStat label="Total Events" value={data.totalEvents.toLocaleString()} />
          <KPIStat label="Day" value={`${data.dayOfMonth}/${data.daysInMonth}`} />
          <KPIStat label="Unit Types" value={String(unitEntries.length)} />
        </div>

        {/* Per-unit cap utilization */}
        <div className="space-y-3 pt-2 border-t">
          <p className="text-xs font-medium text-muted-foreground">Usage by Unit (vs. monthly estimate)</p>
          {unitEntries.map(([unit, qty]) => {
            const capInfo = MONTHLY_CAPS[unit];
            const cap = capInfo?.cap ?? 0;
            const label = capInfo?.label ?? unit;
            const projected = data.dayOfMonth > 0
              ? Math.round((qty / data.dayOfMonth) * data.daysInMonth)
              : 0;
            const pct = cap > 0 ? Math.round((qty / cap) * 100) : 0;
            const projPct = cap > 0 ? Math.round((projected / cap) * 100) : 0;

            return (
              <div key={unit} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="font-medium">{label}</span>
                  <span className="text-muted-foreground font-mono">
                    {formatQuantity(qty)}{cap > 0 ? ` / ${formatQuantity(cap)}` : ''}
                  </span>
                </div>
                {cap > 0 && (
                  <>
                    <Progress value={Math.min(pct, 100)} className="h-1.5" />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{pct}% used</span>
                      <span className={projPct > 80 ? 'text-destructive font-medium' : ''}>
                        {projPct}% projected
                      </span>
                    </div>
                  </>
                )}
              </div>
            );
          })}

          {unitEntries.length === 0 && (
            <p className="text-xs text-muted-foreground">No usage recorded this month</p>
          )}
        </div>

        {/* Breakdown by workflow */}
        <div className="space-y-1 pt-2 border-t">
          <p className="text-xs font-medium text-muted-foreground">By Workflow</p>
          {Object.entries(data.byWorkflow).map(([key, qty]) => (
            <div key={key} className="flex justify-between text-xs">
              <span>{workflowLabel(key)}</span>
              <span className="font-mono">{(qty as number).toLocaleString()}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function formatQuantity(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function KPIStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-3 rounded-lg bg-muted/50 text-center">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-bold">{value}</p>
    </div>
  );
}

function LoadingCard() {
  return (
    <Card>
      <CardContent className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </CardContent>
    </Card>
  );
}

function EmptyCard({ message }: { message: string }) {
  return (
    <Card>
      <CardContent className="py-6 text-center text-sm text-muted-foreground">
        {message}
      </CardContent>
    </Card>
  );
}

export function UsageDashboardPanel() {
  const [windowDays, setWindowDays] = useState(30);

  return (
    <div className="space-y-6">
      {/* Period selector */}
      <div className="flex items-center gap-3">
        <Select value={String(windowDays)} onValueChange={(v) => setWindowDays(Number(v))}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Billing readiness */}
      <BillingReadinessPanel />

      {/* Trend chart */}
      <UsageTrendChart windowDays={windowDays} />

      {/* Breakdowns */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <WorkflowBreakdown windowDays={windowDays} />
        <UnitBreakdown windowDays={windowDays} />
      </div>
    </div>
  );
}
