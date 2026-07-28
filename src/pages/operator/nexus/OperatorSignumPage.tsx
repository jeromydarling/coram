/**
 * OperatorSignumPage — Signum: Human Flow Signals dashboard.
 *
 * WHAT: Aggregated friction intelligence for operators — no raw user data.
 * WHERE: /operator/nexus/friction
 * WHY: Helps operators identify UI bottlenecks through calm, narrative signals.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Activity, Brain, Compass, Heart, Pause, RefreshCcw, Sparkles, TrendingDown } from 'lucide-react';
import { OperatorVigiliaBottleneck } from '@/components/operator/vigilia/OperatorVigiliaBottleneck';
import { FrictionDesignSuggestionsPanel } from '@/components/operator/friction/FrictionDesignSuggestionsPanel';
import { FrictionPlaybookDraftsPanel } from '@/components/operator/friction/FrictionPlaybookDraftsPanel';
import { calmVariant } from '@/lib/calmMode';
import { HelpTooltip } from '@/components/ui/help-tooltip';
const SectionTooltip = HelpTooltip;
import { ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

// ─── Friction Overview Card ─────────────────────────────────
function FrictionOverviewCard() {
  const now7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data, isLoading } = useQuery({
    queryKey: ['signum-overview'],
    queryFn: async () => {
      const [idle, repeat, abandon, help, interventions] = await Promise.all([
        supabase.from('testimonium_events').select('*', { count: 'exact', head: true }).eq('event_kind', 'friction_idle').gte('occurred_at', now7d),
        supabase.from('testimonium_events').select('*', { count: 'exact', head: true }).eq('event_kind', 'friction_repeat_nav').gte('occurred_at', now7d),
        supabase.from('testimonium_events').select('*', { count: 'exact', head: true }).eq('event_kind', 'friction_abandon_flow').gte('occurred_at', now7d),
        supabase.from('testimonium_events').select('*', { count: 'exact', head: true }).eq('event_kind', 'friction_help_open').gte('occurred_at', now7d),
        supabase.from('testimonium_events').select('*', { count: 'exact', head: true }).eq('event_kind', 'assistant_intervention').gte('occurred_at', now7d),
      ]);
      return {
        idle: idle.count ?? 0,
        repeat: repeat.count ?? 0,
        abandon: abandon.count ?? 0,
        help: help.count ?? 0,
        interventions: interventions.count ?? 0,
        total: (idle.count ?? 0) + (repeat.count ?? 0) + (abandon.count ?? 0) + (help.count ?? 0),
      };
    },
  });

  if (isLoading) return <Skeleton className="h-48" />;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Pause className="w-4 h-4 text-muted-foreground" />
          <CardTitle className="text-base font-serif">Flow Overview</CardTitle>
          <SectionTooltip what="Weekly friction event counts" where="testimonium_events" why="Shows where humans slowed down" />
        </div>
        <CardDescription>Where humans paused this week</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3">
          <StatItem label="Idle pauses" value={data?.idle ?? 0} icon={<Pause className="w-3.5 h-3.5" />} />
          <StatItem label="Repeated navigation" value={data?.repeat ?? 0} icon={<RefreshCcw className="w-3.5 h-3.5" />} />
          <StatItem label="Flow abandonments" value={data?.abandon ?? 0} icon={<TrendingDown className="w-3.5 h-3.5" />} />
          <StatItem label="Help requests" value={data?.help ?? 0} icon={<Heart className="w-3.5 h-3.5" />} />
        </div>
        <div className="mt-4 pt-3 border-t flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Assistant interventions</span>
          <Badge variant={calmVariant('ok')} className="text-xs">{data?.interventions ?? 0}</Badge>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Archetype Friction Card ────────────────────────────────
function ArchetypeFrictionCard() {
  const { data, isLoading } = useQuery({
    queryKey: ['signum-archetype-friction'],
    queryFn: async () => {
      const { data: metrics } = await supabase
        .from('operator_narrative_metrics')
        .select('tenant_id, friction_idle_count, friction_repeat_nav_count, friction_abandon_count, top_friction_pages')
        .order('friction_idle_count', { ascending: false })
        .limit(10);
      return metrics ?? [];
    },
  });

  if (isLoading) return <Skeleton className="h-48" />;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4 text-muted-foreground" />
          <CardTitle className="text-base font-serif">Archetype Patterns</CardTitle>
          <SectionTooltip what="Friction distribution across tenants" where="operator_narrative_metrics" why="Identifies archetype-specific pain points" />
        </div>
        <CardDescription>Which contexts create the most hesitation</CardDescription>
      </CardHeader>
      <CardContent>
        {(!data || data.length === 0) ? (
          <p className="text-sm text-muted-foreground italic">No friction patterns recorded yet — that is perfectly fine.</p>
        ) : (
          <div className="space-y-2">
            {data.slice(0, 5).map((row: any, i: number) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground truncate">Tenant {(row.tenant_id as string).slice(0, 8)}…</span>
                <div className="flex gap-2">
                  <Badge variant="outline" className="text-xs">{row.friction_idle_count} idle</Badge>
                  <Badge variant="outline" className="text-xs">{row.friction_repeat_nav_count} repeat</Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── System Weight Card ─────────────────────────────────────
function SystemWeightCard() {
  const now7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data, isLoading } = useQuery({
    queryKey: ['signum-system-weight'],
    queryFn: async () => {
      const { data: events } = await supabase
        .from('testimonium_events')
        .select('event_kind, metadata')
        .in('event_kind', ['friction_abandon_flow', 'friction_repeat_nav'])
        .gte('occurred_at', now7d)
        .limit(200);

      // Aggregate top pages
      const pageCounts: Record<string, number> = {};
      for (const ev of events ?? []) {
        const page = (ev as any).metadata?.page || 'unknown';
        pageCounts[page] = (pageCounts[page] || 0) + 1;
      }
      const sorted = Object.entries(pageCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5);

      return { topPages: sorted, total: events?.length ?? 0 };
    },
  });

  if (isLoading) return <Skeleton className="h-48" />;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Compass className="w-4 h-4 text-muted-foreground" />
          <CardTitle className="text-base font-serif">System Weight</CardTitle>
          <SectionTooltip what="Pages with most repeated or abandoned flows" where="testimonium_events" why="Pinpoints navigation loops and drop-offs" />
        </div>
        <CardDescription>Repeated flows and navigation loops</CardDescription>
      </CardHeader>
      <CardContent>
        {(!data || data.topPages.length === 0) ? (
          <p className="text-sm text-muted-foreground italic">No navigation loops detected — flows are running smoothly.</p>
        ) : (
          <div className="space-y-2">
            {data.topPages.map(([page, count]) => (
              <div key={page} className="flex items-center justify-between text-sm">
                <span className="text-foreground font-mono text-xs truncate max-w-[180px]">{page}</span>
                <Badge variant="outline" className="text-xs">{count} signals</Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Resolution Card ────────────────────────────────────────
function ResolutionCard() {
  const now7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data, isLoading } = useQuery({
    queryKey: ['signum-resolution'],
    queryFn: async () => {
      const [interventions, resolutions] = await Promise.all([
        supabase.from('testimonium_events').select('*', { count: 'exact', head: true }).eq('event_kind', 'assistant_intervention').gte('occurred_at', now7d),
        supabase.from('testimonium_events').select('*', { count: 'exact', head: true }).eq('event_kind', 'assistant_resolution').gte('occurred_at', now7d),
      ]);
      const intv = interventions.count ?? 0;
      const res = resolutions.count ?? 0;
      return {
        interventions: intv,
        resolutions: res,
        rate: intv > 0 ? Math.round((res / intv) * 100) : 0,
      };
    },
  });

  if (isLoading) return <Skeleton className="h-48" />;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-muted-foreground" />
          <CardTitle className="text-base font-serif">Resolution</CardTitle>
          <SectionTooltip what="Assistant intervention success rate" where="testimonium_events" why="Measures how often gentle prompts lead to completion" />
        </div>
        <CardDescription>When the assistant offered, did it help?</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-3">
          <StatItem label="Offered" value={data?.interventions ?? 0} icon={<Sparkles className="w-3.5 h-3.5" />} />
          <StatItem label="Resolved" value={data?.resolutions ?? 0} icon={<Heart className="w-3.5 h-3.5" />} />
          <StatItem label="Success" value={`${data?.rate ?? 0}%`} icon={<Activity className="w-3.5 h-3.5" />} />
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Stat Item ──────────────────────────────────────────────
function StatItem({ label, value, icon }: { label: string; value: number | string; icon: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
      <div className="text-muted-foreground">{icon}</div>
      <div>
        <p className="text-lg font-semibold text-foreground leading-none">{value}</p>
        <p className="text-[11px] text-muted-foreground mt-0.5">{label}</p>
      </div>
    </div>
  );
}


// ─── Main Page ──────────────────────────────────────────────
export default function OperatorSignumPage() {
  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-xl font-semibold text-foreground font-serif">Signum — Human Flow Signals</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Where humans paused, hesitated, or repeated actions this week. Not analytics — stewardship insight.
        </p>
        <Link
          to="/operator/system?tab=friction"
          className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline mt-2"
        >
          <ExternalLink className="w-3 h-3" />
          View system-level friction events
        </Link>
      </div>

      {/* Vigilia Bottleneck Feed */}
      <OperatorVigiliaBottleneck />

      {/* NRI Friction Intelligence Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <FrictionDesignSuggestionsPanel />
        <FrictionPlaybookDraftsPanel />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FrictionOverviewCard />
        <ResolutionCard />
        <SystemWeightCard />
        <ArchetypeFrictionCard />
      </div>
    </div>
  );
}
