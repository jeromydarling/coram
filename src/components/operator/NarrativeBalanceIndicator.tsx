/**
 * NarrativeBalanceIndicator — Visual-only narrative balance display.
 *
 * WHAT: Shows momentum/drift/reconnection/growth balance from testimonium flags.
 * WHERE: Operator Console → Overview tab.
 * WHY: Gives leadership a sense of narrative texture — no writes, no schema changes.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { HelpCircle } from 'lucide-react';

export function NarrativeBalanceIndicator() {
  const { data: rollups, isLoading } = useQuery({
    queryKey: ['ecosystem-narrative-balance'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ecosystem_health_rollups')
        .select('testimonium_flags')
        .order('week_start', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data || [];
    },
  });

  if (isLoading) return <Skeleton className="h-24 w-full" />;

  // Tally flag types
  const counts: Record<string, number> = {
    momentum: 0,
    drift: 0,
    reconnection: 0,
    growth: 0,
  };

  for (const r of rollups || []) {
    const flags = Array.isArray(r.testimonium_flags) ? r.testimonium_flags : [];
    for (const f of flags) {
      const ft = String(f).toLowerCase();
      if (ft.includes('momentum') || ft.includes('spike')) counts.momentum++;
      else if (ft.includes('drift') || ft.includes('decline')) counts.drift++;
      else if (ft.includes('reconnect') || ft.includes('reactivat')) counts.reconnection++;
      else if (ft.includes('growth') || ft.includes('increas')) counts.growth++;
    }
  }

  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  if (total === 0) return null;

  const segments = [
    { key: 'momentum', label: 'Momentum', color: 'bg-primary' },
    { key: 'drift', label: 'Drift', color: 'bg-muted-foreground/40' },
    { key: 'reconnection', label: 'Reconnection', color: 'bg-accent-foreground/60' },
    { key: 'growth', label: 'Growth', color: 'bg-primary/60' },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <h3 className="text-lg font-semibold text-foreground">Narrative Balance</h3>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              <HelpCircle className="h-4 w-4 text-muted-foreground" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p className="text-xs">
                <strong>What:</strong> Distribution of narrative signal types across the ecosystem.<br />
                <strong>Where:</strong> Derived from testimonium flags in ecosystem rollups.<br />
                <strong>Why:</strong> Understand the narrative texture — momentum vs. drift vs. growth.
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <Card className="rounded-xl">
        <CardContent className="p-4 space-y-3">
          {/* Bar */}
          <div className="h-3 rounded-full overflow-hidden flex">
            {segments.map((seg) => {
              const pct = total > 0 ? (counts[seg.key] / total) * 100 : 0;
              if (pct === 0) return null;
              return (
                <div
                  key={seg.key}
                  className={`${seg.color} transition-all`}
                  style={{ width: `${pct}%` }}
                />
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-4 text-xs">
            {segments.map((seg) => (
              <div key={seg.key} className="flex items-center gap-1.5">
                <div className={`w-2 h-2 rounded-full ${seg.color}`} />
                <span className="text-muted-foreground">
                  {seg.label}: {counts[seg.key]}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
