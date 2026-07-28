/**
 * OperatorScientiaTemplatesPage — Federation essay templates.
 *
 * WHAT: CRUD for public.essay_templates (Phase 1.5 federation primitive).
 * WHERE: /operator/scientia/templates
 * WHY: Lifted from bitokus content_essay_templates pattern. Reusable prompt
 *      scaffolds (name + prompt + voice notes + category). NULL source_app
 *      means the template is available to every federated app.
 *
 * RLS auto-scopes by has_gardener_grant(source_app); NULL templates are
 * world-readable for any authenticated gardener but only writable by '*'
 * grantees (the federation Gardener).
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { recordAudit } from '@/lib/federatedAudit';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { toast } from '@/components/ui/sonner';
import { ArrowLeft, Plus, Pencil, Trash2, Globe, Sparkles } from 'lucide-react';

interface EssayTemplate {
  id: string;
  source_app: string | null;
  name: string;
  prompt: string;
  voice_notes: string | null;
  category: string | null;
  enabled: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

interface FederationAppLite { slug: string; display_name: string }

const GLOBAL_VALUE = '__global__';

function useTemplates() {
  return useQuery({
    queryKey: ['scientia', 'templates'],
    queryFn: async (): Promise<EssayTemplate[]> => {
      const { data, error } = await (supabase as any)
        .from('essay_templates')
        .select('id, source_app, name, prompt, voice_notes, category, enabled, created_by, created_at, updated_at')
        .order('source_app', { ascending: true, nullsFirst: true })
        .order('name');
      if (error) throw error;
      return (data ?? []) as EssayTemplate[];
    },
    staleTime: 30_000,
  });
}

function useApps() {
  return useQuery({
    queryKey: ['scientia', 'federation-apps', 'all'],
    queryFn: async (): Promise<FederationAppLite[]> => {
      const { data, error } = await (supabase as any)
        .from('federation_apps')
        .select('slug, display_name')
        .eq('has_content_engine', true)
        .order('display_name');
      if (error) throw error;
      return (data ?? []) as FederationAppLite[];
    },
    staleTime: 60_000,
  });
}

interface FormState {
  id: string | null;
  source_app: string | null;
  name: string;
  prompt: string;
  voice_notes: string;
  category: string;
}

const EMPTY_FORM: FormState = {
  id: null,
  source_app: null,
  name: '',
  prompt: '',
  voice_notes: '',
  category: '',
};

export default function OperatorScientiaTemplatesPage() {
  const qc = useQueryClient();
  const { data: templates = [], isLoading } = useTemplates();
  const { data: apps = [] } = useApps();

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [open, setOpen] = useState(false);

  const openNew = () => { setForm(EMPTY_FORM); setOpen(true); };
  const openEdit = (t: EssayTemplate) => {
    setForm({
      id: t.id,
      source_app: t.source_app,
      name: t.name,
      prompt: t.prompt,
      voice_notes: t.voice_notes ?? '',
      category: t.category ?? '',
    });
    setOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: async (f: FormState) => {
      const payload = {
        source_app: f.source_app,
        name: f.name.trim(),
        prompt: f.prompt.trim(),
        voice_notes: f.voice_notes.trim() || null,
        category: f.category.trim() || null,
      };
      if (f.id) {
        const { error } = await (supabase as any)
          .from('essay_templates')
          .update(payload)
          .eq('id', f.id);
        if (error) throw error;
        void recordAudit({
          sourceApp: f.source_app ?? 'thecros',
          action: 'template.update',
          resource: `essay_templates:${f.id}`,
          payload: { name: payload.name },
        });
      } else {
        const { data, error } = await (supabase as any)
          .from('essay_templates')
          .insert(payload)
          .select('id')
          .single();
        if (error) throw error;
        void recordAudit({
          sourceApp: f.source_app ?? 'thecros',
          action: 'template.create',
          resource: `essay_templates:${data?.id}`,
          payload: { name: payload.name },
        });
      }
    },
    onSuccess: () => {
      toast.success('Template saved');
      setOpen(false);
      qc.invalidateQueries({ queryKey: ['scientia', 'templates'] });
    },
    onError: (e: any) => toast.error(e.message ?? 'Save failed'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (t: EssayTemplate) => {
      const { error } = await (supabase as any)
        .from('essay_templates')
        .delete()
        .eq('id', t.id);
      if (error) throw error;
      void recordAudit({
        sourceApp: t.source_app ?? 'thecros',
        action: 'template.delete',
        resource: `essay_templates:${t.id}`,
        payload: { name: t.name },
      });
    },
    onSuccess: () => {
      toast.success('Template deleted');
      qc.invalidateQueries({ queryKey: ['scientia', 'templates'] });
    },
    onError: (e: any) => toast.error(e.message ?? 'Delete failed'),
  });

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <Link to="/operator/scientia" className="text-xs text-muted-foreground hover:underline inline-flex items-center mb-2">
            <ArrowLeft className="h-3 w-3 mr-1" /> Back to Scientia
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">Essay Templates</h1>
          <p className="text-sm text-muted-foreground">
            Reusable prompt scaffolds for AI generation. Global templates (no app) are available to every satellite.
          </p>
        </div>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-1" /> New template</Button>
      </header>

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : templates.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center text-sm text-muted-foreground">
            <Sparkles className="mx-auto h-10 w-10 mb-3 opacity-50" />
            No templates yet. Create one to standardize prompt scaffolds across apps.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {templates.map((t) => (
            <Card key={t.id} className={!t.enabled ? 'opacity-60' : ''}>
              <CardHeader className="flex flex-row items-start justify-between gap-4 pb-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <CardTitle className="text-base">{t.name}</CardTitle>
                    {t.source_app === null ? (
                      <Badge variant="outline"><Globe className="h-3 w-3 mr-1" /> Global</Badge>
                    ) : (
                      <Badge variant="outline" className="font-mono text-xs">{t.source_app}</Badge>
                    )}
                    {t.category && <Badge variant="secondary">{t.category}</Badge>}
                  </div>
                  <CardDescription className="text-xs">
                    Updated {format(new Date(t.updated_at), 'MMM d, yyyy')}
                  </CardDescription>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={() => openEdit(t)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (confirm(`Delete template "${t.name}"?`)) deleteMutation.mutate(t);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground line-clamp-3 whitespace-pre-wrap">
                  {t.prompt}
                </p>
                {t.voice_notes && (
                  <p className="text-xs text-muted-foreground mt-2 italic line-clamp-2">
                    Voice: {t.voice_notes}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{form.id ? 'Edit template' : 'New template'}</DialogTitle>
            <DialogDescription>
              Prompt scaffolds reused across drafts. Pick "Global" to share across the federation.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium mb-1 block">Scope</label>
                <Select
                  value={form.source_app ?? GLOBAL_VALUE}
                  onValueChange={(v) =>
                    setForm({ ...form, source_app: v === GLOBAL_VALUE ? null : v })
                  }
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={GLOBAL_VALUE}>Global (all apps)</SelectItem>
                    {apps.map((a) => (
                      <SelectItem key={a.slug} value={a.slug}>{a.display_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block">Category (optional)</label>
                <Input
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  placeholder="e.g. devotional, news-commentary"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block">Name</label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Sunday reflection"
              />
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block">Prompt</label>
              <Textarea
                value={form.prompt}
                onChange={(e) => setForm({ ...form, prompt: e.target.value })}
                placeholder="The full prompt scaffold. Use {{topic}}, {{source}}, etc. for variables."
                rows={8}
              />
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block">Voice notes (optional)</label>
              <Textarea
                value={form.voice_notes}
                onChange={(e) => setForm({ ...form, voice_notes: e.target.value })}
                placeholder="Tone, perspective, audience"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              onClick={() => saveMutation.mutate(form)}
              disabled={!form.name.trim() || !form.prompt.trim() || saveMutation.isPending}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
