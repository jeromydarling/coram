/**
 * SignumPulseCard — Operator Nexus landing card for friction signals.
 *
 * WHAT: Shows narrative summary of where humans slowed down this week.
 * WHERE: OperatorNexusHome grid.
 * WHY: Gives operators a gentle nudge about workflow bottlenecks.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Activity } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { calculatePresence, presenceCardClasses, type PresenceLevel } from '@/lib/operator/presence';

export function SignumPulseCard() {
  const now7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data, isLoading } = useQuery({
    queryKey: ['nexus-signum-pulse'],
    queryFn: async () => {
      const { data: events } = await supabase
        .from('testimonium_events')
        .select('event_kind, metadata')
        .in('event_kind', ['friction_idle', 'friction_repeat_nav', 'friction_abandon_flow', 'friction_help_open'])
        .gte('occurred_at', now7d)
        .limit(500);

      if (!events || events.length === 0) return { total: 0, narratives: [] };

      // Build page frequency
      const pageCounts: Record<string, number> = {};
      for (const ev of events) {
        const page = (ev as any).metadata?.context || (ev as any).metadata?.page || 'unknown';
        pageCounts[page] = (pageCounts[page] || 0) + 1;
      }

      const sorted = Object.entries(pageCounts).sort(([, a], [, b]) => b - a).slice(0, 3);
      const narratives = sorted.map(([page, count]) => {
        if (count >= 10) return `${page} saw noticeable pauses across multiple sessions.`;
        if (count >= 5) return `${page} showed some hesitation patterns.`;
        return `${page} had a few moments of reflection.`;
      });

      return { total: events.length, narratives };
    },
  });

  if (isLoading) return <Skeleton className="h-32" />;
  if (!data || data.total === 0) return null;

  // Determine card presence based on friction volume
  const cardPresence = calculatePresence({
    severity: data.total >= 20 ? 'high' : data.total >= 8 ? 'medium' : 'low',
    operatorActionRequired: false,
    tenantImpact: 0,
    repetitionCount: 0,
  });

  return (
    <Card className={presenceCardClasses(cardPresence.level)}>
      <CardHeader className="pb-2 pt-4">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-muted-foreground" />
          <CardTitle className="text-sm font-serif">Where humans slowed down</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="pb-4">
        <div className="space-y-1.5">
          {data.narratives.map((n, i) => (
            <p key={i} className="text-xs text-muted-foreground leading-relaxed italic">"{n}"</p>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground mt-3">{data.total} friction signals this week</p>
      </CardContent>
    </Card>
  );
}
