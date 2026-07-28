/**
 * GrowthSignalsCard — Quiet growth observation card for Operator Rhythm.
 *
 * WHAT: Shows rising archetype interest and expansion signals.
 * WHERE: /operator/nexus/rhythm
 * WHY: Operators need gentle awareness of organic growth patterns.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Sprout } from 'lucide-react';

const serif = { fontFamily: 'Georgia, "Times New Roman", serif' };

export default function GrowthSignalsCard() {
  const weekAgoISO = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: signals, isLoading } = useQuery({
    queryKey: ['growth-interest-signals'],
    queryFn: async () => {
      const { data } = await supabase
        .from('archetype_interest_signals')
        .select('archetype_key, source')
        .gte('created_at', weekAgoISO);
      if (!data || data.length === 0) return [];

      // Aggregate by archetype
      const counts: Record<string, number> = {};
      (data as any[]).forEach((r: any) => {
        counts[r.archetype_key] = (counts[r.archetype_key] || 0) + 1;
      });
      return Object.entries(counts)
        .map(([key, count]) => ({ archetype: key, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);
    },
  });

  if (isLoading) return <Skeleton className="h-24" />;

  return (
    <Card>
      <CardContent className="pt-4 pb-3">
        <div className="flex items-center gap-2 mb-3">
          <Sprout className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-medium text-foreground" style={serif}>Quiet Growth Signals</h3>
        </div>
        {signals && signals.length > 0 ? (
          <div className="space-y-2">
            {signals.map((s) => (
              <div key={s.archetype} className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground capitalize">{s.archetype.replace(/_/g, ' ')}</span>
                <Badge variant="secondary" className="text-[10px]">{s.count} signal{s.count > 1 ? 's' : ''}</Badge>
              </div>
            ))}
            <p className="text-[11px] text-muted-foreground italic mt-2" style={serif}>
              Some teams are finding their way here organically.
            </p>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground" style={serif}>
            No new discovery signals this week. The ecosystem rests.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
