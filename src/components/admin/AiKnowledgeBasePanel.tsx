import { useState, useMemo, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Loader2, Save, History, ChevronLeft, Eye, FileText } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { format } from 'date-fns';
import {
  useKbDocuments,
  useKbDocumentVersions,
  useUpdateKbDocument,
  useToggleKbDocActive,
  type KbDocument,
  type KbDocumentVersion,
} from '@/hooks/useAiKnowledgeBase';
import { PdfUploadButton } from './PdfUploadButton';

function DocCard({ doc, onEdit }: { doc: KbDocument; onEdit: (doc: KbDocument) => void }) {
  const toggleActive = useToggleKbDocActive();

  return (
    <Card className="cursor-pointer hover:border-primary/30 transition-colors overflow-hidden" onClick={() => onEdit(doc)}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-2 min-w-0">
              <FileText className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
              <CardTitle className="text-sm leading-snug min-w-0 break-words">{doc.title}</CardTitle>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
            <Switch
              checked={doc.active}
              onCheckedChange={(checked) => toggleActive.mutate({ id: doc.id, active: checked })}
            />
            <Badge variant={doc.active ? 'default' : 'secondary'} className="hidden sm:inline-flex">
              {doc.active ? 'Active' : 'Inactive'}
            </Badge>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-1 overflow-hidden text-ellipsis">
          <code className="bg-muted px-1 rounded text-[10px]">{doc.key}</code> · v{doc.version} · {format(new Date(doc.updated_at), 'MMM d, yyyy')}
        </p>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground line-clamp-2 break-all overflow-hidden">{doc.content_markdown.substring(0, 150)}</p>
      </CardContent>
    </Card>
  );
}

function DocEditor({ doc, onBack }: { doc: KbDocument; onBack: () => void }) {
  const draftKey = `kb-draft-${doc.id}`;
  const draftUrlsKey = `kb-draft-urls-${doc.id}`;

  // Restore draft from sessionStorage if available, otherwise use DB content
  const [baseContent] = useState(() => doc.content_markdown);
  const [baseUrls] = useState(() => doc.source_urls.join('\n'));
  const [content, setContent] = useState(() => {
    const draft = sessionStorage.getItem(draftKey);
    return draft !== null ? draft : doc.content_markdown;
  });
  const [sourceUrls, setSourceUrls] = useState(() => {
    const draft = sessionStorage.getItem(draftUrlsKey);
    return draft !== null ? draft : doc.source_urls.join('\n');
  });
  const [showVersions, setShowVersions] = useState(false);
  const [previewVersion, setPreviewVersion] = useState<KbDocumentVersion | null>(null);
  const updateDoc = useUpdateKbDocument();
  const { data: versions = [] } = useKbDocumentVersions(doc.id);

  const hasChanges = content !== baseContent || sourceUrls !== baseUrls;

  // Persist drafts to sessionStorage on change
  useEffect(() => {
    if (content !== doc.content_markdown) {
      sessionStorage.setItem(draftKey, content);
    } else {
      sessionStorage.removeItem(draftKey);
    }
  }, [content, doc.content_markdown, draftKey]);

  useEffect(() => {
    const joined = doc.source_urls.join('\n');
    if (sourceUrls !== joined) {
      sessionStorage.setItem(draftUrlsKey, sourceUrls);
    } else {
      sessionStorage.removeItem(draftUrlsKey);
    }
  }, [sourceUrls, doc.source_urls, draftUrlsKey]);

  const handleSave = useCallback(() => {
    const urls = sourceUrls.split('\n').map(u => u.trim()).filter(Boolean);
    updateDoc.mutate({
      id: doc.id,
      content_markdown: content,
      source_urls: urls,
    }, {
      onSuccess: () => {
        // Clear drafts after successful save
        sessionStorage.removeItem(draftKey);
        sessionStorage.removeItem(draftUrlsKey);
      },
    });
  }, [sourceUrls, content, doc.id, updateDoc, draftKey, draftUrlsKey]);

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ChevronLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold truncate">{doc.title}</h3>
            <p className="text-xs text-muted-foreground truncate">
              Key: <code className="bg-muted px-1 rounded">{doc.key}</code> · v{doc.version}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowVersions(true)}>
            <History className="h-4 w-4 mr-1" /> History ({versions.length})
          </Button>
          <Button size="sm" onClick={handleSave} disabled={!hasChanges || updateDoc.isPending}>
            {updateDoc.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
            Save (v{doc.version + 1})
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Content (Markdown)</Label>
        <Textarea
          className="min-h-[400px] font-mono text-sm"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Enter markdown content..."
        />
      </div>

      <div className="space-y-2">
        <Label>Source URLs (one per line)</Label>
        <Input
          value={sourceUrls}
          onChange={(e) => setSourceUrls(e.target.value)}
          placeholder="https://example.com/about"
        />
      </div>

      {/* Version History Dialog */}
      <Dialog open={showVersions} onOpenChange={setShowVersions}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Version History — {doc.title}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-[500px]">
            <div className="space-y-3">
              {versions.map((v) => (
                <Card key={v.id} className="p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">v{v.version}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(v.created_at), 'MMM d, yyyy HH:mm')}
                      </span>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setPreviewVersion(v)}>
                      <Eye className="h-3 w-3 mr-1" /> View
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">{v.content_markdown.substring(0, 150)}</p>
                </Card>
              ))}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Version Preview */}
      <Dialog open={!!previewVersion} onOpenChange={() => setPreviewVersion(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Version {previewVersion?.version}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-[500px]">
            <pre className="text-sm whitespace-pre-wrap font-mono bg-muted p-4 rounded">
              {previewVersion?.content_markdown}
            </pre>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function AiKnowledgeBasePanel() {
  const { data: documents = [], isLoading } = useKbDocuments();
  const [searchParams, setSearchParams] = useSearchParams();
  const editDocId = searchParams.get('doc');

  const editingDoc = useMemo(
    () => (editDocId ? (documents.find((d) => d.id === editDocId) as KbDocument | undefined) ?? null : null),
    [editDocId, documents],
  );

  const setEditingDoc = (doc: KbDocument | null) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (doc) {
        next.set('doc', doc.id);
      } else {
        next.delete('doc');
      }
      return next;
    }, { replace: true });
  };

  if (isLoading && documents.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (editingDoc) {
    return <DocEditor key={editingDoc.id} doc={editingDoc} onBack={() => setEditingDoc(null)} />;
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div className="min-w-0">
              <CardTitle>AI Knowledge Base</CardTitle>
              <CardDescription className="mt-1">
                Manage authoritative company information used by all AI features. Changes create new versions — previous versions are preserved.
              </CardDescription>
            </div>
            <PdfUploadButton />
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            {documents.map((doc) => (
              <DocCard key={doc.id} doc={doc as KbDocument} onEdit={(d) => setEditingDoc(d)} />
            ))}
            {documents.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">No knowledge base documents found.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
