/**
 * AIObservatoryPage — Intelligence Observatory for the Gardener.
 *
 * WHAT: Full AI burn monitoring, engine attribution, workflow analysis, tenant intensity, governance.
 * WHERE: /operator/machina/ai-observatory
 * WHY: Replaces basic AI Budget tab with comprehensive, simulation-enabled intelligence governance.
 *
 * Feature Name: AI Observatory
 * Primary Purpose: Cost-aware AI governance and monitoring
 * Chosen Zone: MACHINA
 * Why this Zone: System engine monitoring — infrastructure cost awareness
 * Why NOT others: Not daily workflow (CURA), not growth (CRESCERE), not insight (SCIENTIA)
 * Operator Impact: Full visibility into AI burn, projections, and governance controls
 * Navigation Location: /operator/machina/ai-observatory
 */
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { HelpTooltip } from '@/components/ui/help-tooltip';
import { Brain, Sparkles, Search, Globe, Activity, TrendingUp, Shield, AlertTriangle, Zap } from 'lucide-react';
import { LocalPulseHealthPanel } from '@/components/operator/LocalPulseHealthPanel';
import {
  useGlobalAIHealth,
  useWorkflowAttribution,
  useTenantIntensity,
  useGovernanceControls,
  useAIEvents,
} from '@/hooks/useAIObservatory';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatDistanceToNow } from 'date-fns';

function HealthStatCard({ label, value, subtitle, icon: Icon, status }: {
  label: string;
  value: string;
  subtitle?: string;
  icon: React.ElementType;
  status?: 'calm' | 'watch' | 'warm';
}) {
  const statusColor = status === 'warm' ? 'text-orange-500' : status === 'watch' ? 'text-amber-500' : 'text-primary';
  return (
    <Card>
      <CardContent className="pt-4 pb-3 px-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className={`text-xl font-semibold tabular-nums ${statusColor}`}>{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          </div>
          <Icon className={`h-4 w-4 mt-1 ${statusColor}`} />
        </div>
      </CardContent>
    </Card>
  );
}

function EngineBreakdownPanel({ data }: { data: ReturnType<typeof useGlobalAIHealth>['data'] }) {
  if (!data) return null;
  const { engineBreakdown, totalCalls } = data;
  const engines = [
    { key: 'Lovable AI', icon: Sparkles, ...engineBreakdown.lovable },
    { key: 'Perplexity', icon: Search, ...engineBreakdown.perplexity },
    { key: 'Firecrawl', icon: Globe, ...engineBreakdown.firecrawl },
  ];
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Activity className="h-4 w-4" />
          Engine Breakdown
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {engines.map(e => (
          <div key={e.key} className="flex items-center gap-3 rounded-md border p-3">
            <e.icon className="h-4 w-4 text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">{e.key}</p>
                <Badge variant="outline" className="text-xs tabular-nums">
                  {totalCalls > 0 ? Math.round((e.calls / totalCalls) * 100) : 0}%
                </Badge>
              </div>
              <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                <span>{e.calls.toLocaleString()} calls</span>
                <span>~${e.cost.toFixed(2)} est.</span>
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function WorkflowTable() {
  const { data: workflows, isLoading } = useWorkflowAttribution();
  if (isLoading) return <Skeleton className="h-48 w-full" />;

  const WORKFLOW_LABELS: Record<string, string> = {
    nri_chat: 'NRI Conversations',
    neighborhood_insights: 'Neighborhood Insights',
    drift_detection: 'Drift Detection',
    territory_news: 'Territory News',
    grant_discovery: 'Grant Discovery',
    enrichment: 'Org Enrichment',
    deep_report: 'Deep Reports',
    compass_full: 'Full Compass',
    tone_rewrite: 'Tone Rewrites',
    summary_single: 'Summaries',
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Zap className="h-4 w-4" />
          Workflow Attribution
          <HelpTooltip content="Which AI workflows are consuming the most resources this month. Sorted by estimated cost." />
        </CardTitle>
      </CardHeader>
      <CardContent>
        {(!workflows || workflows.length === 0) ? (
          <p className="text-sm text-muted-foreground py-4 text-center">No workflow usage recorded this period.</p>
        ) : (
          <ScrollArea className="max-h-64">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Workflow</TableHead>
                  <TableHead>Engine</TableHead>
                  <TableHead className="text-right">Calls</TableHead>
                  <TableHead className="text-right">Est. Cost</TableHead>
                  <TableHead className="text-right">% Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {workflows.map(w => (
                  <TableRow key={w.workflow_key}>
                    <TableCell className="text-sm">{WORKFLOW_LABELS[w.workflow_key] || w.workflow_key}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">{w.engine}</Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{w.calls.toLocaleString()}</TableCell>
                    <TableCell className="text-right tabular-nums">${w.cost.toFixed(3)}</TableCell>
                    <TableCell className="text-right tabular-nums">{w.pctOfTotal}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}

function TenantIntensityTable() {
  const { data: tenants, isLoading } = useTenantIntensity();
  if (isLoading) return <Skeleton className="h-48 w-full" />;

  const INTENSITY_LABELS: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
    light: { label: 'Light', variant: 'outline' },
    active: { label: 'Active', variant: 'secondary' },
    heavy_narrative: { label: 'Heavy Narrative', variant: 'default' },
    research_intensive: { label: 'Research Intensive', variant: 'default' },
    power_user: { label: 'Power User', variant: 'destructive' },
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <TrendingUp className="h-4 w-4" />
          Tenant Intensity
          <HelpTooltip content="AI consumption per tenant this period. Helps identify heavy consumers and potential upgrade candidates." />
        </CardTitle>
      </CardHeader>
      <CardContent>
        {(!tenants || tenants.length === 0) ? (
          <p className="text-sm text-muted-foreground py-4 text-center">No tenant usage this period.</p>
        ) : (
          <ScrollArea className="max-h-72">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tenant</TableHead>
                  <TableHead>Tier</TableHead>
                  <TableHead className="text-right">Calls</TableHead>
                  <TableHead className="text-right">Deep</TableHead>
                  <TableHead className="text-right">Est. Cost</TableHead>
                  <TableHead>Intensity</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tenants.slice(0, 20).map(t => {
                  const badge = INTENSITY_LABELS[t.intensity] || INTENSITY_LABELS.light;
                  return (
                    <TableRow key={t.tenant_id}>
                      <TableCell className="text-sm max-w-[150px] truncate">{t.tenant_name}</TableCell>
                      <TableCell><Badge variant="outline" className="text-xs capitalize">{t.tier}</Badge></TableCell>
                      <TableCell className="text-right tabular-nums">{t.ai_calls}</TableCell>
                      <TableCell className="text-right tabular-nums">{t.deep_calls}</TableCell>
                      <TableCell className="text-right tabular-nums">${t.estimated_cost.toFixed(2)}</TableCell>
                      <TableCell><Badge variant={badge.variant} className="text-xs">{badge.label}</Badge></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}

function GovernanceControls() {
  const { data } = useGlobalAIHealth();
  const controls = useGovernanceControls();

  if (!data?.budget) return null;

  const budget = data.budget as Record<string, unknown>;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Shield className="h-4 w-4" />
          Governance Controls
          <HelpTooltip content="Emergency controls for managing AI spend. Changes are logged in the audit trail." />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-sm">Force Essential Mode</Label>
            <p className="text-xs text-muted-foreground">Disable Deep Intelligence for all tenants</p>
          </div>
          <Switch
            checked={!!budget.force_essential_mode}
            onCheckedChange={(v) => controls.mutate({ force_essential_mode: v })}
            disabled={controls.isPending}
          />
        </div>
        <Separator />
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-sm">Pause Drift Detection</Label>
            <p className="text-xs text-muted-foreground">Temporarily disable background drift analysis</p>
          </div>
          <Switch
            checked={!!budget.pause_drift_detection}
            onCheckedChange={(v) => controls.mutate({ pause_drift_detection: v })}
            disabled={controls.isPending}
          />
        </div>
        <Separator />
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-sm">Pause Territory Crawls</Label>
            <p className="text-xs text-muted-foreground">Temporarily disable background metro news crawling</p>
          </div>
          <Switch
            checked={!!budget.pause_territory_crawls}
            onCheckedChange={(v) => controls.mutate({ pause_territory_crawls: v })}
            disabled={controls.isPending}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function EventsLog() {
  const { data: events, isLoading } = useAIEvents(15);
  if (isLoading) return <Skeleton className="h-32 w-full" />;

  const EVENT_LABELS: Record<string, string> = {
    deep_allowance_exhausted: 'Deep allowance exhausted',
    nri_guard_exceeded: 'NRI guard exceeded',
    global_ceiling_warning: 'Global ceiling warning',
    force_essential_toggled: 'Force essential toggled',
    drift_paused: 'Drift detection paused',
    territory_crawl_paused: 'Territory crawls paused',
    fallback_activated: 'Fallback mode activated',
    nri_usage_high: 'NRI usage high',
    upgrade_suggestion_triggered: 'Upgrade suggestion triggered',
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" />
          Recent Events
        </CardTitle>
      </CardHeader>
      <CardContent>
        {(!events || events.length === 0) ? (
          <p className="text-sm text-muted-foreground py-4 text-center">No governance events yet. Calm waters.</p>
        ) : (
          <ScrollArea className="max-h-48">
            <div className="space-y-2">
              {events.map((e: any) => (
                <div key={e.id} className="flex items-start gap-2 text-sm">
                  <span className="text-xs text-muted-foreground whitespace-nowrap mt-0.5">
                    {formatDistanceToNow(new Date(e.created_at), { addSuffix: true })}
                  </span>
                  <span>{EVENT_LABELS[e.event_type] || e.event_type}</span>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}

export default function AIObservatoryPage() {
  const { data, isLoading } = useGlobalAIHealth();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">AI Observatory</h1>
          <p className="text-sm text-muted-foreground">Intelligence engine monitoring — cost, capacity, and governance.</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
      </div>
    );
  }

  const envelopePct = data?.envelopeUsedPct ?? 0;
  const envelopeStatus = envelopePct > 85 ? 'warm' : envelopePct > 60 ? 'watch' : 'calm';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-foreground flex items-center gap-2">
          <Brain className="h-5 w-5" />
          AI Observatory
        </h1>
        <p className="text-sm text-muted-foreground">
          Intelligence engine monitoring — estimated costs, capacity, and governance controls.
        </p>
      </div>

      {/* Section A: Global Health Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <HealthStatCard
          label="Total AI Calls"
          value={(data?.totalCalls ?? 0).toLocaleString()}
          subtitle={`${data?.deepCalls ?? 0} deep · ${data?.essentialCalls ?? 0} essential`}
          icon={Activity}
          status="calm"
        />
        <HealthStatCard
          label="Estimated Cost"
          value={`$${(data?.estimatedCost ?? 0).toFixed(2)}`}
          subtitle="This month"
          icon={TrendingUp}
          status={envelopeStatus}
        />
        <HealthStatCard
          label="Envelope Used"
          value={`${envelopePct}%`}
          subtitle={`of $${(data?.envelope ?? 500).toFixed(0)} budget`}
          icon={Shield}
          status={envelopeStatus}
        />
        <HealthStatCard
          label="Projected EOM"
          value={`$${(data?.projectedMonthEnd ?? 0).toFixed(2)}`}
          subtitle="Based on 7-day avg"
          icon={Sparkles}
          status={
            (data?.projectedMonthEnd ?? 0) > (data?.envelope ?? 500) ? 'warm' :
            (data?.projectedMonthEnd ?? 0) > (data?.envelope ?? 500) * 0.7 ? 'watch' : 'calm'
          }
        />
      </div>

      {/* Envelope progress bar */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Cost Envelope</span>
          <span className="tabular-nums">${(data?.estimatedCost ?? 0).toFixed(2)} / ${(data?.envelope ?? 500).toFixed(0)}</span>
        </div>
        <Progress value={Math.min(envelopePct, 100)} className="h-1.5" />
      </div>

      {/* Main grid: Engine breakdown + Governance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <EngineBreakdownPanel data={data} />
        <GovernanceControls />
      </div>

      {/* Workflow Attribution */}
      <WorkflowTable />

      {/* Local Pulse Discovery Health */}
      <LocalPulseHealthPanel />

      {/* Tenant Intensity + Events */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <TenantIntensityTable />
        <EventsLog />
      </div>

      {/* Estimated disclaimer */}
      <p className="text-xs text-muted-foreground text-center pt-2">
        All cost values are estimated — not billing-grade. Based on configurable cost model assumptions.
      </p>
    </div>
  );
}
