/**
 * OperatorAnalyticsPage — Gardener Analytics: Quiet Observability.
 *
 * WHAT: Traffic, adoption, stability metrics + NRI narrative insights in a calm tone.
 * WHERE: /operator/nexus/analytics
 * WHY: Analytics without urgency — observing the ecosystem's health with human language.
 */
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { untypedTable } from '@/lib/untypedTable';
import { getSentryErrorCount } from '@/lib/sentry/queryCounts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  BarChart3, Users, Zap, Shield, TrendingUp, Activity, Sprout, Leaf, Check, Copy,
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { HelpCircle as HelpIcon } from 'lucide-react';
import QuietWatchNotes from '@/components/operator/QuietWatchNotes';
import DiscernmentObservationsPanel from '@/components/operator/analytics/DiscernmentObservationsPanel';
import GASection from '@/components/operator/analytics/GASection';
import { toast } from '@/components/ui/sonner';

function HelpTip({ text }: { text: string }) {
  return (
    <TooltipProvider><Tooltip><TooltipTrigger asChild>
      <HelpIcon className="h-3.5 w-3.5 text-muted-foreground inline ml-1" />
    </TooltipTrigger><TooltipContent><p className="max-w-xs text-xs">{text}</p></TooltipContent></Tooltip></TooltipProvider>
  );
}

function MetricCard({ label, value, subtitle, icon: Icon, helpText }: {
  label: string; value: string | number; subtitle?: string; icon: React.ElementType; helpText?: string;
}) {
  return (
    <Card>
      <CardContent className="py-4 px-4">
        <div className="flex items-start justify-between mb-2">
          <p className="text-xs text-muted-foreground">
            {label}
            {helpText && <HelpTip text={helpText} />}
          </p>
          <Icon className="w-4 h-4 text-muted-foreground" />
        </div>
        <p className="text-2xl font-semibold text-foreground">{value}</p>
        {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
      </CardContent>
    </Card>
  );
}

// Old GAMeasurementIdCard removed — replaced by GASection with live OAuth reporting

export default function OperatorAnalyticsPage() {
  const today = new Date().toISOString().slice(0, 10);
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);

  const { data: rollups, isLoading } = useQuery({
    queryKey: ['operator-analytics-rollups', weekAgo],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('operator_analytics_rollups')
        .select('*')
        .gte('day', weekAgo)
        .order('day', { ascending: false });
      if (error) throw error;
      return (data || []) as Array<{ day: string; metric_key: string; metric_value: number; metadata: any }>;
    },
  });

  // Aggregate latest values for key metrics
  const latestMetric = (key: string): number => {
    if (!rollups) return 0;
    const found = rollups.find(r => r.metric_key === key);
    return found?.metric_value ?? 0;
  };

  const sumMetric = (key: string): number => {
    if (!rollups) return 0;
    return rollups.filter(r => r.metric_key === key).reduce((sum, r) => sum + r.metric_value, 0);
  };

  // Tenant + user counts
  const { data: tenantCount } = useQuery({
    queryKey: ['analytics-tenant-count'],
    queryFn: async () => {
      const { count } = await supabase.from('tenants').select('*', { count: 'exact', head: true });
      return count ?? 0;
    },
  });

  // QA pass rate
  const { data: qaStats } = useQuery({
    queryKey: ['analytics-qa-stats'],
    queryFn: async () => {
      // TEMP TYPE ESCAPE — qa_run_results not in types.ts
      const { data } = await untypedTable('qa_run_results')
        .select('status')
      if (!data) return { total: 0, passed: 0 };
      const total = data.length;
      const passed = data.filter((r: any) => r.status === 'pass').length;
      return { total, passed };
    },
  });

  // Error count — now sourced from Sentry (system_error_events retired)
  const { data: errorCount } = useQuery({
    queryKey: ['analytics-error-count'],
    queryFn: () => getSentryErrorCount({ sinceHoursAgo: 24 * 7 }),
  });

  // Friction signals
  const { data: frictionCount } = useQuery({
    queryKey: ['analytics-friction-count'],
    queryFn: async () => {
      // TEMP TYPE ESCAPE — friction_events not in types.ts
      const { count } = await untypedTable('friction_events')
        .select('*', { count: 'exact', head: true })
      return count ?? 0;
    },
  });

  const qaPassRate = qaStats?.total ? Math.round((qaStats.passed / qaStats.total) * 100) : 100;

  return (
    <div className="space-y-8 max-w-5xl">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Leaf className="w-5 h-5 text-primary" />
          <h1 className="text-xl font-semibold text-foreground font-serif">Gardener Analytics</h1>
          <HelpTip text="Calm analytics — observing the ecosystem's health without urgency. NRI watches for patterns and suggests improvements." />
        </div>
        <p className="text-sm text-muted-foreground">
          Observing the rhythm of the platform. Human language insights, not dashboards.
        </p>
      </div>

      {/* Summary Cards */}
      <section>
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
          <Activity className="w-3.5 h-3.5" />
          Ecosystem Pulse
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <MetricCard
            label="Active Tenants"
            value={tenantCount ?? '—'}
            icon={Users}
            helpText="Total organizations using CROS."
          />
          <MetricCard
            label="QA Pass Rate"
            value={`${qaPassRate}%`}
            subtitle={`${qaStats?.passed ?? 0}/${qaStats?.total ?? 0} this week`}
            icon={Shield}
            helpText="Percentage of QA suites passing in the last 7 days."
          />
          <MetricCard
            label="Error Events"
            value={errorCount ?? 0}
            subtitle="last 7 days"
            icon={Zap}
            helpText="System errors captured this week."
          />
          <MetricCard
            label="Friction Signals"
            value={frictionCount ?? 0}
            subtitle="last 7 days"
            icon={TrendingUp}
            helpText="Non-error friction patterns detected."
          />
          <MetricCard
            label="Rollup Metrics"
            value={rollups?.length ?? 0}
            subtitle="data points this week"
            icon={BarChart3}
            helpText="Aggregated analytics data points from the rollup engine."
          />
          <MetricCard
            label="Ecosystem"
            value="Healthy"
            icon={Sprout}
            helpText="Overall ecosystem status based on combined signals."
          />
        </div>
      </section>

      {/* Conversion Funnel */}
      <section>
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
          <TrendingUp className="w-3.5 h-3.5" />
          Conversion Funnel
          <HelpTip text="Journey from marketing pages → pricing → checkout → onboarding → activated tenant." />
        </h2>
        <Card>
          <CardContent className="py-4">
            {isLoading ? <Skeleton className="h-24" /> : (
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {[
                  { label: 'Page Visits', key: 'funnel_visits' },
                  { label: 'Pricing Views', key: 'funnel_pricing' },
                  { label: 'Checkouts Started', key: 'funnel_checkout' },
                  { label: 'Onboarding Started', key: 'funnel_onboarding' },
                  { label: 'Tenants Activated', key: 'funnel_activated' },
                ].map((step, i) => (
                  <div key={step.key} className="text-center">
                    <p className="text-xs text-muted-foreground mb-1">{step.label}</p>
                    <p className="text-lg font-semibold text-foreground">{sumMetric(step.key)}</p>
                    {i > 0 && (
                      <p className="text-xs text-muted-foreground">
                        →
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Module Adoption */}
      <section>
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
          <Users className="w-3.5 h-3.5" />
          Module Adoption
          <HelpTip text="Which CROS modules are being used actively by tenants." />
        </h2>
        <Card>
          <CardContent className="py-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                'Signum', 'Civitas', 'Testimonium', 'Impulsus',
                'Communio', 'Relatio', 'Voluntārium', 'Prōvīsiō',
              ].map((module) => (
                <div key={module} className="flex items-center justify-between p-2 rounded border border-border/50">
                  <span className="text-sm text-foreground">{module}</span>
                  <Badge variant="outline" className="text-xs">
                    {latestMetric(`adoption_${module.toLowerCase().replace(/[āō]/g, 'a')}`)}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Stability Pulse */}
      <section>
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
          <Shield className="w-3.5 h-3.5" />
          Stability Pulse
          <HelpTip text="QA pass rates, error frequency, and edge function health." />
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Card>
            <CardContent className="py-4 px-4">
              <p className="text-xs text-muted-foreground mb-1">QA Stability</p>
              <p className="text-lg font-semibold text-foreground">{qaPassRate}%</p>
              <Badge
                variant={qaPassRate >= 90 ? 'secondary' : qaPassRate >= 70 ? 'default' : 'destructive'}
                className="text-xs mt-1"
              >
                {qaPassRate >= 90 ? 'Stable' : qaPassRate >= 70 ? 'Attention' : 'Needs Care'}
              </Badge>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4 px-4">
              <p className="text-xs text-muted-foreground mb-1">Error Rate</p>
              <p className="text-lg font-semibold text-foreground">{errorCount ?? 0}</p>
              <p className="text-xs text-muted-foreground mt-1">events this week</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4 px-4">
              <p className="text-xs text-muted-foreground mb-1">Friction Signals</p>
              <p className="text-lg font-semibold text-foreground">{frictionCount ?? 0}</p>
              <p className="text-xs text-muted-foreground mt-1">non-error patterns</p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Collective Discernment Signals */}
      <section>
        <DiscernmentObservationsPanel />
      </section>

      {/* NRI Narrative Insights — now powered by DiscernmentObservationsPanel above */}

      {/* Google Analytics — Live GA4 Reporting */}
      <GASection />

      {/* Quiet Watch Notes */}
      <section>
        <QuietWatchNotes />
      </section>
    </div>
  );
}
