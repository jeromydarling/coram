/**
 * OperatorAwarenessPanel — Intelligence surface for ecosystem movement.
 *
 * WHAT: Groups awareness events by category in a calm, narrative layout.
 * WHERE: Embedded at the top of /operator/nexus
 * WHY: Helps operators understand what matters without reading dashboards.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AwarenessCard, type AwarenessEvent } from './AwarenessCard';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { Leaf, RefreshCw, Loader2 } from 'lucide-react';
import { toast } from '@/components/ui/sonner';

const CATEGORY_ORDER = ['narrative', 'activation', 'expansion', 'friction', 'migration', 'growth'];

export function OperatorAwarenessPanel() {
  const queryClient = useQueryClient();

  const { data: events, isLoading } = useQuery({
    queryKey: ['operator-awareness-events'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('operator_awareness_events' as any)
        .select('*')
        .eq('resolved', false)
        .order('signal_strength', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(30);
      if (error) throw error;
      return (data as unknown as AwarenessEvent[]) || [];
    },
  });

  const refresh = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('operator-awareness-refresh');
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['operator-awareness-events'] });
      toast.success(`Awareness refreshed — ${data?.generated || 0} signals found`);
    },
    onError: (err) => toast.error(`Refresh paused: ${String(err)}`),
  });

  // Group by category preserving order
  const grouped = CATEGORY_ORDER
    .map(cat => ({
      category: cat,
      items: (events || []).filter(e => e.category === cat),
    }))
    .filter(g => g.items.length > 0);

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-48" />
        {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
      </div>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
          <Leaf className="w-3.5 h-3.5" />
          Ecosystem Awareness
        </h2>
        <Button
          variant="ghost"
          size="sm"
          className="text-xs gap-1.5"
          onClick={() => refresh.mutate()}
          disabled={refresh.isPending}
        >
          {refresh.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
          Refresh Signals
        </Button>
      </div>

      {grouped.length === 0 ? (
        <Card>
          <CardContent className="pt-5 pb-4 flex items-center gap-3 text-muted-foreground">
            <Leaf className="w-4 h-4 text-primary" />
            <p className="text-sm">All quiet across the ecosystem. No signals need attention right now.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {grouped.map(group => (
            group.items.map(event => (
              <AwarenessCard key={event.id} event={event} />
            ))
          ))}
        </div>
      )}
    </section>
  );
}
