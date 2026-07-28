/**
 * FederationAnalyticsPage — Federation-wide GA4 + Stripe + Health aggregator.
 *
 * WHAT: Single-pane-of-glass view across all 22 federation apps with three tabs:
 *       Web Vitals (GA4 sessions/users/pageviews), Revenue (Stripe + tenant stats),
 *       and Health (firing vs silent vs error audit grid).
 * WHERE: /operator/nexus/federation-analytics (Scientia zone)
 * WHY: GA4 navigation is painful — gardener needs one place to see if tracking
 *      is installed across the federation and which apps are silent.
 *
 * BACKEND: calls `federation-ga-report` edge function (parallel-fetches 22 GA
 *          properties, classifies firing/silent/error, returns aggregated totals).
 *          Reuses gardener_ga_connections OAuth from schola-ga-report.
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  BarChart3, Globe, Users, Activity, AlertCircle, CheckCircle2,
  Circle, ExternalLink, RefreshCw, DollarSign, TrendingUp, HelpCircle as HelpIcon,
} from 'lucide-react';
import { toast } from '@/components/ui/sonner';

// ─────────────────────────────────────
// TYPES (mirror edge function response)
// ─────────────────────────────────────

type AppHealth = 'firing' | 'silent' | 'error';
type AppStatus = 'firing' | 'silent' | 'error' | 'unmapped';

interface PerAppMetrics {
  sessions: number;
  users: number;
  pageviews: number;
  avgDuration?: number;
  bounceRate?: number;
}

interface FederationAppReport {
  slug: string | null;
  display_name: string;
  primary_domain: string | null;
  property_id: string;
  link_status: 'linked' | 'orphan';
  status: string | null;
  d7: PerAppMetrics;
  d28: PerAppMetrics;
  health: AppHealth;
  error?: string;
}

interface FederationGAReport {
  ok: boolean;
  generated_at: string;
  connectedEmail?: string;
  apps: FederationAppReport[];
  totals: {
    d7: { sessions: number; users: number; pageviews: number };
    d28: { sessions: number; users: number; pageviews: number };
    counts: { total: number; firing: number; silent: number; errored: number; orphans: number };
  };
  error?: string;
}

// ─────────────────────────────────────
// HELPERS
// ─────────────────────────────────────

function HelpTip({ text }: { text: string }) {
  return (
    <TooltipProvider><Tooltip><TooltipTrigger asChild>
      <HelpIcon className="h-3.5 w-3.5 text-muted-foreground inline ml-1" />
    </TooltipTrigger><TooltipContent><p className="max-w-xs text-xs">{text}</p></TooltipContent></Tooltip></TooltipProvider>
  );
}

function MetricCard({ label, value, subtitle, icon: Icon, helpText, tone }: {
  label: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
  helpText?: string;
  tone?: 'good' | 'warn' | 'bad' | 'neutral';
}) {
  const toneClass =
    tone === 'good' ? 'text-emerald-600 dark:text-emerald-400' :
    tone === 'warn' ? 'text-amber-600 dark:text-amber-400' :
    tone === 'bad'  ? 'text-rose-600 dark:text-rose-400' :
                      'text-foreground';
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
        <p className={`text-2xl font-semibold ${toneClass}`}>{value}</p>
        {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: AppStatus }) {
  const config = {
    firing:   { label: 'Firing',   className: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20', icon: CheckCircle2 },
    silent:   { label: 'Silent',   className: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20', icon: Circle },
    error:    { label: 'Error',    className: 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20', icon: AlertCircle },
    unmapped: { label: 'Orphan',   className: 'bg-muted text-muted-foreground border-border', icon: Circle },
  }[status];
  const Icon = config.icon;
  return (
    <Badge variant="outline" className={`text-xs ${config.className}`}>
      <Icon className="w-3 h-3 mr-1" />
      {config.label}
    </Badge>
  );
}

// ─────────────────────────────────────
// PAGE
// ─────────────────────────────────────

export default function FederationAnalyticsPage() {
  const [activeTab, setActiveTab] = useState<'web-vitals' | 'revenue' | 'health'>('web-vitals');

  const { data: report, isLoading, error, refetch, isFetching } = useQuery<FederationGAReport>({
    queryKey: ['federation-ga-report'],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Not authenticated');

      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/federation-ga-report`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`federation-ga-report failed: ${res.status} ${text}`);
      }
      return res.json();
    },
    refetchInterval: 5 * 60 * 1000, // 5 min
    staleTime: 2 * 60 * 1000,        // 2 min
  });

  // Tenant + revenue stats (from operator_tenant_stats / tenants if available)
  const { data: revenueStats } = useQuery({
    queryKey: ['federation-revenue-stats'],
    queryFn: async () => {
      const { count: tenantCount } = await supabase
        .from('tenants')
        .select('*', { count: 'exact', head: true });
      return { tenantCount: tenantCount ?? 0 };
    },
  });

  const handleRefresh = async () => {
    toast.info('Refreshing federation GA report…');
    await refetch();
    toast.success('Refreshed');
  };

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Globe className="w-5 h-5 text-primary" />
            <h1 className="text-xl font-semibold text-foreground font-serif">Federation Analytics</h1>
            <HelpTip text="Single-pane view across all 22 federation apps. Web Vitals = GA4 traffic. Revenue = Stripe + tenant stats. Health = which apps have GA installed and firing." />
          </div>
          <p className="text-sm text-muted-foreground">
            One place to see traffic, revenue, and tracking health across every CROS app.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={isFetching}
        >
          <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Summary cards (always visible above tabs) */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <MetricCard
          label="Apps Firing"
          value={isLoading ? '—' : `${report?.totals.counts.firing ?? 0}/${report?.totals.counts.total ?? 0}`}
          icon={CheckCircle2}
          tone={report && report.totals.counts.firing > 0 ? 'good' : 'warn'}
          helpText="Apps with at least one session in the last 7 or 28 days."
        />
        <MetricCard
          label="Silent Apps"
          value={isLoading ? '—' : (report?.totals.counts.silent ?? 0)}
          icon={Circle}
          tone={(report?.totals.counts.silent ?? 0) > 0 ? 'warn' : 'good'}
          helpText="GA4 property exists but zero sessions. Usually means Measurement ID isn't installed in the app's frontend."
        />
        <MetricCard
          label="Errors"
          value={isLoading ? '—' : (report?.totals.counts.errored ?? 0)}
          icon={AlertCircle}
          tone={(report?.totals.counts.errored ?? 0) > 0 ? 'bad' : 'good'}
          helpText="GA API threw an error for these properties."
        />
        <MetricCard
          label="7-Day Sessions"
          value={isLoading ? '—' : (report?.totals.d7.sessions ?? 0).toLocaleString()}
          icon={Activity}
          helpText="Total sessions across the entire federation in the last 7 days."
        />
        <MetricCard
          label="7-Day Users"
          value={isLoading ? '—' : (report?.totals.d7.users ?? 0).toLocaleString()}
          icon={Users}
          helpText="Active users across all firing apps."
        />
        <MetricCard
          label="Active Tenants"
          value={revenueStats?.tenantCount ?? '—'}
          icon={TrendingUp}
          helpText="Total tenants across the federation."
        />
      </div>

      {error && (
        <Card className="border-rose-500/30 bg-rose-500/5">
          <CardContent className="py-4">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-rose-700 dark:text-rose-400">
                  Federation GA report failed
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {(error as Error).message}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  If you see "no GA connection," visit the Analytics page first to authorize Google Analytics.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="web-vitals">
            <Activity className="w-3.5 h-3.5 mr-1.5" />
            Web Vitals
          </TabsTrigger>
          <TabsTrigger value="revenue">
            <DollarSign className="w-3.5 h-3.5 mr-1.5" />
            Revenue
          </TabsTrigger>
          <TabsTrigger value="health">
            <BarChart3 className="w-3.5 h-3.5 mr-1.5" />
            Health
          </TabsTrigger>
        </TabsList>

        {/* WEB VITALS TAB */}
        <TabsContent value="web-vitals" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Activity className="w-4 h-4" />
                Per-App Traffic (7d / 28d)
                <HelpTip text="Sessions, users, and pageviews per app for the last 7 and 28 days. Sorted by 7d sessions descending." />
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-12 w-full" />)}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-xs text-muted-foreground">
                        <th className="text-left py-2 px-2 font-medium">App</th>
                        <th className="text-left py-2 px-2 font-medium">Status</th>
                        <th className="text-right py-2 px-2 font-medium">7d Sessions</th>
                        <th className="text-right py-2 px-2 font-medium">7d Users</th>
                        <th className="text-right py-2 px-2 font-medium">7d Pageviews</th>
                        <th className="text-right py-2 px-2 font-medium">28d Sessions</th>
                        <th className="text-right py-2 px-2 font-medium">Property</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(report?.apps ?? []).filter(a => a.link_status === 'linked').map(app => (
                        <tr key={app.property_id} className="border-b border-border/50 hover:bg-muted/30">
                          <td className="py-2 px-2">
                            <div className="font-medium text-foreground">{app.display_name}</div>
                            <div className="text-xs text-muted-foreground">{app.slug ?? '—'}</div>
                          </td>
                          <td className="py-2 px-2"><StatusBadge status={app.health} /></td>
                          <td className="py-2 px-2 text-right tabular-nums">{app.d7.sessions.toLocaleString()}</td>
                          <td className="py-2 px-2 text-right tabular-nums">{app.d7.users.toLocaleString()}</td>
                          <td className="py-2 px-2 text-right tabular-nums">{app.d7.pageviews.toLocaleString()}</td>
                          <td className="py-2 px-2 text-right tabular-nums text-muted-foreground">{app.d28.sessions.toLocaleString()}</td>
                          <td className="py-2 px-2 text-right">
                            {app.property_id ? (
                              <a
                                href={`https://analytics.google.com/analytics/web/#/p${app.property_id}/reports`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                              >
                                {app.property_id}
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Orphan GA properties */}
          {report && report.totals.counts.orphans > 0 && (
            <Card className="mt-4">
              <CardHeader>
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-500" />
                  Orphan GA Properties ({report.totals.counts.orphans})
                  <HelpTip text="GA4 properties under the CROS account that aren't mapped to a federation_apps slug. Either map them or archive in GA." />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {report.apps.filter(a => a.link_status === 'orphan').map(o => (
                    <div key={o.property_id} className="text-xs p-2 rounded border border-border/50">
                      <div className="font-medium">{o.display_name}</div>
                      <div className="text-muted-foreground">{o.property_id} · {o.d7.sessions} sessions (7d)</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* REVENUE TAB */}
        <TabsContent value="revenue" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                Revenue & Activation
                <HelpTip text="Per-app revenue surfaces are wired to Stripe Connect splits. Numbers appear once Stripe webhooks fire for live products." />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-muted-foreground space-y-3">
                <p>
                  Revenue aggregation will populate once Stripe Connect splits go live across the federation.
                  Each app's <code className="text-xs bg-muted px-1 rounded">tenants</code> table contribution is
                  tracked here.
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
                  <MetricCard
                    label="Total Tenants"
                    value={revenueStats?.tenantCount ?? '—'}
                    icon={Users}
                    helpText="Across the federation."
                  />
                  <MetricCard
                    label="Stripe Status"
                    value="Pending"
                    subtitle="webhooks wiring in progress"
                    icon={DollarSign}
                    tone="warn"
                  />
                  <MetricCard
                    label="MRR"
                    value="—"
                    subtitle="Connect splits not live yet"
                    icon={TrendingUp}
                  />
                  <MetricCard
                    label="Trial Conversions"
                    value="—"
                    subtitle="awaiting first cohort"
                    icon={Activity}
                  />
                </div>
                <p className="text-xs text-muted-foreground pt-2">
                  Once Stripe webhooks are firing (see <code className="text-xs bg-muted px-1 rounded">stripe-webhook</code> edge function),
                  this tab will show per-app MRR, new subscriptions, churn, and Connect-split distributions.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* HEALTH TAB */}
        <TabsContent value="health" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <BarChart3 className="w-4 h-4" />
                Tracking Health Audit
                <HelpTip text="Diagnoses which apps actually have GA4 tracking installed in their frontend. Silent = property exists in GA but no traffic = Measurement ID isn't in the app code." />
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-32 w-full" />
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    {(['firing', 'silent', 'error'] as const).map(health => {
                      const apps = (report?.apps ?? []).filter(a => a.health === health && a.link_status === 'linked');
                      if (apps.length === 0) return null;
                      return (
                        <Card key={health} className="border-border/50">
                          <CardContent className="py-3 px-3">
                            <div className="flex items-center justify-between mb-2">
                              <StatusBadge status={health} />
                              <span className="text-xs text-muted-foreground">{apps.length}</span>
                            </div>
                            <ul className="text-xs space-y-1">
                              {apps.map(a => (
                                <li key={a.property_id} className="flex items-center justify-between">
                                  <span className="text-foreground truncate">{a.display_name}</span>
                                  {a.d7.sessions > 0 && (
                                    <span className="text-muted-foreground tabular-nums">{a.d7.sessions}</span>
                                  )}
                                </li>
                              ))}
                            </ul>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>

                  {/* Remediation guidance */}
                  {report && report.totals.counts.silent > 0 && (
                    <Card className="border-amber-500/30 bg-amber-500/5">
                      <CardContent className="py-3 px-4">
                        <div className="flex items-start gap-2">
                          <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                          <div className="text-xs space-y-1">
                            <p className="font-medium text-amber-700 dark:text-amber-400">
                              {report.totals.counts.silent} apps have GA properties but aren't firing.
                            </p>
                            <p className="text-muted-foreground">
                              Most likely cause: the GA4 Measurement ID (G-XXXX) isn't installed in the app's
                              frontend code. Add the gtag snippet (or equivalent) to each silent app's index.html
                              or root layout. See the GA Measurement IDs runbook in the workspace.
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {report && (
        <p className="text-xs text-muted-foreground text-right">
          Generated {new Date(report.generated_at).toLocaleString()}
        </p>
      )}
    </div>
  );
}
