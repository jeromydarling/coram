/**
 * OperatorPresencePage — Presence Intelligence workflow dashboard.
 *
 * WHAT: Shows how humans use CROS across tenants — visit note volume,
 *       voice vs typed ratios, and calm narrative signals.
 * WHERE: /operator/nexus/presence
 * WHY: Helps the Operator see where presence is growing or quieting
 *       without exposing raw transcripts or audio.
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useVigiliaOverview } from '@/hooks/useVigilia';
import { VigiliaCard } from '@/components/operator/vigilia/VigiliaCard';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Mic,
  Type,
  Users,
  Building2,
  RefreshCw,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Activity,
} from 'lucide-react';
import { calmVariant, calmText } from '@/lib/calmMode';
import { formatDistanceToNow } from 'date-fns';
import { toast } from '@/components/ui/sonner';
import { HelpCircle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

function HelpTip({ text }: { text: string }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <HelpCircle className="w-3.5 h-3.5 text-muted-foreground inline ml-1 cursor-help" />
        </TooltipTrigger>
        <TooltipContent className="max-w-xs text-xs">{text}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function getMonday(d: Date): string {
  const dt = new Date(d);
  const day = dt.getUTCDay();
  const diff = dt.getUTCDate() - day + (day === 0 ? -6 : 1);
  dt.setUTCDate(diff);
  return dt.toISOString().split('T')[0];
}

export default function OperatorPresencePage() {
  const queryClient = useQueryClient();
  const currentWeek = getMonday(new Date());
  const { data: vigilia, isLoading: vigiliaLoading } = useVigiliaOverview();

  // Fetch rollups for current week
  const { data: rollups, isLoading: rollupsLoading } = useQuery({
    queryKey: ['presence-rollups', currentWeek],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('operator_presence_rollups' as any)
        .select('*, tenants:tenant_id(name)')
        .eq('week_start', currentWeek)
        .is('metro_id', null)
        .order('visit_notes_count', { ascending: false });
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  // Fetch signals for current week
  const { data: signals, isLoading: signalsLoading } = useQuery({
    queryKey: ['presence-signals', currentWeek],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('operator_presence_signals' as any)
        .select('*, tenants:tenant_id(name)')
        .eq('week_start', currentWeek)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  // Manual rollup trigger
  const runRollup = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke(
        'operator-presence-rollup-weekly',
        { body: { scope: 'all' } }
      );
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success(`Presence rollup complete — ${data?.processed_tenants ?? 0} tenants processed`);
      queryClient.invalidateQueries({ queryKey: ['presence-rollups'] });
      queryClient.invalidateQueries({ queryKey: ['presence-signals'] });
    },
    onError: (err) => {
      toast.error(`Rollup did not complete: ${(err as Error).message}`);
    },
  });

  // Aggregated stats
  const totalNotes = rollups?.reduce((s, r) => s + (r.visit_notes_count || 0), 0) ?? 0;
  const totalVoice = rollups?.reduce((s, r) => s + (r.visit_notes_voice_count || 0), 0) ?? 0;
  const totalTyped = rollups?.reduce((s, r) => s + (r.visit_notes_typed_count || 0), 0) ?? 0;
  const activeTenants = rollups?.length ?? 0;
  const voicePercent = totalNotes > 0 ? Math.round((totalVoice / totalNotes) * 100) : 0;

  const voiceFirstTenants = signals?.filter((s) => s.signal_type === 'voice_first').length ?? 0;
  const risingTenants = signals?.filter((s) => s.signal_type === 'presence_rising').length ?? 0;

  const isLoading = rollupsLoading || signalsLoading;

  const SIGNAL_ICONS: Record<string, React.ElementType> = {
    voice_first: Mic,
    typed_first: Type,
    presence_rising: TrendingUp,
    presence_falling: TrendingDown,
    healthy_cadence: Activity,
    low_followup_risk: Building2,
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Vigilia Watch Card */}
      <VigiliaCard
        title="The Watch"
        highlights={(vigilia?.highlights ?? []).filter(h => h.category === 'narrative' || h.category === 'communio')}
        tone={vigilia?.tone}
        isLoading={vigiliaLoading}
        compact
        helpText="Narrative awareness signals from across the ecosystem."
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground font-serif">Presence Intelligence</h1>
          <p className="text-sm text-muted-foreground mt-1">
            How humans are using CROS — visit rhythms, voice patterns, and quiet signals.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => runRollup.mutate()}
          disabled={runRollup.isPending}
          className="gap-2 self-start"
        >
          <RefreshCw className={`w-4 h-4 ${runRollup.isPending ? 'animate-spin' : ''}`} />
          Run Rollup Now
        </Button>
      </div>

      {/* Overview Cards */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card>
            <CardContent className="pt-4 pb-3">
              <p className="text-2xl font-semibold text-foreground">{totalNotes}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Visit notes this week
                <HelpTip text="Total Visit Note activities recorded across all tenants for the current week." />
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2">
                <Mic className="w-4 h-4 text-primary" />
                <span className="text-2xl font-semibold text-foreground">{voicePercent}%</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Voice captured
                <HelpTip text="Percentage of visit notes that were recorded via voice rather than typed." />
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-muted-foreground" />
                <span className="text-2xl font-semibold text-foreground">{activeTenants}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Active tenants
                <HelpTip text="Number of tenants with at least one visit note this week." />
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" />
                <span className="text-2xl font-semibold text-foreground">{risingTenants}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Presence rising
                <HelpTip text="Tenants whose visit note count increased by 50% or more compared to last week." />
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Tenant Presence Feed */}
        <div className="lg:col-span-3 space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            Tenant Presence Feed
          </h2>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-20" />
              ))}
            </div>
          ) : rollups && rollups.length > 0 ? (
            <ScrollArea className="max-h-[500px]">
              <div className="space-y-2 pr-2">
                {rollups.map((r: any) => {
                  const tenantName = r.tenants?.name || 'Unknown tenant';
                  const vr =
                    r.visit_notes_count > 0
                      ? Math.round((r.visit_notes_voice_count / r.visit_notes_count) * 100)
                      : 0;
                  const tenantSignals = (signals || []).filter(
                    (s: any) => s.tenant_id === r.tenant_id
                  );

                  return (
                    <Card key={r.id} className="hover:border-primary/20 transition-colors">
                      <CardContent className="pt-4 pb-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">
                              {tenantName}
                            </p>
                            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                              <span>{r.visit_notes_count} notes</span>
                              <span>·</span>
                              <span>{r.unique_users_contributed} contributors</span>
                              <span>·</span>
                              <span>{r.unique_opportunities_touched} partners</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {vr >= 60 && (
                              <Badge variant={calmVariant('ok')} className="text-xs gap-1">
                                <Mic className="w-3 h-3" /> voice-first
                              </Badge>
                            )}
                            {vr > 0 && vr < 60 && (
                              <Badge variant="outline" className="text-xs">
                                {vr}% voice
                              </Badge>
                            )}
                          </div>
                        </div>
                        {tenantSignals.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {tenantSignals.slice(0, 2).map((s: any) => {
                              const SIcon = SIGNAL_ICONS[s.signal_type] || Activity;
                              return (
                                <span
                                  key={s.id}
                                  className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full"
                                >
                                  <SIcon className="w-3 h-3" />
                                  {s.signal_type.replace(/_/g, ' ')}
                                </span>
                              );
                            })}
                          </div>
                        )}
                        {r.last_activity_at && (
                          <p className="text-xs text-muted-foreground mt-2">
                            Last activity{' '}
                            {formatDistanceToNow(new Date(r.last_activity_at), {
                              addSuffix: true,
                            })}
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </ScrollArea>
          ) : (
            <Card>
              <CardContent className="pt-6 pb-6 text-center">
                <p className="text-sm text-muted-foreground">
                  No presence data for this week yet. Run the rollup to aggregate visit notes.
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Signals Panel */}
        <div className="lg:col-span-2 space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            Quiet Signals
            <HelpTip text="Deterministic interpretations of presence patterns — not AI-generated." />
          </h2>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-16" />
              ))}
            </div>
          ) : signals && signals.length > 0 ? (
            <ScrollArea className="max-h-[500px]">
              <div className="space-y-2 pr-2">
                {signals.map((s: any) => {
                  const SIcon = SIGNAL_ICONS[s.signal_type] || Activity;
                  const tenantName = s.tenants?.name || 'Unknown';
                  return (
                    <Card key={s.id} className="border-border/50">
                      <CardContent className="pt-3 pb-3">
                        <div className="flex items-start gap-2">
                          <div className="p-1.5 rounded bg-muted shrink-0 mt-0.5">
                            <SIcon className="w-3.5 h-3.5 text-foreground" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-foreground">{tenantName}</p>
                            <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">
                              {s.summary}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </ScrollArea>
          ) : (
            <Card>
              <CardContent className="pt-6 pb-6 text-center">
                <p className="text-sm text-muted-foreground">
                  No signals detected this week.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
