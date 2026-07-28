/**
 * OperatorCivitasStudio — Civic Gravity control panel for Operator Nexus.
 *
 * WHAT: Lets operators see metro readiness, edit, and publish public metro pages.
 * WHERE: /operator/nexus/civitas
 * WHY: Operator must approve civic narrative publishing — no auto-publish.
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Globe, Edit, MapPin, TrendingUp, RefreshCw, Plus, Archive } from 'lucide-react';
import { toast } from '@/components/ui/sonner';
import { format } from 'date-fns';
import { buildPublicMetroSummaries, type PublicMetroSummary } from '@/lib/civitas/publicMetroBuilder';
import { HelpTooltip } from '@/components/ui/help-tooltip';
const SectionTooltip = HelpTooltip;

const readinessColors: Record<string, string> = {
  not_ready: 'outline',
  draft_ready: 'secondary',
  published: 'default',
};

export default function OperatorCivitasStudio() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<any | null>(null);
  const [creatingFromMetro, setCreatingFromMetro] = useState<PublicMetroSummary | null>(null);

  // Aggregated metro summaries
  const { data: summaries, isLoading: loadingSummaries, refetch: refetchSummaries } = useQuery({
    queryKey: ['civitas-metro-summaries'],
    queryFn: buildPublicMetroSummaries,
    refetchInterval: 5 * 60_000,
  });

  // Existing pages
  const { data: pages, isLoading: loadingPages } = useQuery({
    queryKey: ['public-metro-pages-all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('public_metro_pages')
        .select('*')
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const drafts = pages?.filter((p: any) => p.status === 'draft') || [];
  const published = pages?.filter((p: any) => p.status === 'published') || [];

  // Create page from metro
  const createPage = useMutation({
    mutationFn: async (summary: PublicMetroSummary) => {
      const { error } = await supabase
        .from('public_metro_pages')
        .insert([{
          metro_id: summary.metroId,
          slug: summary.metroSlug,
          display_name: summary.metroName,
          summary: `What we're learning about community life in ${summary.metroName}.`,
          momentum_summary: summary.narrativePatterns.join('. ') || '',
          narrative_summary: '',
          archetypes_active: summary.archetypesActive as unknown as import('@/integrations/supabase/types').Json,
          status: 'draft',
          created_by: user?.id,
        }]);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Metro page draft created');
      qc.invalidateQueries({ queryKey: ['public-metro-pages-all'] });
      qc.invalidateQueries({ queryKey: ['civitas-metro-summaries'] });
      setCreatingFromMetro(null);
    },
    onError: (e: any) => toast.error(e.message || 'Failed to create page'),
  });

  // Update page
  const updatePage = useMutation({
    mutationFn: async (page: any) => {
      const { error } = await supabase
        .from('public_metro_pages')
        .update({
          display_name: page.display_name,
          slug: page.slug,
          summary: page.summary,
          momentum_summary: page.momentum_summary,
          narrative_summary: page.narrative_summary,
          archetypes_active: page.archetypes_active,
          volunteer_patterns: page.volunteer_patterns,
          reflection_block: page.reflection_block,
          status: page.status,
        })
        .eq('id', page.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Page updated');
      qc.invalidateQueries({ queryKey: ['public-metro-pages-all'] });
      setEditing(null);
    },
    onError: (e: any) => toast.error(e.message || 'Failed to update'),
  });

  // Ready metros without pages
  const readyMetros = (summaries || []).filter(
    (s) => s.readiness !== 'not_ready' && !pages?.some((p: any) => p.metro_id === s.metroId)
  );

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      <div>
        <h1 className="text-xl font-serif font-semibold text-foreground">
          Civitas Studio
          <SectionTooltip
             what="Gardener control for public metro narrative pages."
             where="/operator/nexus/civitas"
             why="The Gardener curates and publishes civic pages — no auto-publishing."
          />
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Metro narrative pages reflect civic patterns. You decide what's ready to share.
        </p>
      </div>

      <Tabs defaultValue="readiness" className="space-y-4">
        <TabsList>
          <TabsTrigger value="readiness">
            Metro Readiness {readyMetros.length > 0 && <Badge variant="secondary" className="ml-1.5 text-[10px]">{readyMetros.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="drafts">
            Drafts {drafts.length > 0 && <Badge variant="secondary" className="ml-1.5 text-[10px]">{drafts.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="published">Published</TabsTrigger>
        </TabsList>

        {/* Metro Readiness */}
        <TabsContent value="readiness" className="space-y-4">
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={() => refetchSummaries()}>
              <RefreshCw className="h-4 w-4 mr-2" /> Refresh
            </Button>
          </div>
          {loadingSummaries ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
            </div>
          ) : readyMetros.length > 0 ? (
            <div className="space-y-3">
              {readyMetros.map((metro) => (
                <Card key={metro.metroId} className="rounded-xl border-border/50">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <CardTitle className="text-base font-serif">{metro.metroName}</CardTitle>
                        <div className="flex gap-2 flex-wrap">
                          <Badge variant={readinessColors[metro.readiness] as any} className="text-[10px]">
                            {metro.readiness.replace('_', ' ')}
                          </Badge>
                          <Badge variant="outline" className="text-[10px]">
                            <TrendingUp className="h-3 w-3 mr-1" /> {metro.momentumStatus}
                          </Badge>
                        </div>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => setCreatingFromMetro(metro)}>
                        <Plus className="h-3.5 w-3.5 mr-1" /> Create Page
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      {metro.narrativePatterns.length > 0
                        ? metro.narrativePatterns.join(' · ')
                        : 'Signals building — not enough patterns yet.'}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="rounded-xl">
              <CardContent className="py-12 text-center">
                <MapPin className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No metros ready for public pages yet.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Drafts */}
        <TabsContent value="drafts" className="space-y-4">
          {loadingPages ? (
            <Skeleton className="h-32 w-full rounded-xl" />
          ) : drafts.length > 0 ? (
            <div className="space-y-3">
              {drafts.map((d: any) => (
                <Card key={d.id} className="rounded-xl border-border/50">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <CardTitle className="text-base font-serif">{d.display_name}</CardTitle>
                        <CardDescription className="text-xs mt-1">
                          /metros/{d.slug} · Updated {format(new Date(d.updated_at), 'MMM d, yyyy')}
                        </CardDescription>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => setEditing({ ...d })}>
                        <Edit className="h-3.5 w-3.5 mr-1" /> Edit
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">{d.summary || 'No summary yet.'}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="rounded-xl">
              <CardContent className="py-12 text-center">
                <p className="text-sm text-muted-foreground">No drafts yet. Create one from Metro Readiness.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Published */}
        <TabsContent value="published" className="space-y-4">
          {loadingPages ? (
            <Skeleton className="h-32 w-full rounded-xl" />
          ) : published.length > 0 ? (
            <div className="space-y-3">
              {published.map((p: any) => (
                <Card key={p.id} className="rounded-xl border-border/50">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <CardTitle className="text-base font-serif">{p.display_name}</CardTitle>
                        <CardDescription className="text-xs mt-1">
                          /metros/{p.slug} · Published
                        </CardDescription>
                      </div>
                      <div className="flex gap-1.5 shrink-0">
                        <Button size="sm" variant="outline" asChild>
                          <a href={`/metros/${p.slug}`} target="_blank" rel="noopener noreferrer">
                            <Globe className="h-3.5 w-3.5 mr-1" /> View
                          </a>
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setEditing({ ...p })}>
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="rounded-xl">
              <CardContent className="py-12 text-center">
                <Globe className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No published metro pages yet.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Create from Metro Dialog */}
      <Dialog open={!!creatingFromMetro} onOpenChange={() => setCreatingFromMetro(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-serif">Create Metro Page</DialogTitle>
            <DialogDescription>This creates a draft. You can edit and publish when ready.</DialogDescription>
          </DialogHeader>
          {creatingFromMetro && (
            <div className="space-y-3">
              <div className="rounded-lg bg-muted/30 p-3">
                <p className="text-sm font-medium">{creatingFromMetro.metroName}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Momentum: {creatingFromMetro.momentumStatus} · {creatingFromMetro.anchors90d} anchors · {creatingFromMetro.eventsThisQuarter} events
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreatingFromMetro(null)}>Cancel</Button>
            <Button
              onClick={() => creatingFromMetro && createPage.mutate(creatingFromMetro)}
              disabled={createPage.isPending}
            >
              {createPage.isPending ? 'Creating…' : 'Create Draft'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Page Dialog */}
      <Dialog open={!!editing} onOpenChange={() => setEditing(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif">Edit Metro Page</DialogTitle>
            <DialogDescription>Edit civic narrative content. Publish when ready.</DialogDescription>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>Display Name</Label>
                  <Input value={editing.display_name} onChange={(e) => setEditing({ ...editing, display_name: e.target.value })} />
                </div>
                <div>
                  <Label>Slug</Label>
                  <Input value={editing.slug} onChange={(e) => setEditing({ ...editing, slug: e.target.value })} />
                </div>
              </div>
              <div>
                <Label>Summary</Label>
                <Textarea value={editing.summary || ''} onChange={(e) => setEditing({ ...editing, summary: e.target.value })} rows={2} />
              </div>
              <div>
                <Label>Momentum Summary</Label>
                <Textarea value={editing.momentum_summary || ''} onChange={(e) => setEditing({ ...editing, momentum_summary: e.target.value })} rows={2} />
              </div>
              <div>
                <Label>Narrative Summary</Label>
                <Textarea value={editing.narrative_summary || ''} onChange={(e) => setEditing({ ...editing, narrative_summary: e.target.value })} rows={3} />
              </div>
              <div>
                <Label>Volunteer Patterns</Label>
                <Textarea value={editing.volunteer_patterns || ''} onChange={(e) => setEditing({ ...editing, volunteer_patterns: e.target.value })} rows={2} />
              </div>
              <div>
                <Label>Reflection Block</Label>
                <Textarea value={editing.reflection_block || ''} onChange={(e) => setEditing({ ...editing, reflection_block: e.target.value })} rows={3} className="font-serif italic" />
              </div>
            </div>
          )}
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            {editing?.status === 'draft' && (
              <Button variant="outline" onClick={() => updatePage.mutate({ ...editing, status: 'published' })} disabled={updatePage.isPending}>
                <Globe className="h-4 w-4 mr-1.5" /> Publish
              </Button>
            )}
            {editing?.status === 'published' && (
              <Button variant="outline" onClick={() => updatePage.mutate({ ...editing, status: 'draft' })} disabled={updatePage.isPending}>
                Unpublish
              </Button>
            )}
            <Button onClick={() => updatePage.mutate(editing)} disabled={updatePage.isPending}>
              {updatePage.isPending ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
