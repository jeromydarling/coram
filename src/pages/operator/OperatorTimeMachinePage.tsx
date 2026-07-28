/**
 * OperatorTimeMachinePage — Unified narrative audit timeline.
 *
 * WHAT: Chronological feed of platform events across tenants.
 * WHERE: /operator/time-machine
 * WHY: Narrative replay — not analytics. Helps operators understand system story.
 */

import { useState, useMemo } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { HelpCircle, Clock, ArrowRightLeft, FlaskConical, Users, Sparkles, Plug, Loader2 } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';

type FilterChip = 'all' | 'migrations' | 'demo' | 'communio' | 'narrative' | 'integrations';

const CHIP_CONFIG: { key: FilterChip; label: string; icon: React.ElementType }[] = [
  { key: 'all', label: 'All', icon: Clock },
  { key: 'migrations', label: 'Migrations', icon: ArrowRightLeft },
  { key: 'demo', label: 'Demo', icon: FlaskConical },
  { key: 'communio', label: 'Communio', icon: Users },
  { key: 'narrative', label: 'Narrative', icon: Sparkles },
  { key: 'integrations', label: 'Integrations', icon: Plug },
];

const PAGE_SIZE = 30;

interface TimelineEvent {
  id: string;
  source: string;
  title: string;
  detail: string;
  occurred_at: string;
  tenant_id?: string;
}

export default function OperatorTimeMachinePage() {
  const [filter, setFilter] = useState<FilterChip>('all');

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useInfiniteQuery({
    queryKey: ['operator-time-machine', filter],
    queryFn: async ({ pageParam = 0 }) => {
      const events: TimelineEvent[] = [];
      const from = pageParam * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      // Fetch from multiple sources based on filter
      const queries: Array<Promise<any> | PromiseLike<any>> = [];

      if (filter === 'all' || filter === 'narrative') {
        queries.push(
          supabase
            .from('testimonium_events')
            .select('id, event_kind, source_module, summary, occurred_at, tenant_id')
            .order('occurred_at', { ascending: false })
            .range(from, to)
            .then(({ data: rows }) => {
              rows?.forEach((r) =>
                events.push({
                  id: `te-${r.id}`,
                  source: 'narrative',
                  title: `Testimonium: ${(r.event_kind || '').replace(/_/g, ' ')}`,
                  detail: r.summary || r.source_module || '',
                  occurred_at: r.occurred_at,
                  tenant_id: r.tenant_id,
                })
              );
            })
        );
      }

      if (filter === 'all' || filter === 'migrations') {
        queries.push(
          supabase
            .from('migration_runs')
            .select('id, connector_key, environment, status, started_at, tenant_id')
            .order('started_at', { ascending: false })
            .range(from, to)
            .then(({ data: rows }) => {
              rows?.forEach((r) =>
                events.push({
                  id: `mr-${r.id}`,
                  source: 'migrations',
                  title: `Migration: ${r.connector_key} (${r.environment})`,
                  detail: `Status: ${r.status}`,
                  occurred_at: r.started_at,
                  tenant_id: r.tenant_id,
                })
              );
            })
        );
      }

      if (filter === 'all' || filter === 'demo') {
        queries.push(
          supabase
            .from('demo_seed_runs')
            .select('id, run_key, status, created_at, demo_tenant_id')
            .order('created_at', { ascending: false })
            .range(from, to)
            .then(({ data: rows }) => {
              rows?.forEach((r) =>
                events.push({
                  id: `ds-${r.id}`,
                  source: 'demo',
                  title: `Demo Seed: ${r.run_key}`,
                  detail: `Status: ${r.status}`,
                  occurred_at: r.created_at ?? new Date().toISOString(),
                })
              );
            })
        );
      }

      if (filter === 'all' || filter === 'communio') {
        queries.push(
          supabase
            .from('communio_shared_signals')
            .select('id, signal_type, created_at, tenant_id, group_id')
            .order('created_at', { ascending: false })
            .range(from, to)
            .then(({ data: rows }) => {
              rows?.forEach((r) =>
                events.push({
                  id: `cs-${r.id}`,
                  source: 'communio',
                  title: `Communio Signal: ${(r.signal_type || '').replace(/_/g, ' ')}`,
                  detail: `Group ${r.group_id?.slice(0, 8)}`,
                  occurred_at: r.created_at,
                  tenant_id: r.tenant_id,
                })
              );
            })
        );
      }

      if (filter === 'all' || filter === 'integrations') {
        queries.push(
          supabase
            .from('system_health_events')
            .select('id, schedule_key, status, occurred_at')
            .order('occurred_at', { ascending: false })
            .range(from, to)
            .then(({ data: rows }) => {
              rows?.forEach((r) =>
                events.push({
                  id: `sh-${r.id}`,
                  source: 'integrations',
                  title: `System: ${(r.schedule_key || '').replace(/_/g, ' ')}`,
                  detail: `Status: ${r.status}`,
                  occurred_at: r.occurred_at,
                })
              );
            })
        );
      }

      await Promise.all(queries);

      // Sort by time descending
      events.sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime());

      return { events: events.slice(0, PAGE_SIZE), page: pageParam };
    },
    getNextPageParam: (lastPage) =>
      lastPage.events.length === PAGE_SIZE ? lastPage.page + 1 : undefined,
    initialPageParam: 0,
  });

  const allEvents = useMemo(
    () => data?.pages.flatMap((p) => p.events) ?? [],
    [data]
  );

  const sourceIcon = (source: string) => {
    switch (source) {
      case 'narrative': return <Sparkles className="h-4 w-4 text-amber-600" />;
      case 'migrations': return <ArrowRightLeft className="h-4 w-4 text-blue-600" />;
      case 'demo': return <FlaskConical className="h-4 w-4 text-purple-600" />;
      case 'communio': return <Users className="h-4 w-4 text-emerald-600" />;
      case 'integrations': return <Plug className="h-4 w-4 text-slate-600" />;
      default: return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-2">
        <Clock className="h-5 w-5 text-primary" />
        <div>
          <h1 className="text-xl font-semibold text-foreground">Time Machine</h1>
          <p className="text-sm text-muted-foreground">Narrative replay of platform activity.</p>
        </div>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger><HelpCircle className="h-4 w-4 text-muted-foreground" /></TooltipTrigger>
            <TooltipContent className="max-w-xs text-xs space-y-1">
              <p><strong>What:</strong> Unified timeline of all platform events.</p>
              <p><strong>Where:</strong> Operator → Time Machine.</p>
              <p><strong>Why:</strong> Understand system narrative without digging through tables.</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Filter chips */}
      <div className="flex flex-wrap gap-2">
        {CHIP_CONFIG.map((c) => (
          <Button
            key={c.key}
            variant={filter === c.key ? 'default' : 'outline'}
            size="sm"
            className="rounded-full gap-1.5"
            onClick={() => setFilter(c.key)}
          >
            <c.icon className="h-3.5 w-3.5" />
            {c.label}
          </Button>
        ))}
      </div>

      {/* Timeline */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : allEvents.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No events found for this filter.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {allEvents.map((ev) => (
            <Card key={ev.id} className="border-l-2 border-l-primary/20">
              <CardContent className="py-3 px-4 flex items-start gap-3">
                <div className="mt-0.5 shrink-0">{sourceIcon(ev.source)}</div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground" style={{ fontFamily: 'Georgia, serif' }}>
                    {ev.title}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">{ev.detail}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(ev.occurred_at), { addSuffix: true })}
                  </p>
                  <Badge variant="outline" className="text-[10px] mt-1">{ev.source}</Badge>
                </div>
              </CardContent>
            </Card>
          ))}

          {hasNextPage && (
            <div className="flex justify-center pt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
              >
                {isFetchingNextPage && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Load more
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
