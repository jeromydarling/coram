/**
 * SystemHealth — Admin-only health dashboard for Phase 7M narrative flywheel.
 *
 * WHAT: Displays schedules, health events, and flywheel proof metrics.
 * WHERE: /admin/system-health
 * WHY: Ensures admins can verify the narrative engine runs silently and correctly.
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useSystemHealth } from '@/hooks/useSystemHealth';
import { useOperatorSchedules, useSystemHealthEvents } from '@/hooks/useOperatorSchedules';
import { supabase } from '@/integrations/supabase/client';
import { formatRelativeTime } from '@/lib/automationHealthFormatters';
import { toast } from '@/components/ui/sonner';
import {
  Activity, Radio, Brain, TrendingUp,
  Loader2, Server, Wifi, WifiOff, RefreshCw,
  Calendar, Clock, CheckCircle2, AlertCircle, XCircle,
  Play, Sparkles, BarChart3
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export default function SystemHealth() {
  const { data, isLoading, error } = useSystemHealth();
  const { data: schedules, isLoading: schedLoading, refetch: refetchSchedules } = useOperatorSchedules();
  const [healthFilter, setHealthFilter] = useState<string>('all');
  const { data: healthEvents, isLoading: heLoading } = useSystemHealthEvents(
    healthFilter === 'all' ? undefined : healthFilter
  );
  const [runningKey, setRunningKey] = useState<string | null>(null);

  const handleRunNow = async (scheduleKey: string) => {
    const fnMap: Record<string, string> = {
      testimonium_rollup_weekly: 'testimonium-rollup-weekly',
      nri_generate_signals_weekly: 'nri-generate-signals-weekly',
      operator_refresh_daily: 'operator-refresh',
      archetype_simulate_tick: 'archetype-simulate-tick',
    };
    const fnName = fnMap[scheduleKey];
    if (!fnName) {
      toast.error('No edge function mapped for this schedule');
      return;
    }
    setRunningKey(scheduleKey);
    try {
      const { data, error } = await supabase.functions.invoke(fnName, { body: {} });
      if (error) throw error;
      toast.success(`${scheduleKey} completed`, { description: JSON.stringify(data).slice(0, 120) });
      refetchSchedules();
    } catch (err: any) {
      toast.error(`Failed: ${err.message}`);
    } finally {
      setRunningKey(null);
    }
  };

  const handleToggle = async (scheduleKey: string, enabled: boolean) => {
    const { error } = await (supabase.from('operator_schedules') as any)
      .update({ enabled, updated_at: new Date().toISOString() })
      .eq('key', scheduleKey);
    if (error) {
      toast.error('Failed to update schedule');
    } else {
      refetchSchedules();
    }
  };

  if (isLoading && schedLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const statusIcon = (status: string | null) => {
    if (status === 'ok') return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
    if (status === 'warning') return <AlertCircle className="w-4 h-4 text-amber-500" />;
    if (status === 'error') return <XCircle className="w-4 h-4 text-destructive" />;
    return <Clock className="w-4 h-4 text-muted-foreground" />;
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">System Health</h1>
          <p className="text-sm text-muted-foreground">
            Phase 7M narrative flywheel monitoring — silent health + schedules + NRI signals
          </p>
        </div>

        <Tabs defaultValue="schedules" className="space-y-4">
          <TabsList>
            <TabsTrigger value="schedules" className="gap-1.5">
              <Calendar className="w-4 h-4" /> Schedules
            </TabsTrigger>
            <TabsTrigger value="health-events" className="gap-1.5">
              <Activity className="w-4 h-4" /> Health Events
            </TabsTrigger>
            <TabsTrigger value="flywheel" className="gap-1.5">
              <BarChart3 className="w-4 h-4" /> Flywheel Proof
            </TabsTrigger>
            <TabsTrigger value="legacy" className="gap-1.5">
              <Server className="w-4 h-4" /> Legacy Metrics
            </TabsTrigger>
          </TabsList>

          {/* ── SCHEDULES TAB ── */}
          <TabsContent value="schedules" className="space-y-3">
            {schedLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-3">
                {(schedules || []).map((s) => {
                  const hasStats = Object.keys(s.last_stats).length > 0;
                  return (
                    <Card key={s.id}>
                      <CardContent className="p-4 space-y-3">
                        {/* Row 1: status + name + toggle */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            {statusIcon(s.last_status)}
                            <span className="text-sm font-medium truncate">{s.key.replace(/_/g, ' ')}</span>
                          </div>
                          <Switch
                            checked={s.enabled}
                            onCheckedChange={(v) => handleToggle(s.key, v)}
                          />
                        </div>

                        {/* Row 2: cadence + last run */}
                        <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
                          <Badge variant="outline" className="text-[10px]">{s.cadence}</Badge>
                          <span>
                            {s.last_run_at
                              ? formatDistanceToNow(new Date(s.last_run_at), { addSuffix: true })
                              : 'never run'}
                          </span>
                        </div>

                        {/* Row 3: stats (collapsed if empty) */}
                        {hasStats && (
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            {Object.entries(s.last_stats).map(([k, v]) => `${k}: ${v}`).join(' · ')}
                          </p>
                        )}

                        {/* Row 4: action */}
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs w-full"
                          disabled={runningKey === s.key}
                          onClick={() => handleRunNow(s.key)}
                        >
                          {runningKey === s.key ? (
                            <Loader2 className="w-3 h-3 animate-spin mr-1" />
                          ) : (
                            <Play className="w-3 h-3 mr-1" />
                          )}
                          Run Now
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* ── HEALTH EVENTS TAB ── */}
          <TabsContent value="health-events" className="space-y-3">
            <div className="flex items-center gap-3">
              <Select value={healthFilter} onValueChange={setHealthFilter}>
                <SelectTrigger className="w-[240px]">
                  <SelectValue placeholder="Filter by schedule" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All schedules</SelectItem>
                  {(schedules || []).map((s) => (
                    <SelectItem key={s.key} value={s.key}>{s.key}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Card>
              <CardContent className="pt-4">
                {heLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                ) : !healthEvents || healthEvents.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No health events recorded yet.</p>
                ) : (
                  <div className="space-y-2 max-h-[500px] overflow-y-auto">
                    {healthEvents.map((he) => (
                      <div key={he.id} className="p-3 rounded-lg border space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            {statusIcon(he.status)}
                            <span className="text-sm font-medium truncate">{he.schedule_key.replace(/_/g, ' ')}</span>
                          </div>
                          <span className="text-[11px] text-muted-foreground whitespace-nowrap shrink-0">
                            {formatDistanceToNow(new Date(he.occurred_at), { addSuffix: true })}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          {Object.entries(he.stats || {}).map(([k, v]) => `${k}: ${v}`).join(' · ')}
                        </p>
                        {he.error && (
                          <p className="text-xs text-destructive">
                            {JSON.stringify(he.error).slice(0, 200)}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── FLYWHEEL PROOF TAB ── */}
          <TabsContent value="flywheel" className="space-y-4">
            <FlywheelProof />
          </TabsContent>

          {/* ── LEGACY METRICS TAB ── */}
          <TabsContent value="legacy" className="space-y-4">
            <LegacyMetrics data={data} error={error} isLoading={isLoading} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

/* ── Flywheel Proof Panel ── */
function FlywheelProof() {
  const { data: schedules } = useOperatorSchedules();
  const { data: healthEvents } = useSystemHealthEvents(undefined, 100);

  // Compute flywheel metrics from schedules + health events
  const rollupSchedule = schedules?.find(s => s.key === 'testimonium_rollup_weekly');
  const nriSchedule = schedules?.find(s => s.key === 'nri_generate_signals_weekly');
  const operatorSchedule = schedules?.find(s => s.key === 'operator_refresh_daily');

  const recentOk = (healthEvents || []).filter(e => e.status === 'ok').length;
  const recentErrors = (healthEvents || []).filter(e => e.status === 'error').length;

  const getStatValue = (schedule: any, key: string) => {
    if (!schedule?.last_stats) return 0;
    return (schedule.last_stats as Record<string, number>)[key] ?? 0;
  };

  const metrics = [
    { label: 'Rollups Written', value: getStatValue(rollupSchedule, 'rollups_written'), icon: BarChart3 },
    { label: 'Flags Created', value: getStatValue(rollupSchedule, 'flags_created'), icon: TrendingUp },
    { label: 'NRI Signals Generated', value: getStatValue(nriSchedule, 'signals_generated'), icon: Sparkles },
    { label: 'NRI Signals (7d)', value: getStatValue(operatorSchedule, 'nri_signals_7d'), icon: Sparkles },
    { label: 'Drift Flags (7d)', value: getStatValue(operatorSchedule, 'drift_flags_7d'), icon: TrendingUp },
    { label: 'Healthy Runs (recent)', value: recentOk, icon: CheckCircle2 },
    { label: 'Failed Runs (recent)', value: recentErrors, icon: XCircle },
  ];

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {metrics.map((m) => {
          const Icon = m.icon;
          return (
            <Card key={m.label}>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <Icon className="w-3.5 h-3.5" />
                  {m.label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{m.value}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Key Schedule Timestamps</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[rollupSchedule, nriSchedule, operatorSchedule].filter(Boolean).map((s) => (
              <div key={s!.key} className="flex items-center justify-between py-1.5 border-b last:border-0">
                <div className="flex items-center gap-2">
                  {statusIcon(s!.last_status)}
                  <span className="font-mono text-xs">{s!.key}</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {s!.last_run_at
                    ? formatDistanceToNow(new Date(s!.last_run_at), { addSuffix: true })
                    : 'never'}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </>
  );
}

function statusIcon(status: string | null) {
  if (status === 'ok') return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
  if (status === 'warning') return <AlertCircle className="w-4 h-4 text-amber-500" />;
  if (status === 'error') return <XCircle className="w-4 h-4 text-destructive" />;
  return <Clock className="w-4 h-4 text-muted-foreground" />;
}

/* ── Legacy Metrics (original System Health content) ── */
function LegacyMetrics({ data, error, isLoading }: { data: any; error: any; isLoading: boolean }) {
  if (isLoading) return <Loader2 className="w-5 h-5 animate-spin mx-auto" />;
  if (error || !data) return <p className="text-destructive text-center">Failed to load legacy metrics.</p>;

  const { automation, pulse, narrative, drift } = data;

  return (
    <div className="space-y-6">
      {/* Automation Health */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" />
          Automation Health
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <MetricCard label="Runs (24h)" value={automation.runs_24h} />
          <MetricCard label="Processed" value={automation.processed_24h} variant="success" />
          <MetricCard label="Failed" value={automation.failed_24h} variant={automation.failed_24h > 0 ? 'danger' : 'default'} />
          <MetricCard label="Rate Limited" value={automation.rate_limited_24h} variant={automation.rate_limited_24h > 0 ? 'warning' : 'default'} />
          <MetricCard label="Skipped (dedup)" value={automation.skipped_24h} />
          <MetricCard label="Stuck Runs" value={automation.stuck_runs} variant={automation.stuck_runs > 0 ? 'danger' : 'default'} />
        </div>
      </section>

      {/* Narrative Engine */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Brain className="h-5 w-5 text-primary" />
          Narrative Engine
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <MetricCard label="Metros w/ Narratives" value={narrative.total_metros_with_narratives} />
          <MetricCard label="Rebuilt This Week" value={narrative.rebuilt_this_week} />
          <MetricCard label="Cache Hits" value={narrative.cached_metros} variant="success" />
        </div>
      </section>

      {/* Local Pulse */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Radio className="h-5 w-5 text-primary" />
          Local Pulse Health
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Active Sources</CardTitle><Wifi className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{pulse.active_sources}</div></CardContent></Card>
          <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Auto-Disabled</CardTitle><WifiOff className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className={`text-2xl font-bold ${pulse.disabled_sources > 0 ? 'text-amber-600' : ''}`}>{pulse.disabled_sources}</div></CardContent></Card>
          <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Retrying</CardTitle><RefreshCw className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{pulse.retrying_sources}</div></CardContent></Card>
          <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Last Crawl</CardTitle><Server className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-sm font-medium">{pulse.last_crawl_at ? formatRelativeTime(pulse.last_crawl_at) : '—'}</div></CardContent></Card>
        </div>
      </section>

      {/* Drift Detection */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          Drift Detection
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <MetricCard label="Total Drift Scores" value={drift.total_scores} />
          <MetricCard label="Scored This Week" value={drift.scored_this_week} />
          <MetricCard label="Avg Drift Score" value={drift.avg_drift ?? 0} suffix="/100" />
        </div>
      </section>
    </div>
  );
}

/* ── Reusable metric card ── */
interface MetricCardProps {
  label: string;
  value: number;
  variant?: 'default' | 'success' | 'warning' | 'danger';
  suffix?: string;
}

function MetricCard({ label, value, variant = 'default', suffix }: MetricCardProps) {
  const colorClass =
    variant === 'success' ? 'text-emerald-600 dark:text-emerald-400' :
    variant === 'warning' ? 'text-amber-600 dark:text-amber-400' :
    variant === 'danger' ? 'text-destructive' :
    '';

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${colorClass}`}>
          {value}{suffix && <span className="text-sm text-muted-foreground ml-1">{suffix}</span>}
        </div>
      </CardContent>
    </Card>
  );
}
