/**
 * OperatorLivingLibrary — Living Library Flow for Operator Nexus.
 *
 * WHAT: Operator awareness of narrative movement — cycles, drafts, themes.
 * WHERE: /operator/nexus/library
 * WHY: Calm stewardship of the living narrative library.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/sonner';
import { BookOpen, Rss, Pen, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { HelpCircle as HelpIcon } from 'lucide-react';

function HelpTip({ text }: { text: string }) {
  return (
    <TooltipProvider><Tooltip><TooltipTrigger asChild>
      <HelpIcon className="h-3.5 w-3.5 text-muted-foreground inline ml-1" />
    </TooltipTrigger><TooltipContent><p className="max-w-xs text-xs">{text}</p></TooltipContent></Tooltip></TooltipProvider>
  );
}

function formatCycle(cycle: string): string {
  const [year, month] = cycle.split('-');
  const date = new Date(parseInt(year), parseInt(month) - 1);
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

export default function OperatorLivingLibrary() {
  const qc = useQueryClient();
  const currentCycle = new Date().toISOString().slice(0, 7);

  // All drafts
  const { data: allDrafts, isLoading } = useQuery({
    queryKey: ['library-drafts'],
    queryFn: async () => {
      const { data, error } = await supabase.from('operator_content_drafts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data || [];
    },
  });

  // RSS source count
  const { data: sourceCount } = useQuery({
    queryKey: ['rss-source-count'],
    queryFn: async () => {
      const { count, error } = await supabase.from('operator_rss_sources')
        .select('*', { count: 'exact', head: true })
        .eq('enabled', true);
      if (error) throw error;
      return count || 0;
    },
  });

  const publishMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('operator_content_drafts')
        .update({ status: 'published', published_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Essay published to library');
      qc.invalidateQueries({ queryKey: ['library-drafts'] });
    },
  });

  const dismissMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('operator_content_drafts')
        .update({ status: 'dismissed' })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Draft dismissed');
      qc.invalidateQueries({ queryKey: ['library-drafts'] });
    },
  });

  const drafts = allDrafts || [];
  const published = drafts.filter((d: any) => d.status === 'published');
  const pending = drafts.filter((d: any) => d.status === 'draft');
  const thisMonthEssays = published.filter((d: any) => d.reflection_cycle === currentCycle);
  const rssOrigin = drafts.filter((d: any) => d.is_interim_content).length;
  const tenantOrigin = drafts.length - rssOrigin;

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <BookOpen className="w-5 h-5 text-primary" />
          <h1 className="text-xl font-semibold text-foreground font-serif">Living Library</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Narrative stewardship — observe the rhythm, approve what's ready, let the rest grow.
        </p>
      </div>

      {/* Health Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="py-4 px-4">
            <p className="text-xs text-muted-foreground mb-1">Current Cycle</p>
            <p className="text-lg font-semibold font-serif text-foreground">{formatCycle(currentCycle)}</p>
            <p className="text-xs text-muted-foreground">{thisMonthEssays.length} published this month</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 px-4">
            <p className="text-xs text-muted-foreground mb-1">Pending Drafts</p>
            <p className="text-2xl font-semibold text-foreground">{pending.length}</p>
            <p className="text-xs text-muted-foreground">awaiting review</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 px-4">
            <p className="text-xs text-muted-foreground mb-1">
              Origin Balance
              <HelpTip text="Ratio of RSS-sourced (interim) vs tenant-driven narrative content." />
            </p>
            <div className="flex items-center gap-2">
              <Badge variant="outline"><Rss className="h-3 w-3 mr-1" />RSS: {rssOrigin}</Badge>
              <Badge variant="secondary">Tenant: {tenantOrigin}</Badge>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 px-4">
            <p className="text-xs text-muted-foreground mb-1">Active Sources</p>
            <p className="text-2xl font-semibold text-foreground">{sourceCount ?? '—'}</p>
            <p className="text-xs text-muted-foreground">RSS feeds enabled</p>
          </CardContent>
        </Card>
      </div>

      {/* Pending Drafts Queue */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-serif">
            <Pen className="h-4 w-4 inline mr-2 text-primary" />
            NRI Essay Queue
            <HelpTip text="Drafts generated by NRI awaiting operator approval before publishing to the public library." />
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
          ) : pending.length ? (
            <div className="space-y-3">
              {pending.map((d: any) => (
                <div key={d.id} className="flex items-start justify-between gap-4 p-3 rounded-md border border-border/50 bg-card">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground font-serif">{d.title}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <Badge variant="outline" className="text-xs">{d.editorial_mode === 'field_note' ? 'Field Note' : d.editorial_mode === 'monthly_reflection' ? 'Reflection' : d.editorial_mode === 'operator_insight' ? 'Operator Insight' : d.essay_type || d.draft_type}</Badge>
                      {d.collection && <Badge variant="outline" className="text-xs font-medium border-primary/40 text-primary">{d.collection}</Badge>}
                      {d.voice_origin === 'nri' && <Badge variant="secondary" className="text-xs">NRI</Badge>}
                      {d.is_anchor && <Badge variant="default" className="text-xs">Anchor</Badge>}
                      {d.gravity_score > 0 && !d.is_anchor && <Badge variant="outline" className="text-xs">Gravity: {d.gravity_score}</Badge>}
                      {d.voice_calibrated && <Badge variant="default" className="text-xs bg-primary/80">Voice Calibrated</Badge>}
                      {d.voice_origin === 'nri' && !d.voice_calibrated && <Badge variant="outline" className="text-xs text-muted-foreground border-muted-foreground/40">Awaiting Calibration</Badge>}
                      {d.is_interim_content && <Badge variant="outline" className="text-xs opacity-70">Interim</Badge>}
                      {d.editorial_mode === 'operator_insight' && <Badge variant="outline" className="text-xs">Internal Only</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{d.body?.slice(0, 150)}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => publishMutation.mutate(d.id)}
                      disabled={publishMutation.isPending}
                    >
                      {publishMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4 text-primary" />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => dismissMutation.mutate(d.id)}
                      disabled={dismissMutation.isPending}
                    >
                      <XCircle className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-6 font-serif italic">
              No drafts awaiting review. The library is at rest.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Reflection Cycle Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-serif">
            Reflection Cycle Overview
            <HelpTip text="Published essays grouped by monthly reflection cycle. Each month forms a narrative chapter." />
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? <Skeleton className="h-24" /> : (() => {
            const cycles: Record<string, any[]> = {};
            published.forEach((d: any) => {
              const c = d.reflection_cycle || 'undated';
              if (!cycles[c]) cycles[c] = [];
              cycles[c].push(d);
            });
            const sorted = Object.keys(cycles).sort((a, b) => b.localeCompare(a));

            return sorted.length ? (
              <div className="space-y-3">
                {sorted.map((cycle) => (
                  <div key={cycle} className="flex items-center justify-between p-3 rounded-md border border-border/50">
                    <div>
                      <p className="text-sm font-semibold font-serif text-foreground">
                        {cycle === 'undated' ? 'Undated' : formatCycle(cycle)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {cycles[cycle].length} {cycles[cycle].length === 1 ? 'essay' : 'essays'}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      {cycles[cycle].some((d: any) => d.voice_origin === 'nri') && (
                        <Badge variant="secondary" className="text-xs">NRI</Badge>
                      )}
                      {cycles[cycle].some((d: any) => d.is_interim_content) && (
                        <Badge variant="outline" className="text-xs">Interim</Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-6 font-serif italic">
                No essays published yet. The first reflection cycle begins with the first essay.
              </p>
            );
          })()}
        </CardContent>
      </Card>
    </div>
  );
}
