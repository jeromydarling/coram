/**
 * TodayInCrosPanel — Operator work queue panel.
 *
 * WHAT: Displays open operator work items in a calm, narrative layout.
 * WHERE: Operator Console overview (Dashboard tab).
 * WHY: Gives operators a gentle daily overview without urgency styling.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { HelpCircle, CheckCircle2, Eye, Inbox, Users, Plug, ArrowRightLeft, TrendingUp, Shield } from 'lucide-react';
import { calmVariant } from '@/lib/calmMode';
import { toast } from '@/components/ui/sonner';

const typeIcons: Record<string, React.ElementType> = {
  activation_pending: Users,
  connector_issue: Plug,
  migration_stalled: ArrowRightLeft,
  expansion_signal: TrendingUp,
  communio_request: Shield,
};

const typeLabels: Record<string, string> = {
  activation_pending: 'Activation',
  connector_issue: 'Connection',
  migration_stalled: 'Migration',
  expansion_signal: 'Expansion',
  communio_request: 'Communio',
};

export function TodayInCrosPanel() {
  const qc = useQueryClient();

  const { data: items, isLoading } = useQuery({
    queryKey: ['operator-work-queue'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('operator_work_queue')
        .select('*')
        .in('status', ['open', 'acknowledged'])
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
  });

  const acknowledgeMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('operator_work_queue')
        .update({ status: 'acknowledged' })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['operator-work-queue'] });
    },
  });

  const resolveMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('operator_work_queue')
        .update({ status: 'resolved', resolved_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['operator-work-queue'] });
      toast.success('Item resolved');
    },
  });

  const openCount = items?.filter(i => i.status === 'open').length ?? 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Inbox className="h-5 w-5 text-primary" />
          Today in CROS
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-xs text-xs space-y-1">
                <p><strong>What:</strong> Items that may benefit from your attention today.</p>
                <p><strong>Where:</strong> Aggregated from integrations, onboarding, and community signals.</p>
                <p><strong>Why:</strong> A calm daily overview — no urgency, just awareness.</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          {openCount > 0 && (
            <Badge variant="outline" className="ml-auto text-xs font-normal">
              {openCount} open
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-14 w-full" />)}
          </div>
        ) : !items || items.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            Everything looks calm today. ✨
          </p>
        ) : (
          <div className="space-y-2">
            {items.map((item) => {
              const Icon = typeIcons[item.type] ?? Inbox;
              return (
                <div
                  key={item.id}
                  className="flex items-start gap-3 p-3 rounded-lg border border-border bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <Badge variant={calmVariant(item.priority === 'high' ? 'warning' : 'ok')} className="text-[10px] px-1.5">
                        {typeLabels[item.type] ?? item.type}
                      </Badge>
                      <Badge variant="outline" className="text-[10px] px-1.5">
                        {item.priority}
                      </Badge>
                    </div>
                    <p className="text-sm text-foreground truncate">{item.summary}</p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    {item.status === 'open' && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => acknowledgeMutation.mutate(item.id)}
                        disabled={acknowledgeMutation.isPending}
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => resolveMutation.mutate(item.id)}
                      disabled={resolveMutation.isPending}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
