/**
 * QuietWatchNotes — NRI analytics suggestions panel.
 *
 * WHAT: Evidence-based improvement suggestions from NRI Quiet Watch.
 * WHERE: /operator/nexus/analytics and Operator Rhythm page.
 * WHY: NRI observes friction + adoption, suggests calm improvements with evidence.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/sonner';
import { Eye, CheckCircle, XCircle, Loader2, Leaf, Sparkles } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { HelpCircle as HelpIcon } from 'lucide-react';

function HelpTip({ text }: { text: string }) {
  return (
    <TooltipProvider><Tooltip><TooltipTrigger asChild>
      <HelpIcon className="h-3.5 w-3.5 text-muted-foreground inline ml-1" />
    </TooltipTrigger><TooltipContent><p className="max-w-xs text-xs">{text}</p></TooltipContent></Tooltip></TooltipProvider>
  );
}

const TYPE_LABELS: Record<string, string> = {
  adoption_suggestion: 'Adoption',
  ux_suggestion: 'UX',
  funnel_suggestion: 'Funnel',
};

export default function QuietWatchNotes() {
  const qc = useQueryClient();

  const { data: notes, isLoading } = useQuery({
    queryKey: ['quiet-watch-notes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('operator_insight_notes')
        .select('*')
        .in('status', ['new', 'reviewed'])
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      return data || [];
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from('operator_insight_notes')
        .update({ status })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, { status }) => {
      const msg = status === 'reviewed' ? 'Noted' : status === 'dismissed' ? 'Dismissed' : 'Marked as implemented';
      toast.success(msg);
      qc.invalidateQueries({ queryKey: ['quiet-watch-notes'] });
    },
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5" />
          Quiet Watch Notes
          <HelpTip text="NRI observes friction and adoption patterns (never errors) and produces limited, evidence-based suggestions. Max 3 per day." />
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">{Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-20" />)}</div>
        ) : !notes?.length ? (
          <div className="flex items-center gap-3 text-muted-foreground py-4">
            <Leaf className="w-4 h-4 text-primary" />
            <p className="text-sm font-serif italic">NRI is quietly observing. No suggestions at the moment.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {notes.map((note: any) => (
              <div key={note.id} className="p-3 rounded-md border border-border/50 bg-card">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <Badge variant="outline" className="text-xs">{TYPE_LABELS[note.type] || note.type}</Badge>
                      <Badge variant={note.status === 'new' ? 'secondary' : 'outline'} className="text-xs">{note.status}</Badge>
                    </div>
                    <p className="text-sm font-medium text-foreground">{note.title}</p>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{note.narrative}</p>
                    {note.evidence && Object.keys(note.evidence).length > 0 && (
                      <div className="mt-2 p-2 bg-muted/50 rounded text-xs text-muted-foreground">
                        {note.evidence.metrics && (
                          <span>Metrics: {JSON.stringify(note.evidence.metrics)} </span>
                        )}
                        {note.evidence.time_window && (
                          <span>· Window: {note.evidence.time_window} </span>
                        )}
                        {note.evidence.impacted_routes && (
                          <span>· Routes: {(note.evidence.impacted_routes as string[]).join(', ')}</span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="ghost" size="sm" onClick={() => updateMutation.mutate({ id: note.id, status: 'reviewed' })} disabled={updateMutation.isPending || note.status === 'reviewed'} title="Mark reviewed">
                      <Eye className="h-4 w-4 text-primary" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => updateMutation.mutate({ id: note.id, status: 'implemented' })} disabled={updateMutation.isPending} title="Mark implemented">
                      <CheckCircle className="h-4 w-4 text-primary" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => updateMutation.mutate({ id: note.id, status: 'dismissed' })} disabled={updateMutation.isPending} title="Dismiss">
                      <XCircle className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
