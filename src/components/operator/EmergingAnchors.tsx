/**
 * EmergingAnchors — Operator panel showing essays approaching anchor status.
 *
 * WHAT: Displays essays with rising gravity_score that may deserve anchor promotion.
 * WHERE: Operator Nexus → Narrative Rhythm section.
 * WHY: Operators confirm anchor status — gravity grows slowly, never auto-promoted quickly.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/sonner';
import { Anchor, Leaf, Loader2 } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { HelpCircle as HelpIcon } from 'lucide-react';
import { ANCHOR_GRAVITY_THRESHOLD } from '@/lib/nri/archetypeJourneyBuilder';

function HelpTip({ text }: { text: string }) {
  return (
    <TooltipProvider><Tooltip><TooltipTrigger asChild>
      <HelpIcon className="h-3.5 w-3.5 text-muted-foreground inline ml-1" />
    </TooltipTrigger><TooltipContent><p className="max-w-xs text-xs">{text}</p></TooltipContent></Tooltip></TooltipProvider>
  );
}

export default function EmergingAnchors() {
  const qc = useQueryClient();

  const { data: emerging, isLoading } = useQuery({
    queryKey: ['emerging-anchors'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('operator_content_drafts')
        .select('id, title, slug, gravity_score, is_anchor, anchor_archetypes, anchor_reason, editorial_mode, published_at')
        .eq('status', 'published')
        .eq('is_anchor', false)
        .gte('gravity_score', ANCHOR_GRAVITY_THRESHOLD * 0.5)
        .order('gravity_score', { ascending: false })
        .limit(10);
      if (error) throw error;
      return data || [];
    },
  });

  const promoteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('operator_content_drafts')
        .update({ is_anchor: true, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Essay promoted to anchor');
      qc.invalidateQueries({ queryKey: ['emerging-anchors'] });
      qc.invalidateQueries({ queryKey: ['library-drafts'] });
    },
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
          <Anchor className="w-3.5 h-3.5" />
          Emerging Anchors
          <HelpTip text="Essays gaining narrative gravity across the ecosystem. When an essay reaches enough weight, you can promote it to an Anchor — shaping archetype journeys and future NRI voice." />
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">{Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-20" />)}</div>
        ) : !emerging?.length ? (
          <div className="flex items-center gap-3 text-muted-foreground py-4">
            <Leaf className="w-4 h-4 text-primary" />
            <p className="text-sm font-serif italic">No essays approaching anchor weight yet. Gravity builds slowly.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {emerging.map((essay: any) => {
              const atThreshold = essay.gravity_score >= ANCHOR_GRAVITY_THRESHOLD;
              return (
                <div key={essay.id} className="p-3 rounded-md border border-border/50 bg-card">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground font-serif">{essay.title}</p>
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        <Badge variant={atThreshold ? 'default' : 'outline'} className="text-xs">
                          Gravity: {essay.gravity_score}
                        </Badge>
                        {essay.anchor_archetypes?.length > 0 && (
                          <span className="text-xs text-muted-foreground">
                            {essay.anchor_archetypes.join(', ')}
                          </span>
                        )}
                      </div>
                      {essay.anchor_reason && (
                        <p className="text-xs text-muted-foreground mt-1">{essay.anchor_reason}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant={atThreshold ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => promoteMutation.mutate(essay.id)}
                        disabled={promoteMutation.isPending}
                        className="text-xs"
                      >
                        {promoteMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Promote to Anchor'}
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
