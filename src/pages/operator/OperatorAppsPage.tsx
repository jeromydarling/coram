/**
 * OperatorAppsPage — Federation Apps Registry
 *
 * WHAT: List, view, and edit every app in the CROS family.
 * WHERE: /operator/apps (CRESCERE zone)
 * WHY: Single source of truth for which apps participate in the federation,
 *      what capabilities each one exposes, and which Stripe Connect
 *      take-rate applies. Drives the app switcher across the rest of the
 *      Operator Console.
 *
 * Backed by the public.federation_apps table (Phase 0 migration).
 *
 * NOTE: types.ts has not been regenerated yet for the new tables, so we
 * use `as any` casts on supabase.from(...) calls. TODO: regenerate types
 * once the migration ships to staging.
 */
import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import {
  AppWindow, Plus, Pencil, ExternalLink, Search, Globe,
  FileText, Inbox, ShoppingCart, Database, Tag,
} from 'lucide-react';

// ── Types ───────────────────────────────────────────────────────────────

type AppStatus = 'active' | 'paused' | 'sunsetting' | 'archived';

interface FederationApp {
  slug: string;
  display_name: string;
  tagline: string | null;
  primary_domain: string | null;
  staging_domain: string | null;
  supabase_project_ref: string | null;
  status: AppStatus;
  launched_at: string | null;
  has_content_engine: boolean;
  has_lead_intake: boolean;
  has_seo_module: boolean;
  has_connect: boolean;
  has_metro_pages: boolean;
  has_constellation_node: boolean;
  connect_revenue_share_pct: number | null;
  content_publish_url: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

const STATUS_VARIANTS: Record<AppStatus, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  active: 'default',
  paused: 'secondary',
  sunsetting: 'outline',
  archived: 'destructive',
};

// ── Page ────────────────────────────────────────────────────────────────

export default function OperatorAppsPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<AppStatus | 'all'>('all');
  const [editing, setEditing] = useState<FederationApp | null>(null);
  const [creating, setCreating] = useState(false);

  const { data: apps, isLoading, error } = useQuery({
    queryKey: ['federation-apps'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('federation_apps')
        .select('*')
        .order('display_name', { ascending: true });
      if (error) throw error;
      return (data ?? []) as FederationApp[];
    },
  });

  const filtered = useMemo(() => {
    if (!apps) return [];
    return apps.filter((a) => {
      if (statusFilter !== 'all' && a.status !== statusFilter) return false;
      if (!search.trim()) return true;
      const q = search.trim().toLowerCase();
      return (
        a.slug.toLowerCase().includes(q) ||
        a.display_name.toLowerCase().includes(q) ||
        (a.primary_domain ?? '').toLowerCase().includes(q)
      );
    });
  }, [apps, search, statusFilter]);

  const upsert = useMutation({
    mutationFn: async (input: Partial<FederationApp> & { slug: string }) => {
      const { error } = await (supabase as any)
        .from('federation_apps')
        .upsert(input, { onConflict: 'slug' });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['federation-apps'] });
      toast({ title: 'Saved', description: 'App registry updated.' });
      setEditing(null);
      setCreating(false);
    },
    onError: (e: Error) => {
      toast({ title: 'Save failed', description: e.message, variant: 'destructive' });
    },
  });

  return (
    <div className="space-y-6 p-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <AppWindow className="h-7 w-7 text-primary" />
            <h1 className="text-2xl font-semibold">Federation Apps</h1>
          </div>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Every app in the CROS family. Capability flags drive which federated
            modules light up for each app. Per-app Stripe Connect take-rate is
            edited here.
          </p>
        </div>
        <Button onClick={() => setCreating(true)} data-testid="btn-add-app">
          <Plus className="mr-2 h-4 w-4" />
          Add app
        </Button>
      </header>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by slug, name, or domain"
                className="pl-9"
                data-testid="input-search-apps"
              />
            </div>
            <Select
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v as AppStatus | 'all')}
            >
              <SelectTrigger className="w-[180px]" data-testid="select-status-filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="paused">Paused</SelectItem>
                <SelectItem value="sunsetting">Sunsetting</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
            <div className="text-sm text-muted-foreground">
              {filtered.length} of {apps?.length ?? 0}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {error ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
              Failed to load federation apps: {error.message}
            </div>
          ) : isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>App</TableHead>
                    <TableHead>Domain</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Capabilities</TableHead>
                    <TableHead className="text-right">Connect %</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((a) => (
                    <TableRow key={a.slug} data-testid={`row-app-${a.slug}`}>
                      <TableCell>
                        <div className="font-medium">{a.display_name}</div>
                        <div className="font-mono text-xs text-muted-foreground">
                          {a.slug}
                        </div>
                      </TableCell>
                      <TableCell>
                        {a.primary_domain ? (
                          <a
                            href={`https://${a.primary_domain}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                          >
                            {a.primary_domain}
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={STATUS_VARIANTS[a.status]} className="capitalize">
                          {a.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {a.has_content_engine && (
                            <Badge variant="outline" className="gap-1 px-1.5">
                              <FileText className="h-3 w-3" /> content
                            </Badge>
                          )}
                          {a.has_lead_intake && (
                            <Badge variant="outline" className="gap-1 px-1.5">
                              <Inbox className="h-3 w-3" /> leads
                            </Badge>
                          )}
                          {a.has_seo_module && (
                            <Badge variant="outline" className="gap-1 px-1.5">
                              <Tag className="h-3 w-3" /> seo
                            </Badge>
                          )}
                          {a.has_connect && (
                            <Badge variant="outline" className="gap-1 px-1.5">
                              <ShoppingCart className="h-3 w-3" /> connect
                            </Badge>
                          )}
                          {a.has_metro_pages && (
                            <Badge variant="outline" className="gap-1 px-1.5">
                              <Globe className="h-3 w-3" /> metros
                            </Badge>
                          )}
                          {a.has_constellation_node && (
                            <Badge variant="outline" className="gap-1 px-1.5">
                              <Database className="h-3 w-3" /> nexus
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {a.has_connect && a.connect_revenue_share_pct != null
                          ? `${Number(a.connect_revenue_share_pct).toFixed(1)}%`
                          : '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditing(a)}
                          data-testid={`btn-edit-${a.slug}`}
                        >
                          <Pencil className="mr-1 h-3.5 w-3.5" />
                          Edit
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filtered.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="py-12 text-center text-sm text-muted-foreground">
                        No apps match the current filter.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {(editing || creating) && (
        <AppEditDialog
          app={editing}
          isCreating={creating}
          onClose={() => {
            setEditing(null);
            setCreating(false);
          }}
          onSave={(input) => upsert.mutate(input)}
          isSaving={upsert.isPending}
          existingSlugs={apps?.map((a) => a.slug) ?? []}
        />
      )}
    </div>
  );
}

// ── Edit dialog ─────────────────────────────────────────────────────────

interface AppEditDialogProps {
  app: FederationApp | null;
  isCreating: boolean;
  onClose: () => void;
  onSave: (input: Partial<FederationApp> & { slug: string }) => void;
  isSaving: boolean;
  existingSlugs: string[];
}

function AppEditDialog({
  app, isCreating, onClose, onSave, isSaving, existingSlugs,
}: AppEditDialogProps) {
  const [form, setForm] = useState<Partial<FederationApp> & { slug: string }>(
    app ?? {
      slug: '',
      display_name: '',
      tagline: '',
      primary_domain: '',
      staging_domain: '',
      supabase_project_ref: '',
      status: 'active',
      has_content_engine: false,
      has_lead_intake: true,
      has_seo_module: false,
      has_connect: false,
      has_metro_pages: false,
      has_constellation_node: true,
      connect_revenue_share_pct: null,
      content_publish_url: '',
    },
  );

  const slugError = useMemo(() => {
    if (!isCreating) return null;
    if (!form.slug) return 'Slug required';
    if (!/^[a-z][a-z0-9-]{1,63}$/.test(form.slug)) {
      return 'Lowercase letters, digits, and hyphens only; must start with a letter';
    }
    if (existingSlugs.includes(form.slug)) return 'A slug with this name already exists';
    return null;
  }, [form.slug, isCreating, existingSlugs]);

  function set<K extends keyof FederationApp>(k: K, v: FederationApp[K] | null) {
    setForm((prev) => ({ ...prev, [k]: v as never }));
  }

  function submit() {
    if (slugError) return;
    if (!form.display_name?.trim()) return;
    // Coerce empty strings to null for nullable fields.
    const payload: Partial<FederationApp> & { slug: string } = {
      ...form,
      tagline: form.tagline || null,
      primary_domain: form.primary_domain || null,
      staging_domain: form.staging_domain || null,
      supabase_project_ref: form.supabase_project_ref || null,
      content_publish_url: form.content_publish_url || null,
      connect_revenue_share_pct: form.has_connect
        ? (form.connect_revenue_share_pct != null ? Number(form.connect_revenue_share_pct) : null)
        : null,
    };
    onSave(payload);
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isCreating ? 'Add app' : `Edit ${app?.display_name}`}</DialogTitle>
          <DialogDescription>
            {isCreating
              ? 'Register a new app in the CROS federation.'
              : 'Update capability flags, Connect take-rate, and routing.'}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2 sm:grid-cols-2">
          <div className="sm:col-span-1 space-y-1.5">
            <Label htmlFor="slug">Slug</Label>
            <Input
              id="slug"
              value={form.slug}
              disabled={!isCreating}
              onChange={(e) => set('slug', e.target.value as never)}
              placeholder="my-app"
              data-testid="input-slug"
            />
            {slugError && <p className="text-xs text-destructive">{slugError}</p>}
          </div>
          <div className="sm:col-span-1 space-y-1.5">
            <Label htmlFor="display_name">Display name</Label>
            <Input
              id="display_name"
              value={form.display_name ?? ''}
              onChange={(e) => set('display_name', e.target.value as never)}
              placeholder="My App"
              data-testid="input-display-name"
            />
          </div>

          <div className="sm:col-span-2 space-y-1.5">
            <Label htmlFor="tagline">Tagline</Label>
            <Input
              id="tagline"
              value={form.tagline ?? ''}
              onChange={(e) => set('tagline', e.target.value as never)}
              placeholder="Optional one-liner"
            />
          </div>

          <div className="sm:col-span-1 space-y-1.5">
            <Label htmlFor="primary_domain">Primary domain</Label>
            <Input
              id="primary_domain"
              value={form.primary_domain ?? ''}
              onChange={(e) => set('primary_domain', e.target.value as never)}
              placeholder="myapp.com"
            />
          </div>
          <div className="sm:col-span-1 space-y-1.5">
            <Label htmlFor="staging_domain">Staging domain</Label>
            <Input
              id="staging_domain"
              value={form.staging_domain ?? ''}
              onChange={(e) => set('staging_domain', e.target.value as never)}
              placeholder="staging.myapp.com"
            />
          </div>

          <div className="sm:col-span-1 space-y-1.5">
            <Label htmlFor="supabase_project_ref">Supabase project ref</Label>
            <Input
              id="supabase_project_ref"
              value={form.supabase_project_ref ?? ''}
              onChange={(e) => set('supabase_project_ref', e.target.value as never)}
              placeholder="abcd1234"
            />
          </div>
          <div className="sm:col-span-1 space-y-1.5">
            <Label htmlFor="status">Status</Label>
            <Select
              value={form.status ?? 'active'}
              onValueChange={(v) => set('status', v as AppStatus)}
            >
              <SelectTrigger id="status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="paused">Paused</SelectItem>
                <SelectItem value="sunsetting">Sunsetting</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="sm:col-span-2 space-y-2 rounded-md border p-3">
            <div className="text-sm font-medium">Capabilities</div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <CapabilityToggle
                label="Content engine"
                checked={!!form.has_content_engine}
                onChange={(v) => set('has_content_engine', v as never)}
              />
              <CapabilityToggle
                label="Lead intake"
                checked={!!form.has_lead_intake}
                onChange={(v) => set('has_lead_intake', v as never)}
              />
              <CapabilityToggle
                label="SEO module"
                checked={!!form.has_seo_module}
                onChange={(v) => set('has_seo_module', v as never)}
              />
              <CapabilityToggle
                label="Stripe Connect"
                checked={!!form.has_connect}
                onChange={(v) => set('has_connect', v as never)}
              />
              <CapabilityToggle
                label="Metro pages"
                checked={!!form.has_metro_pages}
                onChange={(v) => set('has_metro_pages', v as never)}
              />
              <CapabilityToggle
                label="Constellation node"
                checked={!!form.has_constellation_node}
                onChange={(v) => set('has_constellation_node', v as never)}
              />
            </div>
          </div>

          {form.has_connect && (
            <div className="sm:col-span-2 space-y-1.5">
              <Label htmlFor="connect_pct">Platform take-rate (%)</Label>
              <Input
                id="connect_pct"
                type="number"
                min={0}
                max={100}
                step="0.1"
                value={form.connect_revenue_share_pct ?? ''}
                onChange={(e) =>
                  set(
                    'connect_revenue_share_pct',
                    e.target.value === '' ? null : (Number(e.target.value) as never),
                  )
                }
                placeholder="e.g. 5.0"
              />
              <p className="text-xs text-muted-foreground">
                Percentage CROS keeps from Connect transactions on this app.
              </p>
            </div>
          )}

          {form.has_content_engine && (
            <div className="sm:col-span-2 space-y-1.5">
              <Label htmlFor="content_publish_url">Content publish URL</Label>
              <Input
                id="content_publish_url"
                value={form.content_publish_url ?? ''}
                onChange={(e) => set('content_publish_url', e.target.value as never)}
                placeholder="https://myapp.com/functions/v1/content-fetch"
              />
              <p className="text-xs text-muted-foreground">
                Edge Function on the satellite that pulls federated content for its slug.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={isSaving || !!slugError || !form.display_name?.trim()}
            data-testid="btn-save-app"
          >
            {isSaving ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CapabilityToggle({
  label, checked, onChange,
}: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm">
      <Switch checked={checked} onCheckedChange={onChange} />
      <span>{label}</span>
    </label>
  );
}
