/**
 * OperatorKnowledge — Internal knowledge vault.
 *
 * WHAT: Searchable internal documentation — pricing logic, archetype definitions, marketing scripts, roadmap.
 * WHERE: /operator/nexus/knowledge
 * WHY: Operators need quick access to institutional knowledge without leaving the console.
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/sonner';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { BookOpen, Plus, Search, Edit2, Trash2, Eye, EyeOff, Globe, ExternalLink } from 'lucide-react';
import { CROS_LEXICON, getLexiconCategories, getLexiconByCategory } from '@/content/lexicon';
import { Link } from 'react-router-dom';

interface KnowledgeDoc {
  id: string;
  key: string;
  title: string;
  content_markdown: string;
  active: boolean;
  version: number;
  created_at: string;
  updated_at: string;
}

export default function OperatorKnowledge() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDoc, setEditingDoc] = useState<KnowledgeDoc | null>(null);
  const [form, setForm] = useState({ key: '', title: '', content_markdown: '' });

  const { data: docs, isLoading } = useQuery({
    queryKey: ['operator-knowledge-docs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_knowledge_documents')
        .select('*')
        .order('title', { ascending: true });
      if (error) throw error;
      return (data ?? []) as KnowledgeDoc[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (values: typeof form & { id?: string }) => {
      if (values.id) {
        const { error } = await supabase
          .from('ai_knowledge_documents')
          .update({
            title: values.title,
            content_markdown: values.content_markdown,
            updated_at: new Date().toISOString(),
          })
          .eq('id', values.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('ai_knowledge_documents')
          .insert({
            key: values.key || values.title.toLowerCase().replace(/\s+/g, '_').slice(0, 50),
            title: values.title,
            content_markdown: values.content_markdown,
            created_by: user?.id,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['operator-knowledge-docs'] });
      toast.success(editingDoc ? 'Document updated' : 'Document created');
      setDialogOpen(false);
      setEditingDoc(null);
      setForm({ key: '', title: '', content_markdown: '' });
    },
    onError: () => toast.error('Failed to save document'),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from('ai_knowledge_documents').update({ active }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['operator-knowledge-docs'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('ai_knowledge_documents').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['operator-knowledge-docs'] });
      toast.success('Document deleted');
    },
  });

  const filtered = (docs ?? []).filter((d) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return d.title.toLowerCase().includes(q) || d.content_markdown.toLowerCase().includes(q) || d.key.toLowerCase().includes(q);
  });

  const openEdit = (doc: KnowledgeDoc) => {
    setEditingDoc(doc);
    setForm({ key: doc.key, title: doc.title, content_markdown: doc.content_markdown });
    setDialogOpen(true);
  };

  const openNew = () => {
    setEditingDoc(null);
    setForm({ key: '', title: '', content_markdown: '' });
    setDialogOpen(true);
  };

  return (
    <div className="space-y-5 max-w-4xl">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-foreground font-serif">Knowledge Vault</h1>
          <p className="text-sm text-muted-foreground">Internal documentation — pricing, archetypes, marketing, roadmap, troubleshooting.</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={openNew}><Plus className="w-4 h-4 mr-1" />New Document</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="font-serif">{editingDoc ? 'Edit Document' : 'New Document'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <Input placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              {!editingDoc && (
                <Input placeholder="Key (auto-generated if empty)" value={form.key} onChange={(e) => setForm({ ...form, key: e.target.value })} />
              )}
              <Textarea
                placeholder="Write in markdown..."
                value={form.content_markdown}
                onChange={(e) => setForm({ ...form, content_markdown: e.target.value })}
                className="min-h-[250px] font-mono text-sm"
              />
            </div>
            <DialogFooter>
              <Button
                disabled={!form.title.trim() || saveMutation.isPending}
                onClick={() => saveMutation.mutate({ ...form, id: editingDoc?.id })}
              >
                {saveMutation.isPending ? 'Saving...' : 'Save'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
        <Input className="pl-8" placeholder="Search knowledge base..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <BookOpen className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No documents found.</p>
          </CardContent>
        </Card>
      ) : (
        <Accordion type="multiple" className="space-y-2">
          {filtered.map((doc) => (
            <AccordionItem key={doc.id} value={doc.id} className="border rounded-lg px-1">
              <AccordionTrigger className="hover:no-underline py-3 px-3">
                <div className="flex items-center gap-3 text-left w-full">
                  <div className="p-1.5 rounded-md bg-muted shrink-0">
                    <BookOpen className="w-4 h-4 text-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-foreground text-sm">{doc.title}</span>
                    <span className="text-xs text-muted-foreground ml-2">{doc.key}</span>
                  </div>
                  {!doc.active && <Badge variant="outline" className="text-xs text-muted-foreground">Inactive</Badge>}
                  <Badge variant="outline" className="text-xs">v{doc.version}</Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-3 pb-4 space-y-3">
                <div className="text-sm text-muted-foreground whitespace-pre-wrap font-mono bg-muted/30 rounded-md p-3 max-h-[300px] overflow-y-auto">
                  {doc.content_markdown}
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => openEdit(doc)}>
                    <Edit2 className="w-3 h-3 mr-1" />Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => toggleActiveMutation.mutate({ id: doc.id, active: !doc.active })}
                  >
                    {doc.active ? <><EyeOff className="w-3 h-3 mr-1" />Deactivate</> : <><Eye className="w-3 h-3 mr-1" />Activate</>}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-destructive hover:text-destructive"
                    onClick={() => { if (confirm('Delete this document?')) deleteMutation.mutate(doc.id); }}
                  >
                    <Trash2 className="w-3 h-3 mr-1" />Delete
                  </Button>
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}

      {/* Lexicon Coverage Panel */}
      <LexiconCoveragePanel />
    </div>
  );
}

function LexiconCoveragePanel() {
  const categories = getLexiconCategories();

  return (
    <section className="mt-8 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold font-serif flex items-center gap-2">
          <Globe className="h-4 w-4" />
          Lexicon Coverage
        </h2>
        <Link to="/lexicon" target="_blank">
          <Button variant="outline" size="sm" className="gap-1.5 text-xs">
            <ExternalLink className="h-3 w-3" /> View Lexicon
          </Button>
        </Link>
      </div>

      <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Total Terms</p>
            <p className="text-2xl font-semibold font-serif">{CROS_LEXICON.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Categories</p>
            <p className="text-2xl font-semibold font-serif">{categories.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">By Category</p>
            <div className="flex flex-wrap gap-1 mt-1">
              {categories.map((cat) => (
                <Badge key={cat} variant="secondary" className="text-[10px]">
                  {cat}: {getLexiconByCategory(cat).length}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
