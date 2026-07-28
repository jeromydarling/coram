/**
 * EditorialRecommendations — NRI Editorial Brain panel for Operator Nexus.
 *
 * WHAT: Shows editorial recommendations with Draft Now / Wait / Ignore actions.
 * WHERE: Operator Nexus → Rhythm page.
 * WHY: NRI decides WHEN to write, not just WHAT. Silence is a valid state.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/sonner';
import { Pen, Clock, XCircle, Loader2, Leaf } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { HelpCircle as HelpIcon } from 'lucide-react';
import { EDITORIAL_MODES, type EditorialMode } from '@/content/nriWritingGuidelines';

function HelpTip({ text }: { text: string }) {
  return (
    <TooltipProvider><Tooltip><TooltipTrigger asChild>
      <HelpIcon className="h-3.5 w-3.5 text-muted-foreground inline ml-1" />
    </TooltipTrigger><TooltipContent><p className="max-w-xs text-xs">{text}</p></TooltipContent></Tooltip></TooltipProvider>
  );
}

const STRENGTH_VARIANT: Record<string, string> = {
  strong: 'default',
  moderate: 'secondary',
  low: 'outline',
};

export default function EditorialRecommendations() {
  const qc = useQueryClient();

  const { data: recommendations, isLoading } = useQuery({
    queryKey: ['editorial-recommendations'],
    queryFn: async () => {
      const { data, error } = await supabase.from('editorial_recommendations')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(5);
      if (error) throw error;
      return data || [];
    },
  });

  const actMutation = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: 'drafted' | 'waiting' | 'dismissed' }) => {
      const { error } = await supabase.from('editorial_recommendations')
        .update({
          status: action,
          acted_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, { action }) => {
      const msg = action === 'drafted' ? 'Drafting initiated' : action === 'waiting' ? 'Marked as waiting' : 'Suggestion dismissed';
      toast.success(msg);
      qc.invalidateQueries({ queryKey: ['editorial-recommendations'] });
    },
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
          <Pen className="w-3.5 h-3.5" />
          Editorial Rhythm
          <HelpTip text="NRI evaluates movement across the network before recommending content. Silence is a valid response when no meaningful shift exists." />
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">{Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-20" />)}</div>
        ) : !recommendations?.length ? (
          <div className="flex items-center gap-3 text-muted-foreground py-4">
            <Leaf className="w-4 h-4 text-primary" />
            <p className="text-sm font-serif italic">The editorial brain is quiet. No recommendations right now.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {recommendations.map((rec: any) => {
              const mode = EDITORIAL_MODES[rec.editorial_mode as EditorialMode];
              return (
                <div key={rec.id} className="p-3 rounded-md border border-border/50 bg-card">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <Badge variant={STRENGTH_VARIANT[rec.signal_strength] as any || 'outline'} className="text-xs">
                          {mode?.label || rec.editorial_mode}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {rec.tenant_count} tenant{rec.tenant_count !== 1 ? 's' : ''} · {rec.signal_strength} signal
                        </span>
                      </div>
                      <p className="text-sm font-medium text-foreground">{rec.title}</p>
                      <p className="text-xs text-muted-foreground mt-1">{rec.reason}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => actMutation.mutate({ id: rec.id, action: 'drafted' })}
                        disabled={actMutation.isPending}
                        title="Draft Now"
                      >
                        {actMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pen className="h-4 w-4 text-primary" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => actMutation.mutate({ id: rec.id, action: 'waiting' })}
                        disabled={actMutation.isPending}
                        title="Wait"
                      >
                        <Clock className="h-4 w-4 text-muted-foreground" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => actMutation.mutate({ id: rec.id, action: 'dismissed' })}
                        disabled={actMutation.isPending}
                        title="Ignore Suggestion"
                      >
                        <XCircle className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </div>
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
