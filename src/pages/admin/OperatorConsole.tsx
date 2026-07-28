import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RefreshCw, Users, Globe, Sparkles, Link2, Heart, Activity, Shield, TrendingUp, HeartPulse, Star, Inbox, Sprout } from 'lucide-react';
import { toast } from '@/components/ui/sonner';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { HelpCircle } from 'lucide-react';
import { CommunioHealthTab } from '@/components/operator/CommunioHealthTab';
import { AdoptionPulsePanel } from '@/components/operator/AdoptionPulsePanel';
import { QuietHealthPanel } from '@/components/operator/QuietHealthPanel';
import { ValueMomentsPanel } from '@/components/operator/ValueMomentsPanel';
import { CommunioMonitorPanel } from '@/components/operator/CommunioMonitorPanel';
import { OnboardingStatusPanel } from '@/components/operator/OnboardingStatusPanel';
import { NarrativeEconomyPanel } from '@/components/operator/NarrativeEconomyPanel';
import { ExportStatsPanel } from '@/components/operator/ExportStatsPanel';
import { CommunioNetworkHealth } from '@/components/operator/CommunioNetworkHealth';
import { EcosystemPulsePanel } from '@/components/operator/EcosystemPulsePanel';
import { ConnectorConfidencePanel } from '@/components/operator/ConnectorConfidencePanel';
import { NarrativeBalanceIndicator } from '@/components/operator/NarrativeBalanceIndicator';
import { IntakeTab } from '@/components/operator/IntakeTab';
import { LeadsByAppPanel } from '@/components/operator/LeadsByAppPanel';
import { EmailComplianceHealthCard } from '@/components/operator/EmailComplianceHealthCard';
import { HelpTooltip } from '@/components/ui/help-tooltip';
const SectionTooltip = HelpTooltip;

export default function OperatorConsole() {
  const [refreshing, setRefreshing] = useState(false);

  const { data: tenantStats, isLoading: loadingTenants, refetch: refetchTenants } = useQuery({
    queryKey: ['operator-tenant-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('operator_tenant_stats')
        .select('*')
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: archetypeMetrics, isLoading: loadingArch, refetch: refetchArch } = useQuery({
    queryKey: ['operator-archetype-metrics'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('operator_archetype_metrics')
        .select('*')
        .order('tenant_count', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: narrativeMetrics, isLoading: loadingNarr, refetch: refetchNarr } = useQuery({
    queryKey: ['operator-narrative-metrics'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('operator_narrative_metrics')
        .select('*')
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: integrationHealth, isLoading: loadingInt, refetch: refetchInt } = useQuery({
    queryKey: ['operator-integration-health'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('operator_integration_health')
        .select('*')
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const { error } = await supabase.functions.invoke('operator-refresh', {
        body: { scope: 'all' },
      });
      if (error) throw error;
      await Promise.all([refetchTenants(), refetchArch(), refetchNarr(), refetchInt()]);
      toast.success('Metrics refreshed');
    } catch (e: any) {
      toast.error(e.message || 'Refresh failed');
    } finally {
      setRefreshing(false);
    }
  };

  // Computed summaries
  const totalTenants = tenantStats?.length ?? 0;
  const communioOptIns = tenantStats?.filter((t) => t.communio_opt_in).length ?? 0;
  const activeArchetypes = new Set(tenantStats?.map((t) => t.archetype) ?? []).size;
  const totalSignals = narrativeMetrics?.reduce((s, n) => s + (n.signal_count ?? 0), 0) ?? 0;

  const narrativeTotals = {
    testimoniumRuns: narrativeMetrics?.reduce((s, n) => s + (n.testimonium_runs ?? 0), 0) ?? 0,
    driftEvents: narrativeMetrics?.reduce((s, n) => s + (n.drift_events ?? 0), 0) ?? 0,
    heatmapUpdates: narrativeMetrics?.reduce((s, n) => s + (n.heatmap_updates ?? 0), 0) ?? 0,
  };

  const statusBadge = (status: string) => {
    const variant = status === 'ok' ? 'default' : status === 'warning' ? 'secondary' : 'destructive';
    return <Badge variant={variant}>{status}</Badge>;
  };

  return (
    <MainLayout title="Gardener Console" subtitle="Seeing the story behind the system.">
      <div className="space-y-6 pb-12">
        {/* Refresh button */}
        <div className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh Metrics
          </Button>
        </div>

        <Tabs defaultValue="overview">
          <TabsList className="flex-wrap">
            <TabsTrigger value="overview" className="gap-1.5">
              <Activity className="h-4 w-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="adoption" className="gap-1.5">
              <TrendingUp className="h-4 w-4" />
              Adoption
            </TabsTrigger>
            <TabsTrigger value="health" className="gap-1.5">
              <HeartPulse className="h-4 w-4" />
              Quiet Health
            </TabsTrigger>
            <TabsTrigger value="moments" className="gap-1.5">
              <Star className="h-4 w-4" />
              Value Moments
            </TabsTrigger>
            <TabsTrigger value="communio" className="gap-1.5">
              <Shield className="h-4 w-4" />
              Communio
            </TabsTrigger>
            <TabsTrigger value="intake" className="gap-1.5">
              <Inbox className="h-4 w-4" />
              Intake
            </TabsTrigger>
            <TabsTrigger value="leads" className="gap-1.5">
              <Sprout className="h-4 w-4" />
              Leads by App
            </TabsTrigger>
          </TabsList>

          {/* ── Overview Tab ── */}
          <TabsContent value="overview" className="mt-6 space-y-8">
            {/* Section A: Tenant Ecosystem */}
            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">
                Tenant Ecosystem
                <SectionTooltip
                  what="High-level counts of tenants, community participation, and narrative activity"
                  where="Aggregated from operator_tenant_stats"
                  why="Confirms the platform is alive and growing"
                />
              </h2>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard title="Total Tenants" value={totalTenants} icon={Users} loading={loadingTenants} />
                <StatCard title="Communio Opt-Ins" value={communioOptIns} icon={Heart} loading={loadingTenants} />
                <StatCard title="Active Archetypes" value={activeArchetypes} icon={Globe} loading={loadingTenants} />
                <StatCard title="Narrative Signals" value={totalSignals} icon={Sparkles} loading={loadingNarr} />
              </div>
            </section>

            {/* Section B: Archetype Pulse */}
            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">
                Archetype Pulse
                <SectionTooltip
                  what="How each archetype is performing across tenants"
                  where="operator_archetype_metrics"
                  why="Understand which mission types adopt fastest"
                />
              </h2>
              {loadingArch ? (
                <Skeleton className="h-40 w-full" />
              ) : archetypeMetrics && archetypeMetrics.length > 0 ? (
                <Card>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Archetype</TableHead>
                          <TableHead className="text-right">Tenants</TableHead>
                          <TableHead className="text-right hidden sm:table-cell">Avg → Reflection</TableHead>
                          <TableHead className="text-right hidden sm:table-cell">Avg → Signal</TableHead>
                          <TableHead className="text-right hidden md:table-cell">Conversion %</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {archetypeMetrics.map((a) => (
                          <TableRow key={a.archetype}>
                            <TableCell className="font-medium capitalize">{a.archetype.replace(/_/g, ' ')}</TableCell>
                            <TableCell className="text-right">{a.tenant_count}</TableCell>
                            <TableCell className="text-right hidden sm:table-cell">
                              {a.avg_days_to_first_reflection ? `${Math.round(Number(a.avg_days_to_first_reflection))}d` : '—'}
                            </TableCell>
                            <TableCell className="text-right hidden sm:table-cell">
                              {a.avg_days_to_first_signal ? `${Math.round(Number(a.avg_days_to_first_signal))}d` : '—'}
                            </TableCell>
                            <TableCell className="text-right hidden md:table-cell">
                              {a.conversion_rate ? `${Math.round(Number(a.conversion_rate))}%` : '—'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground text-sm">
                    No archetype data yet. Refresh metrics to populate.
                  </CardContent>
                </Card>
              )}
            </section>

            {/* Section C: Narrative Flow */}
            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">
                Narrative Flow
                <SectionTooltip
                  what="Testimonium capture activity and drift detection"
                  where="operator_narrative_metrics"
                  why="Confirms the narrative engine is receiving signals"
                />
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <StatCard title="Testimonium Moments" value={narrativeTotals.testimoniumRuns} icon={Activity} loading={loadingNarr} />
                <StatCard title="Drift Events" value={narrativeTotals.driftEvents} icon={Activity} loading={loadingNarr} />
                <StatCard title="Heatmap Updates" value={narrativeTotals.heatmapUpdates} icon={Activity} loading={loadingNarr} />
              </div>
            </section>

            {/* Section D: Integration Health */}
            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">
                Integration Health
                <SectionTooltip
                  what="Status of CRM connectors across tenants"
                  where="operator_integration_health"
                  why="Spot broken or degraded integrations early"
                />
              </h2>
              {loadingInt ? (
                <Skeleton className="h-40 w-full" />
              ) : integrationHealth && integrationHealth.length > 0 ? (
                <Card>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Connector</TableHead>
                          <TableHead>Environment</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Success Rate</TableHead>
                          <TableHead className="text-right hidden sm:table-cell">Errors</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {integrationHealth.map((ih) => (
                          <TableRow key={ih.id}>
                            <TableCell className="font-medium capitalize">{ih.connector_key}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{ih.environment}</Badge>
                            </TableCell>
                            <TableCell>{statusBadge(ih.last_status)}</TableCell>
                            <TableCell className="text-right">{ih.success_rate}%</TableCell>
                            <TableCell className="text-right hidden sm:table-cell">{ih.error_count}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground text-sm">
                    No integration data yet.
                  </CardContent>
                </Card>
              )}
            </section>

            {/* Section E: Ecosystem Pulse */}
            <section>
              <EcosystemPulsePanel />
            </section>

            {/* Section F: Connector Confidence */}
            <section>
              <ConnectorConfidencePanel />
            </section>

            {/* Section G: Narrative Balance */}
            <section>
              <NarrativeBalanceIndicator />
            </section>

            {/* Section I: Email Compliance Health */}
            <section>
              <EmailComplianceHealthCard />
            </section>

            {/* Section H: Communio Network Health */}
            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">
                Communio Network Health
                <SectionTooltip
                  what="Cross-tenant sharing participation and network metrics"
                  where="communio_groups, communio_memberships, communio_shared_signals"
                  why="Track cooperative network growth without exposing private data"
                />
              </h2>
              <CommunioNetworkHealth />
            </section>
          </TabsContent>

          {/* ── Adoption Tab ── */}
          <TabsContent value="adoption" className="mt-6 space-y-6">
            <OnboardingStatusPanel />
            <AdoptionPulsePanel />
            <NarrativeEconomyPanel />
            <ExportStatsPanel />
            <CommunioMonitorPanel />
          </TabsContent>

          {/* ── Quiet Health Tab ── */}
          <TabsContent value="health" className="mt-6">
            <QuietHealthPanel />
          </TabsContent>

          {/* ── Value Moments Tab ── */}
          <TabsContent value="moments" className="mt-6">
            <ValueMomentsPanel />
          </TabsContent>

          {/* ── Communio Health Tab ── */}
          <TabsContent value="communio" className="mt-6">
            <CommunioHealthTab />
          </TabsContent>

          {/* ── Intake Tab ── */}
          <TabsContent value="intake" className="mt-6">
            <IntakeTab />
          </TabsContent>

          {/* ── Leads by App Tab (Cosmos rollup) ── */}
          <TabsContent value="leads" className="mt-6">
            <LeadsByAppPanel />
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}

function StatCard({
  title,
  value,
  icon: Icon,
  loading,
}: {
  title: string;
  value: number;
  icon: React.ElementType;
  loading: boolean;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 py-6">
        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{title}</p>
          {loading ? (
            <Skeleton className="h-6 w-12 mt-1" />
          ) : (
            <p className="text-xl font-bold text-foreground">{value}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
