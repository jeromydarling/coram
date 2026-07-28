/**
 * ExpansionWatchlist — Operator-level expansion plan overview.
 *
 * WHAT: Lists all metro expansion plans across tenants, ordered by priority.
 * WHERE: Operator Console → Ecosystem page.
 * WHY: Gives Operator visibility into which metros are being pursued for growth.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Sprout } from 'lucide-react';
import { HelpTooltip } from '@/components/ui/help-tooltip';
import { cn } from '@/lib/utils';

const statusColors: Record<string, string> = {
  research: 'bg-muted text-muted-foreground',
  relationships: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  pilot: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  launching: 'bg-primary/10 text-primary',
  active: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  paused: 'bg-destructive/10 text-destructive',
};

export function ExpansionWatchlist() {
  const { data, isLoading } = useQuery({
    queryKey: ['operator-expansion-watchlist'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('metro_expansion_plans')
        .select('*, metros(metro), tenants(name)')
        .order('priority', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as any[];
    },
  });

  if (isLoading) {
    return <Skeleton className="h-48" />;
  }

  if (!data?.length) {
    return (
      <Card className="rounded-xl">
        <CardContent className="py-8 text-center text-muted-foreground text-sm">
          No expansion plans yet.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-xl">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Sprout className="h-4 w-4 text-primary" />
          Expansion Watchlist
          <Badge variant="secondary" className="text-xs">{data.length}</Badge>
          <HelpTooltip content="All metro expansion plans across tenants, ordered by priority." />
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="divide-y divide-border">
          {data.map((plan: any) => (
            <div key={plan.id} className="py-3 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {plan.metros?.metro || 'Unknown Metro'}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {plan.tenants?.name || 'Platform-level'}
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0 text-xs text-muted-foreground">
                <Badge className={cn('text-xs', statusColors[plan.status] || statusColors.research)}>
                  {plan.status}
                </Badge>
                <span className="font-mono">P{plan.priority}</span>
                {plan.target_launch_date && (
                  <span>{plan.target_launch_date}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
