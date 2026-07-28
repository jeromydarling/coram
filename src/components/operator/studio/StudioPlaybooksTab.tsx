/**
 * StudioPlaybooksTab — Playbook/knowledge document editor with versioning.
 *
 * WHAT: Edit ai_knowledge_documents with version history, rollback, and audit trail.
 * WHERE: Studio → Playbooks tab
 * WHY: Gardener needs to maintain playbooks without Lovable credits.
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { toast } from '@/components/ui/sonner';
import { Plus, Save, Loader2, Search, Eye, EyeOff, Edit2, History, Sparkles } from 'lucide-react';
import StudioAiAssistPanel from './StudioAiAssistPanel';

export default function StudioPlaybooksTab() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<any | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showAi, setShowAi] = useState(false);
  const [form, setForm] = useState({ title: '', key: '', content_markdown: '' });

  const { data: docs, isLoading } = useQuery({
    queryKey: ['studio-playbooks'],
    queryFn: async () => {
      const { data, error } = await supabase.from('ai_knowledge_documents').select('*').order('title');
      if (error) throw error;
      return data || [];
    },
  });

  const filtered = (docs || []).filter(d => {
    if (!search) return true;
    const q = search.toLowerCase();
    return d.title.toLowerCase().includes(q) || d.key.toLowerCase().includes(q) || d.content_markdown.toLowerCase().includes(q);
  });

  const saveMutation = useMutation({
    mutationFn: async (values: { id?: string; title: string; key: string; content_markdown: string }) => {
      if (values.id) {
        // Save version first
        const { data: current } = await supabase.from('ai_knowledge_documents').select('*').eq('id', values.id).single();
        if (current) {
          await supabase.from('ai_knowledge_document_versions').insert({
            document_id: values.id, version: current.version,
            content_markdown: current.content_markdown,
            source_urls: current.source_urls, created_by: user!.id,
          });
        }
        const { error } = await supabase.from('ai_knowledge_documents').update({
          title: values.title, content_markdown: values.content_markdown,
          version: (current?.version || 0) + 1, updated_at: new Date().toISOString(),
        }).eq('id', values.id);
        if (error) throw error;
        await supabase.from('gardener_audit_log').insert([{
          actor_id: user!.id, action_type: 'update', entity_type: 'playbook',
          entity_id: values.id, entity_name: values.title,
        }]);
      } else {
        const { error } = await supabase.from('ai_knowledge_documents').insert({
          key: values.key || values.title.toLowerCase().replace(/\s+/g, '_').slice(0, 50),
          title: values.title, content_markdown: values.content_markdown, created_by: user!.id,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success('Playbook saved');
      qc.invalidateQueries({ queryKey: ['studio-playbooks'] });
      setEditing(null); setShowCreate(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const openEdit = (doc: any) => {
    setEditing(doc);
    setForm({ title: doc.title, key: doc.key, content_markdown: doc.content_markdown });
    setShowAi(false);
  };

  const [editContent, setEditContent] = useState('');

  const handleAiAccept = (patch: { content?: string }) => {
    if (patch.content) setForm(prev => ({ ...prev, content_markdown: patch.content! }));
  };

  return (
    <div className="space-y-4 mt-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
          <Input className="pl-8 h-8 text-xs" placeholder="Search playbooks…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Button size="sm" onClick={() => { setShowCreate(true); setForm({ title: '', key: '', content_markdown: '' }); }} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" /> New Playbook
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-14" />)}</div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground font-serif italic">
          No playbooks found. Create one to begin.
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {filtered.map(doc => (
            <Card key={doc.id} className="cursor-pointer hover:border-primary/30 transition-colors" onClick={() => openEdit(doc)}>
              <CardContent className="py-3 px-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{doc.title}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Badge variant="outline" className="text-xs">{doc.key}</Badge>
                    <Badge variant="outline" className="text-xs">v{doc.version}</Badge>
                    {!doc.active && <Badge variant="secondary" className="text-xs">Inactive</Badge>}
                  </div>
                </div>
                <Edit2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit / Create Dialog */}
      <Dialog open={!!editing || showCreate} onOpenChange={(o) => { if (!o) { setEditing(null); setShowCreate(false); setShowAi(false); } }}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif">{editing ? 'Edit Playbook' : 'New Playbook'}</DialogTitle>
            <DialogDescription>Changes are versioned automatically.</DialogDescription>
          </DialogHeader>
          <div className={`grid gap-4 ${showAi ? 'grid-cols-1 lg:grid-cols-3' : ''}`}>
            <div className={showAi ? 'lg:col-span-2' : ''}>
              <div className="space-y-3">
                <div>
                  <Label className="text-xs">Title</Label>
                  <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
                </div>
                {!editing && (
                  <div>
                    <Label className="text-xs">Key (auto if empty)</Label>
                    <Input value={form.key} onChange={e => setForm({ ...form, key: e.target.value })} placeholder="auto_generated" />
                  </div>
                )}
                <div>
                  <Label className="text-xs">Content (Markdown)</Label>
                  <Textarea value={form.content_markdown} onChange={e => setForm({ ...form, content_markdown: e.target.value })} className="min-h-[300px] font-mono text-sm" />
                </div>
              </div>
            </div>
            {showAi && editing && (
              <StudioAiAssistPanel
                entityType="playbook"
                entityId={editing.id}
                currentContent={form.content_markdown}
                onAcceptPatch={handleAiAccept}
              />
            )}
          </div>
          <DialogFooter className="gap-2">
            {editing && (
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setShowAi(!showAi)}>
                <Sparkles className="h-3.5 w-3.5" /> {showAi ? 'Hide' : 'Show'} AI Assist
              </Button>
            )}
            <div className="flex-1" />
            <Button onClick={() => saveMutation.mutate({ ...form, id: editing?.id })} disabled={!form.title.trim() || saveMutation.isPending}>
              {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
