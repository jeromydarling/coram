/**
 * FrictionPlaybookDraftsPanel — Playbook Drafts stream for Knowledge Zone.
 *
 * WHAT: Lists NRI-generated playbook drafts with Publish, Edit, Dismiss actions.
 * WHERE: Embedded in OperatorSignumPage and OperatorKnowledge.
 * WHY: Transforms learning friction into publishable guidance for tenants.
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from '@/components/ui/sonner';
import { usePlaybookDrafts, useUpdatePlaybookDraft, type PlaybookDraft } from '@/hooks/useFrictionInsights';
import { BookOpen, Check, Edit2, Eye, XCircle } from 'lucide-react';
import { HelpTooltip } from '@/components/ui/help-tooltip';
const SectionTooltip = HelpTooltip;

const statusColors: Record<string, string> = {
  draft: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  published: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  dismissed: 'bg-muted text-muted-foreground',
};

export function FrictionPlaybookDraftsPanel() {
  const [statusFilter, setStatusFilter] = useState('draft');
  const [previewDraft, setPreviewDraft] = useState<PlaybookDraft | null>(null);
  const [editDraft, setEditDraft] = useState<PlaybookDraft | null>(null);
  const [editMarkdown, setEditMarkdown] = useState('');

  const { data: drafts, isLoading } = usePlaybookDrafts({ status: statusFilter });
  const updateMutation = useUpdatePlaybookDraft();

  const handlePublish = (draft: PlaybookDraft) => {
    updateMutation.mutate({ id: draft.id, status: 'published' });
  };

  const handleDismiss = (draft: PlaybookDraft) => {
    updateMutation.mutate({ id: draft.id, status: 'dismissed' });
  };

  const handleEdit = (draft: PlaybookDraft) => {
    setEditDraft(draft);
    setEditMarkdown(draft.draft_markdown);
  };

  const handleSaveEdit = () => {
    if (!editDraft) return;
    updateMutation.mutate(
      { id: editDraft.id, status: editDraft.status, draft_markdown: editMarkdown },
      {
        onSuccess: () => {
          setEditDraft(null);
          toast.success('Draft saved');
        },
      },
    );
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-muted-foreground" />
            <CardTitle className="text-base font-serif">Playbook Drafts</CardTitle>
            <SectionTooltip
              what="NRI-drafted learning playbooks from friction where people eventually succeed."
              where="nri_playbook_drafts"
              why="Transforms detour patterns into publishable guidance — the system is fine, people need a path."
            />
          </div>
          <CardDescription>When people take detours but eventually arrive — guidance helps.</CardDescription>
          <div className="flex gap-2 mt-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[130px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="draft">Drafts</SelectItem>
                <SelectItem value="published">Published</SelectItem>
                <SelectItem value="dismissed">Dismissed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-16" />
              <Skeleton className="h-16" />
            </div>
          ) : !drafts || drafts.length === 0 ? (
            <p className="text-sm text-muted-foreground italic py-4 text-center">
              No playbook drafts yet — run friction insights to generate guidance from patterns.
            </p>
          ) : (
            <div className="space-y-3">
              {drafts.map((d) => (
                <div
                  key={d.id}
                  className="border rounded-lg p-3 space-y-2 hover:border-primary/20 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{d.title}</p>
                      {d.role && (
                        <p className="text-xs text-muted-foreground mt-0.5">Role: {d.role}</p>
                      )}
                    </div>
                    <Badge className={`text-xs shrink-0 ${statusColors[d.status] || ''}`}>
                      {d.status}
                    </Badge>
                  </div>
                  <div className="flex gap-1.5 pt-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs"
                      onClick={() => setPreviewDraft(d)}
                    >
                      <Eye className="w-3 h-3 mr-1" /> Preview
                    </Button>
                    {d.status === 'draft' && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          onClick={() => handlePublish(d)}
                          disabled={updateMutation.isPending}
                        >
                          <Check className="w-3 h-3 mr-1" /> Publish
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs"
                          onClick={() => handleEdit(d)}
                        >
                          <Edit2 className="w-3 h-3 mr-1" /> Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs text-muted-foreground"
                          onClick={() => handleDismiss(d)}
                          disabled={updateMutation.isPending}
                        >
                          <XCircle className="w-3 h-3 mr-1" /> Dismiss
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Preview Dialog */}
      <Dialog open={!!previewDraft} onOpenChange={() => setPreviewDraft(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="font-serif text-lg">{previewDraft?.title}</DialogTitle>
          </DialogHeader>
          {previewDraft && (
            <ScrollArea className="max-h-[60vh]">
              <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap pr-4">
                {previewDraft.draft_markdown}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editDraft} onOpenChange={() => setEditDraft(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="font-serif text-lg">Edit Draft</DialogTitle>
          </DialogHeader>
          <Textarea
            value={editMarkdown}
            onChange={(e) => setEditMarkdown(e.target.value)}
            className="min-h-[300px] font-mono text-xs"
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditDraft(null)}>Cancel</Button>
            <Button onClick={handleSaveEdit} disabled={updateMutation.isPending}>
              Save Draft
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
