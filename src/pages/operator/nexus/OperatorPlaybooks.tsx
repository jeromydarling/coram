/**
 * OperatorPlaybooks — Internal playbook library for operator workflows.
 *
 * WHAT: Markdown-based playbooks for activation, QA, migration, support, outreach, expansion.
 * WHERE: /operator/nexus/playbooks
 * WHY: Operators need searchable, categorized guides within the console.
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/sonner';
import { BookOpen, Pin, Plus, Search, Trash2, Edit2, Eye, ArrowLeft } from 'lucide-react';

const CATEGORIES = ['activation', 'qa', 'migration', 'support', 'outreach', 'expansion'] as const;
type Category = typeof CATEGORIES[number];

const categoryColors: Record<Category, string> = {
  activation: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  qa: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  migration: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  support: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  outreach: 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300',
  expansion: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
};

interface Playbook {
  id: string;
  title: string;
  category: Category;
  content_md: string;
  is_pinned: boolean;
  created_by: string;
  created_at: string;
}

export default function OperatorPlaybooks() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ title: '', category: 'activation' as Category, content_md: '' });
  const [viewingPlaybook, setViewingPlaybook] = useState<Playbook | null>(null);

  const { data: playbooks, isLoading } = useQuery({
    queryKey: ['operator-playbooks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('operator_playbooks' as any)
        .select('*')
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Playbook[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (values: typeof form & { id?: string }) => {
      if (values.id) {
        const { error } = await supabase
          .from('operator_playbooks' as any)
          .update({ title: values.title, category: values.category, content_md: values.content_md, updated_at: new Date().toISOString() })
          .eq('id', values.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('operator_playbooks' as any)
          .insert({ title: values.title, category: values.category, content_md: values.content_md, created_by: user?.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['operator-playbooks'] });
      toast.success(editingId ? 'Playbook updated' : 'Playbook created');
      setDialogOpen(false);
      setEditingId(null);
      setForm({ title: '', category: 'activation', content_md: '' });
    },
    onError: () => toast.error('Failed to save playbook'),
  });

  const togglePinMutation = useMutation({
    mutationFn: async ({ id, pinned }: { id: string; pinned: boolean }) => {
      const { error } = await supabase.from('operator_playbooks' as any).update({ is_pinned: pinned }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['operator-playbooks'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('operator_playbooks' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['operator-playbooks'] });
      toast.success('Playbook deleted');
    },
  });

  const filtered = (playbooks ?? []).filter((p) => {
    if (filterCategory !== 'all' && p.category !== filterCategory) return false;
    if (search && !p.title.toLowerCase().includes(search.toLowerCase()) && !p.content_md.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const openEdit = (p: Playbook) => {
    setEditingId(p.id);
    setForm({ title: p.title, category: p.category, content_md: p.content_md });
    setDialogOpen(true);
  };

  const openNew = () => {
    setEditingId(null);
    setForm({ title: '', category: 'activation', content_md: '' });
    setDialogOpen(true);
  };

  // Viewing a single playbook
  if (viewingPlaybook) {
    return (
      <div className="space-y-5 max-w-4xl">
        <Button variant="ghost" size="sm" onClick={() => setViewingPlaybook(null)} className="gap-1.5">
          <ArrowLeft className="w-4 h-4" />Back to Playbooks
        </Button>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1">
              {viewingPlaybook.is_pinned && <Pin className="w-3.5 h-3.5 text-primary" />}
              <h1 className="text-xl font-semibold text-foreground font-serif">{viewingPlaybook.title}</h1>
            </div>
            <Badge variant="outline" className={`text-xs ${categoryColors[viewingPlaybook.category] || ''}`}>
              {viewingPlaybook.category}
            </Badge>
          </div>
          <Button variant="outline" size="sm" onClick={() => { openEdit(viewingPlaybook); setViewingPlaybook(null); }}>
            <Edit2 className="w-3.5 h-3.5 mr-1" />Edit
          </Button>
        </div>
        <Card>
          <CardContent className="pt-6">
            <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap font-mono text-sm leading-relaxed text-foreground">
              {viewingPlaybook.content_md}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-4xl">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-foreground font-serif">Playbooks</h1>
          <p className="text-sm text-muted-foreground">Internal guides, scripts, and procedures for operator workflows.</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={openNew}><Plus className="w-4 h-4 mr-1" />New Playbook</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="font-serif">{editingId ? 'Edit Playbook' : 'New Playbook'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <Input placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v as Category })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}
                </SelectContent>
              </Select>
              <Textarea
                placeholder="Write your playbook in markdown..."
                value={form.content_md}
                onChange={(e) => setForm({ ...form, content_md: e.target.value })}
                className="min-h-[200px] font-mono text-sm"
              />
            </div>
            <DialogFooter>
              <Button
                disabled={!form.title.trim() || saveMutation.isPending}
                onClick={() => saveMutation.mutate({ ...form, id: editingId ?? undefined })}
              >
                {saveMutation.isPending ? 'Saving...' : 'Save'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
          <Input className="pl-8" placeholder="Search playbooks..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {CATEGORIES.map((c) => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24" />)}</div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <BookOpen className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No playbooks found. Create your first one above.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((p) => (
            <Card key={p.id} className={`cursor-pointer hover:border-primary/40 transition-colors ${p.is_pinned ? 'border-primary/30' : ''}`} onClick={() => setViewingPlaybook(p)}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {p.is_pinned && <Pin className="w-3 h-3 text-primary shrink-0" />}
                    <CardTitle className="text-sm font-medium truncate">{p.title}</CardTitle>
                  </div>
                  <Badge variant="outline" className={`shrink-0 text-xs ${categoryColors[p.category] || ''}`}>
                    {p.category}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-xs text-muted-foreground line-clamp-2 whitespace-pre-wrap">{p.content_md.slice(0, 200)}</p>
                <div className="flex items-center gap-1 mt-3" onClick={(e) => e.stopPropagation()}>
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setViewingPlaybook(p)}>
                    <Eye className="w-3 h-3 mr-1" />View
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => openEdit(p)}>
                    <Edit2 className="w-3 h-3 mr-1" />Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => togglePinMutation.mutate({ id: p.id, pinned: !p.is_pinned })}
                  >
                    <Pin className="w-3 h-3 mr-1" />{p.is_pinned ? 'Unpin' : 'Pin'}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-destructive hover:text-destructive"
                    onClick={() => { if (confirm('Delete this playbook?')) deleteMutation.mutate(p.id); }}
                  >
                    <Trash2 className="w-3 h-3 mr-1" />Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
