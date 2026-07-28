/**
 * OperatorLumenPage — Quiet foresight dashboard.
 *
 * WHAT: Displays emerging Lumen signals with calm narrative cards, timeline, and filters.
 * WHERE: /operator/nexus/lumen
 * WHY: Operators see what is forming before it becomes a problem.
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Compass,
  TrendingDown,
  Clock,
  AlertTriangle,
  Users,
  Globe,
  Zap,
  CheckCircle2,
  Filter,
} from 'lucide-react';
import { buildLumenNarrative } from '@/lib/operator/buildLumenNarrative';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { LivingSystemPatternsPanel } from '@/components/operator/LivingSystemPatternsPanel';
import { OperatorEcosystemRhythms } from '@/components/operator/communio/OperatorEcosystemRhythms';

const signalIcons: Record<string, React.ElementType> = {
  drift_risk: TrendingDown,
  activation_delay: Clock,
  migration_fragility: AlertTriangle,
  volunteer_dropoff: Users,
  expansion_ready: Globe,
  narrative_surge: Zap,
  capacity_growth: Users,
};

const signalLabels: Record<string, string> = {
  drift_risk: 'Needs Care',
  activation_delay: 'Slow Sprouting',
  migration_fragility: 'Needs Attention',
  volunteer_dropoff: 'Rhythm Shifting',
  expansion_ready: 'New Growth',
  narrative_surge: 'Momentum Rising',
  capacity_growth: 'New Leaders Emerging',
};

const severityColors: Record<string, string> = {
  low: 'bg-muted text-muted-foreground',
  medium: 'bg-accent text-accent-foreground',
  high: 'bg-primary/15 text-primary',
};

const ALL_TYPES = ['drift_risk', 'activation_delay', 'migration_fragility', 'volunteer_dropoff', 'expansion_ready', 'narrative_surge'];

export default function OperatorLumenPage() {
  const [typeFilter, setTypeFilter] = useState<string>('all');

  const { data: signals, isLoading } = useQuery({
    queryKey: ['lumen-signals', typeFilter],
    queryFn: async () => {
      let q = supabase
        .from('lumen_signals')
        .select('*, tenants:tenant_id(name), metros:metro_id(metro)')
        .eq('resolved', false)
        .order('last_updated_at', { ascending: false })
        .limit(100);

      if (typeFilter !== 'all') q = q.eq('signal_type', typeFilter);

      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const { data: resolvedCount } = useQuery({
    queryKey: ['lumen-resolved-count'],
    queryFn: async () => {
      const { count } = await supabase
        .from('lumen_signals')
        .select('*', { count: 'exact', head: true })
        .eq('resolved', true);
      return count ?? 0;
    },
  });

  const typeCounts = (signals || []).reduce((acc: Record<string, number>, s: any) => {
    acc[s.signal_type] = (acc[s.signal_type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Compass className="w-5 h-5 text-primary" />
          <h1 className="text-xl font-semibold text-foreground font-serif">Lumen — Early Signals</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Patterns of growth, drift, and momentum across communities.
        </p>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-2xl font-semibold font-serif text-foreground">{signals?.length ?? '—'}</p>
            <p className="text-xs text-muted-foreground mt-1">Active Signals</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-2xl font-semibold font-serif text-foreground">
              {signals?.filter((s: any) => s.severity === 'high').length ?? '—'}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Worth Attention</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-2xl font-semibold font-serif text-foreground">
              {Object.keys(typeCounts).length}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Signal Types</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-2xl font-semibold font-serif text-foreground">{resolvedCount ?? '—'}</p>
            <p className="text-xs text-muted-foreground mt-1">Resolved</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <Filter className="w-4 h-4 text-muted-foreground" />
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All signal types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All signal types</SelectItem>
            {ALL_TYPES.map(t => (
              <SelectItem key={t} value={t}>{signalLabels[t] || t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Signal Cards */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32" />)}
        </div>
      ) : signals && signals.length > 0 ? (
        <div className="space-y-3">
          {signals.map((sig: any) => {
            const Icon = signalIcons[sig.signal_type] || Compass;
            const label = signalLabels[sig.signal_type] || sig.signal_type;
            const narrative = buildLumenNarrative({
              signal_type: sig.signal_type,
              severity: sig.severity,
              confidence: sig.confidence,
              source_summary: sig.source_summary || {},
              tenant_name: sig.tenants?.name,
              metro_name: sig.metros?.metro,
            });

            return (
              <Card key={sig.id} className="hover:border-primary/20 transition-colors">
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-muted shrink-0 mt-0.5">
                      <Icon className="w-4 h-4 text-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1.5">
                        <span className="text-sm font-semibold text-foreground font-serif">{label}</span>
                        <Badge className={severityColors[sig.severity] || severityColors.low} variant="secondary">
                          {sig.severity}
                        </Badge>
                        {sig.tenants?.name && (
                          <span className="text-xs text-muted-foreground">· {sig.tenants.name}</span>
                        )}
                        {sig.metros?.metro && (
                          <span className="text-xs text-muted-foreground">· {sig.metros.metro}</span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed">{narrative}</p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              <span>Confidence: {Math.round(sig.confidence * 100)}%</span>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Deterministic confidence based on weighted signal inputs</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        <span>·</span>
                        <span>First seen {new Date(sig.first_detected_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="pt-8 pb-8 text-center">
            <CheckCircle2 className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground font-serif">
              All is quiet across the network. No emerging patterns right now.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Living System Patterns */}
      <LivingSystemPatternsPanel />

      {/* Ecosystem Rhythms — Communio Awareness */}
      <OperatorEcosystemRhythms />

      {/* Timeline */}
      {signals && signals.length > 0 && (
        <section>
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">Signal Timeline</h2>
          <div className="border-l-2 border-border ml-4 space-y-4">
            {signals.slice(0, 10).map((sig: any) => {
              const Icon = signalIcons[sig.signal_type] || Compass;
              return (
                <div key={sig.id} className="relative pl-6">
                  <div className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-card border-2 border-border flex items-center justify-center">
                    <Icon className="w-2.5 h-2.5 text-muted-foreground" />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {new Date(sig.last_updated_at).toLocaleDateString()} — {signalLabels[sig.signal_type] || sig.signal_type}
                    {sig.tenants?.name ? ` · ${sig.tenants.name}` : ''}
                  </p>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
