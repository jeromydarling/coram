/**
 * GovernancePanel — Communio governance flags review panel.
 *
 * WHAT: Read-only list of flagged sharing anomalies across Communio groups.
 * WHERE: Operator Console → Communio page "Governance" tab.
 * WHY: Operators review sharing patterns without accessing private data.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { HelpCircle, ShieldCheck, AlertTriangle, CheckCircle2, X } from 'lucide-react';
import { calmVariant, calmText } from '@/lib/calmMode';
import { toast } from '@/components/ui/sonner';
import { format } from 'date-fns';

export function GovernancePanel() {
  const qc = useQueryClient();

  const { data: flags, isLoading } = useQuery({
    queryKey: ['communio-governance-flags'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('communio_governance_flags')
        .select('*, communio_groups(name)')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  const reviewMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: 'reviewed' | 'dismissed' }) => {
      const { error } = await supabase
        .from('communio_governance_flags')
        .update({ status, reviewed_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['communio-governance-flags'] });
      toast.success('Flag updated');
    },
  });

  const openFlags = flags?.filter(f => f.status === 'open') ?? [];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldCheck className="h-5 w-5 text-primary" />
          Governance Review
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-xs text-xs space-y-1">
                <p><strong>What:</strong> Flagged Communio sharing patterns that may need review.</p>
                <p><strong>Where:</strong> Auto-detected by weekly governance scan.</p>
                <p><strong>Why:</strong> Ensures sharing stays healthy and privacy-respecting.</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          {openFlags.length > 0 && (
            <Badge variant="outline" className="ml-auto text-xs font-normal">
              {openFlags.length} open
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
          </div>
        ) : !flags || flags.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            No governance flags — sharing patterns look healthy. 🌿
          </p>
        ) : (
          <div className="space-y-2">
            {flags.map((flag) => (
              <div
                key={flag.id}
                className="flex items-start gap-3 p-3 rounded-lg border border-border bg-muted/30"
              >
                <div className="h-8 w-8 rounded-full bg-accent/10 flex items-center justify-center shrink-0 mt-0.5">
                  <AlertTriangle className="h-4 w-4 text-accent-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <Badge variant={calmVariant(flag.severity === 'high' ? 'warning' : 'ok')} className="text-[10px] px-1.5">
                      {calmText(flag.flag_type === 'excessive_sharing' ? 'Elevated sharing volume' : 'Unusual pattern')}
                    </Badge>
                    <Badge variant="outline" className="text-[10px] px-1.5">
                      {flag.status}
                    </Badge>
                  </div>
                  <p className="text-sm text-foreground">
                    {(flag as any).communio_groups?.name ?? 'Unknown group'}
                  </p>
                  {flag.details && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{flag.details}</p>
                  )}
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {format(new Date(flag.created_at), 'MMM d, yyyy')}
                  </p>
                </div>
                {flag.status === 'open' && (
                  <div className="flex gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => reviewMutation.mutate({ id: flag.id, status: 'reviewed' })}
                      disabled={reviewMutation.isPending}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => reviewMutation.mutate({ id: flag.id, status: 'dismissed' })}
                      disabled={reviewMutation.isPending}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
