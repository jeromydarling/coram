/**
 * OperatorNarrativeStudio — Living Narrative Index curation workspace.
 *
 * WHAT: Surfaces emerging narrative patterns, drafts, and published stories.
 * WHERE: /operator/nexus/narrative-studio
 * WHY: Operators curate stories from real signals — no auto-publishing.
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { BookOpen, Edit, Eye, Globe, Sparkles, Trash2, RefreshCw, Feather, Archive } from 'lucide-react';
import { toast } from '@/components/ui/sonner';
import { format } from 'date-fns';
import { aggregateNarrativeSignals, type NarrativeSignal } from '@/lib/nri/narrativeSignals';
import { HelpTooltip } from '@/components/ui/help-tooltip';
const SectionTooltip = HelpTooltip;

const strengthColors: Record<string, string> = {
  strong: 'default',
  growing: 'secondary',
  emerging: 'outline',
};

export default function OperatorNarrativeStudio() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [editingStory, setEditingStory] = useState<any | null>(null);
  const [draftFromSignal, setDraftFromSignal] = useState<NarrativeSignal | null>(null);

  // Fetch emerging signals
  const { data: signals, isLoading: loadingSignals, refetch: refetchSignals } = useQuery({
    queryKey: ['narrative-signals'],
    queryFn: aggregateNarrativeSignals,
    refetchInterval: 5 * 60_000,
  });

  // Fetch stories from DB
  const { data: stories, isLoading: loadingStories } = useQuery({
    queryKey: ['narrative-stories-all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('narrative_stories')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const drafts = stories?.filter((s: any) => s.status === 'draft') || [];
  const published = stories?.filter((s: any) => s.status === 'published') || [];
  const archived = stories?.filter((s: any) => s.status === 'archived') || [];

  // Create draft from signal
  const createDraft = useMutation({
    mutationFn: async (signal: NarrativeSignal) => {
      const { error } = await supabase
        .from('narrative_stories')
        .insert([{
          slug: signal.suggested_slug,
          title: signal.pattern,
          role: signal.role,
          archetype: signal.archetype,
          pattern_source: signal.source_data as any,
          summary: signal.summary,
          body: '',
          status: 'draft',
          created_by: user?.id,
        }]);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Draft created');
      qc.invalidateQueries({ queryKey: ['narrative-stories-all'] });
      setDraftFromSignal(null);
    },
    onError: (e: any) => toast.error(e.message || 'Could not create draft'),
  });

  // Update story
  const updateStory = useMutation({
    mutationFn: async (story: any) => {
      const { error } = await supabase
        .from('narrative_stories')
        .update({
          title: story.title,
          slug: story.slug,
          role: story.role,
          archetype: story.archetype,
          summary: story.summary,
          body: story.body,
          status: story.status,
        })
        .eq('id', story.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Story updated');
      qc.invalidateQueries({ queryKey: ['narrative-stories-all'] });
      setEditingStory(null);
    },
    onError: (e: any) => toast.error(e.message || 'Could not update story'),
  });

  // Delete story
  const deleteStory = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('narrative_stories')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Story deleted');
      qc.invalidateQueries({ queryKey: ['narrative-stories-all'] });
    },
  });

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      <div>
        <h1 className="text-xl font-serif font-semibold text-foreground">Narrative Studio</h1>
        <p className="text-sm text-muted-foreground mt-1">
          These patterns are emerging across the network. Would you like to share what the system is learning?
        </p>
      </div>

      <Tabs defaultValue="emerging" className="space-y-4">
        <TabsList>
          <TabsTrigger value="emerging">
            Emerging Stories {signals && signals.length > 0 && <Badge variant="secondary" className="ml-1.5 text-[10px]">{signals.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="drafts">
            Drafts {drafts.length > 0 && <Badge variant="secondary" className="ml-1.5 text-[10px]">{drafts.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="published">Published</TabsTrigger>
        </TabsList>

        {/* Emerging Stories */}
        <TabsContent value="emerging" className="space-y-4">
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={() => refetchSignals()}>
              <RefreshCw className="h-4 w-4 mr-2" /> Refresh signals
            </Button>
          </div>
          {loadingSignals ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-32 w-full rounded-xl" />)}
            </div>
          ) : signals && signals.length > 0 ? (
            <div className="space-y-3">
              {signals.map((signal) => (
                <Card key={signal.id} className="rounded-xl border-border/50">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <CardTitle className="text-base font-serif">{signal.pattern}</CardTitle>
                        <div className="flex gap-2 flex-wrap">
                          <Badge variant={strengthColors[signal.strength] as any} className="text-[10px]">
                            {signal.strength}
                          </Badge>
                          <Badge variant="outline" className="text-[10px]">{signal.role}</Badge>
                          <Badge variant="outline" className="text-[10px]">{signal.source_type}</Badge>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setDraftFromSignal(signal)}
                        className="shrink-0"
                      >
                        <Edit className="h-3.5 w-3.5 mr-1.5" /> Open Draft
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground leading-relaxed">{signal.summary}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="rounded-xl">
              <CardContent className="py-12 text-center">
                <Feather className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground font-serif italic">
                  No emerging patterns right now. Stories surface as tenants work.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Drafts */}
        <TabsContent value="drafts" className="space-y-4">
          {loadingStories ? (
            <Skeleton className="h-32 w-full rounded-xl" />
          ) : drafts.length > 0 ? (
            <div className="space-y-3">
              {drafts.map((d: any) => (
                <Card key={d.id} className="rounded-xl border-border/50">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <CardTitle className="text-base font-serif">{d.title}</CardTitle>
                        <CardDescription className="text-xs mt-1">
                          /{d.slug} · {d.role || '—'} · Created {format(new Date(d.created_at), 'MMM d, yyyy')}
                        </CardDescription>
                      </div>
                      <div className="flex gap-1.5 shrink-0">
                        <Button size="sm" variant="outline" onClick={() => setEditingStory({ ...d })}>
                          <Edit className="h-3.5 w-3.5 mr-1" /> Edit
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => deleteStory.mutate(d.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
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
                <BookOpen className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No drafts yet. Create one from an emerging signal.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Published */}
        <TabsContent value="published" className="space-y-4">
          {loadingStories ? (
            <Skeleton className="h-32 w-full rounded-xl" />
          ) : published.length > 0 ? (
            <div className="space-y-3">
              {published.map((p: any) => (
                <Card key={p.id} className="rounded-xl border-border/50">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <CardTitle className="text-base font-serif">{p.title}</CardTitle>
                        <CardDescription className="text-xs mt-1">
                          /stories/{p.slug} · {p.role || '—'} · Published {format(new Date(p.updated_at), 'MMM d, yyyy')}
                        </CardDescription>
                      </div>
                      <div className="flex gap-1.5 shrink-0">
                        <Button size="sm" variant="outline" asChild>
                          <a href={`/stories/${p.slug}`} target="_blank" rel="noopener noreferrer">
                            <Eye className="h-3.5 w-3.5 mr-1" /> View
                          </a>
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setEditingStory({ ...p })}>
                          <Edit className="h-3.5 w-3.5 mr-1" /> Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateStory.mutate({ ...p, status: 'archived' })}
                        >
                          <Archive className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">{p.summary}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="rounded-xl">
              <CardContent className="py-12 text-center">
                <Globe className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No published stories yet.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Create Draft Dialog */}
      <Dialog open={!!draftFromSignal} onOpenChange={() => setDraftFromSignal(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-serif">Create Story Draft</DialogTitle>
            <DialogDescription>This signal will become a draft. You can edit it before publishing.</DialogDescription>
          </DialogHeader>
          {draftFromSignal && (
            <div className="space-y-3">
              <div className="rounded-lg bg-muted/30 p-3">
                <p className="text-sm font-medium">{draftFromSignal.pattern}</p>
                <p className="text-xs text-muted-foreground mt-1">{draftFromSignal.summary}</p>
              </div>
              <div className="flex gap-2">
                <Badge variant="outline" className="text-xs">{draftFromSignal.role}</Badge>
                <Badge variant="outline" className="text-xs">{draftFromSignal.source_type}</Badge>
                <Badge variant={strengthColors[draftFromSignal.strength] as any} className="text-xs">{draftFromSignal.strength}</Badge>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDraftFromSignal(null)}>Cancel</Button>
            <Button
              onClick={() => draftFromSignal && createDraft.mutate(draftFromSignal)}
              disabled={createDraft.isPending}
            >
              {createDraft.isPending ? 'Creating…' : 'Create Draft'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Story Dialog */}
      <Dialog open={!!editingStory} onOpenChange={() => setEditingStory(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif">Edit Story</DialogTitle>
            <DialogDescription>Edit the story content and publish when ready.</DialogDescription>
          </DialogHeader>
          {editingStory && (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>Title</Label>
                  <Input
                    value={editingStory.title}
                    onChange={(e) => setEditingStory({ ...editingStory, title: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Slug</Label>
                  <Input
                    value={editingStory.slug}
                    onChange={(e) => setEditingStory({ ...editingStory, slug: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>Role</Label>
                  <Input
                    value={editingStory.role || ''}
                    onChange={(e) => setEditingStory({ ...editingStory, role: e.target.value })}
                    placeholder="shepherd, companion, visitor…"
                  />
                </div>
                <div>
                  <Label>Archetype</Label>
                  <Input
                    value={editingStory.archetype || ''}
                    onChange={(e) => setEditingStory({ ...editingStory, archetype: e.target.value })}
                    placeholder="church, digital_inclusion…"
                  />
                </div>
              </div>
              <div>
                <Label>Summary</Label>
                <Textarea
                  value={editingStory.summary || ''}
                  onChange={(e) => setEditingStory({ ...editingStory, summary: e.target.value })}
                  rows={2}
                  placeholder="A brief summary for SEO and previews…"
                />
              </div>
              <div>
                <Label>Body</Label>
                <Textarea
                  value={editingStory.body || ''}
                  onChange={(e) => setEditingStory({ ...editingStory, body: e.target.value })}
                  rows={12}
                  placeholder="Write the narrative story here. Use paragraphs to separate sections…"
                  className="font-serif"
                />
              </div>
            </div>
          )}
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setEditingStory(null)}>Cancel</Button>
            {editingStory?.status === 'draft' && (
              <Button
                variant="outline"
                onClick={() => updateStory.mutate({ ...editingStory, status: 'published' })}
                disabled={updateStory.isPending}
              >
                <Globe className="h-4 w-4 mr-1.5" /> Publish
              </Button>
            )}
            {editingStory?.status === 'published' && (
              <Button
                variant="outline"
                onClick={() => updateStory.mutate({ ...editingStory, status: 'draft' })}
                disabled={updateStory.isPending}
              >
                Unpublish
              </Button>
            )}
            <Button
              onClick={() => updateStory.mutate(editingStory)}
              disabled={updateStory.isPending}
            >
              {updateStory.isPending ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
