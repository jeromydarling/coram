/**
 * WitnessConsole — Admin-only Testimonium observation dashboard.
 *
 * WHAT: Quiet overview of narrative telemetry across the system.
 * WHERE: /:tenantSlug/admin/testimonium
 * WHY: Confirms the system is alive — not to monitor staff performance.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { HelpTooltip } from '@/components/ui/help-tooltip';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  BookOpen,
  Heart,
  Users,
  ArrowRight,
  Feather,
  Waves,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { getWeekStartDate, getWeekDisplayRange } from '@/lib/weekDate';

const FLAG_CONFIG: Record<string, { icon: typeof Sparkles; label: string; className: string }> = {
  momentum: { icon: ArrowRight, label: 'Momentum building', className: 'text-primary' },
  drift: { icon: Waves, label: 'Gentle drift', className: 'text-muted-foreground' },
  reconnection: { icon: RefreshCw, label: 'Renewed connection', className: 'text-accent-foreground' },
  growth: { icon: Sparkles, label: 'Community growth', className: 'text-primary' },
};

export default function WitnessConsole() {
  const { tenant } = useTenant();

  const weekStart = getWeekStartDate();

  // This week's events summary
  const { data: weekSummary, isLoading: summaryLoading } = useQuery({
    queryKey: ['testimonium-week-summary', tenant?.id, weekStart],
    queryFn: async () => {
      if (!tenant?.id) return null;
      const monday = new Date(weekStart + 'T00:00:00Z');
      const { data, error } = await supabase
        .from('testimonium_events')
        .select('source_module, event_kind')
        .eq('tenant_id', tenant.id)
        .gte('occurred_at', monday.toISOString())
        .limit(2000);

      if (error) throw error;

      const modules = new Map<string, { count: number; lastAt: string }>();
      let stories = 0;
      let presence = 0;
      let touches = 0;
      let moves = 0;

      for (const ev of data || []) {
        const mod = ev.source_module;
        const existing = modules.get(mod) || { count: 0, lastAt: '' };
        existing.count++;
        modules.set(mod, existing);

        if (mod === 'impulsus') stories++;
        else if (mod === 'event' || mod === 'voluntarium') presence++;
        else if (mod === 'email' || mod === 'campaign') touches++;
        else if (mod === 'journey') moves++;
      }

      return { total: (data || []).length, stories, presence, touches, moves, modules };
    },
    enabled: !!tenant?.id,
  });

  // Recent flags
  const { data: flags, isLoading: flagsLoading } = useQuery({
    queryKey: ['testimonium-flags', tenant?.id],
    queryFn: async () => {
      if (!tenant?.id) return [];
      const { data, error } = await supabase
        .from('testimonium_flags')
        .select('*')
        .eq('tenant_id', tenant.id)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenant?.id,
  });

  // Module activity table
  const moduleData = weekSummary?.modules
    ? Array.from(weekSummary.modules.entries()).map(([mod, info]) => ({
        module: mod,
        count: info.count,
      })).sort((a, b) => b.count - a.count)
    : [];

  const cardData = [
    {
      label: 'Stories captured',
      value: weekSummary?.stories ?? 0,
      icon: BookOpen,
      subtitle: 'this week',
    },
    {
      label: 'Moments of presence',
      value: weekSummary?.presence ?? 0,
      icon: Heart,
      subtitle: 'events & volunteering',
    },
    {
      label: 'Community touches',
      value: weekSummary?.touches ?? 0,
      icon: Users,
      subtitle: 'emails & campaigns',
    },
    {
      label: 'Journey movements',
      value: weekSummary?.moves ?? 0,
      icon: ArrowRight,
      subtitle: 'stage transitions',
    },
  ];

  return (
    <div className="p-4 md:p-6 space-y-8 max-w-5xl">
      {/* Header */}
      <div className="space-y-1">
        <div className="flex items-center gap-3">
          <Feather className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-serif font-medium text-foreground">
            Witness Console
          </h1>
          <HelpTooltip content="The Witness Console quietly confirms the system is capturing relationship moments. This is not performance tracking — it's narrative awareness." />
        </div>
        <p className="text-sm text-muted-foreground font-serif">
          A quiet confirmation that the system is listening.
        </p>
      </div>

      {/* ─── Quiet Pulse ─── */}
      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
          Quiet Pulse — {getWeekDisplayRange(weekStart)}
        </h2>

        {summaryLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {cardData.map((card) => {
              const Icon = card.icon;
              return (
                <Card key={card.label} className="rounded-xl border-border/40">
                  <CardContent className="py-5 px-4 text-center space-y-1">
                    <Icon className="w-5 h-5 mx-auto text-muted-foreground/60" />
                    <p className="text-2xl font-serif font-medium text-foreground">
                      {card.value}
                    </p>
                    <p className="text-xs text-muted-foreground">{card.label}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* ─── Narrative Signals ─── */}
      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
          Narrative Signals
        </h2>

        {flagsLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 rounded-xl" />
            ))}
          </div>
        ) : !flags?.length ? (
          <Card className="rounded-xl border-dashed">
            <CardContent className="py-8 text-center">
              <p className="text-sm text-muted-foreground font-serif italic">
                No narrative signals yet. They emerge as the system listens over time.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {flags.map((flag: any) => {
              const config = FLAG_CONFIG[flag.flag_type] || FLAG_CONFIG.momentum;
              const Icon = config.icon;
              return (
                <Card key={flag.id} className="rounded-xl border-border/40">
                  <CardContent className="py-4 px-5 flex items-start gap-3">
                    <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${config.className}`} />
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs font-normal">
                          {config.label}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(flag.created_at), { addSuffix: true })}
                        </span>
                      </div>
                      <p className="text-sm font-serif text-foreground/80">
                        {flag.description}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* ─── Module Activity ─── */}
      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
          Module Activity
        </h2>

        {summaryLoading ? (
          <Skeleton className="h-40 rounded-xl" />
        ) : moduleData.length === 0 ? (
          <Card className="rounded-xl border-dashed">
            <CardContent className="py-8 text-center">
              <p className="text-sm text-muted-foreground font-serif italic">
                No module activity captured this week.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card className="rounded-xl">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Module</TableHead>
                    <TableHead className="text-right">Moments captured</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {moduleData.map((row) => (
                    <TableRow key={row.module}>
                      <TableCell className="font-medium capitalize">
                        {row.module.replace(/_/g, ' ')}
                      </TableCell>
                      <TableCell className="text-right font-serif">
                        {row.count}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </section>
    </div>
  );
}
