/**
 * OperatorScientiaPage — Federated Content Console.
 *
 * WHAT: One unified surface for the federation's SEO/essay content workflow:
 *       Drafts → Approval Queue → Published. Scoped per source_app.
 * WHERE: /operator/scientia (with tabs ?tab=drafts|approval|published)
 * WHY: Eliminates the per-satellite content authoring duplication. The
 *      Gardener writes, approves, and publishes from one inbox.
 *
 * Phase A scope (this file):
 *   - thecros's own data only (source_app = 'thecros') — but the App Switcher
 *     and source_app filter are wired up so satellites can onboard in B-E
 *     just by backfilling rows; no UI change required at that point.
 *   - Drafts list (status in draft/rejected) with quick actions
 *   - Approval Queue inbox (status = pending_approval) with bulk actions
 *   - Published list (status in published/scheduled/unpublished)
 *   - Individual drafts open the existing OperatorContentStudio editor via
 *     /operator/nexus/content?focus=:id (no editor-rebuild required this phase)
 *
 * Backed by:
 *   - public.operator_content_drafts (Phase 1.5 migration adds source_app,
 *     widened status enum, approval/publish columns)
 *   - public.content_approval_log (Phase 1.5)
 *   - public.federation_apps (Phase 0 — drives App Switcher)
 *   - public.federated_audit (Phase 0 — every status transition is mirrored
 *     via recordAudit so the cross-app audit log shows content events too)
 *
 * RLS: every read/write is automatically scoped by has_gardener_grant(source_app).
 * The Gardener with '*' grant sees everything. No client-side authorization.
 *
 * NOTE: types.ts hasn't been regenerated for the new federation columns yet
 * (status enum widened, source_app added). We narrow with `as any` on the
 * supabase calls — same pattern as OperatorAuditPage and OperatorAppsPage.
 * TODO: regenerate once migration is on staging.
 */
import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { recordAudit } from '@/lib/federatedAudit';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { toast } from '@/components/ui/sonner';
import {
  Inbox, FileText, CheckCircle2, Globe, ExternalLink, Edit3, Send,
  RotateCcw, XCircle, Clock, Eye, EyeOff, RefreshCw, Sparkles,
} from 'lucide-react';

// ── Types ───────────────────────────────────────────────────────────────

type DraftStatus =
  | 'draft'
  | 'pending_approval'
  | 'approved'
  | 'scheduled'
  | 'published'
  | 'unpublished'
  | 'rejected';

interface ContentDraftRow {
  id: string;
  source_app: string;
  status: DraftStatus;
  draft_type: string;
  title: string;
  body: string;
  slug: string | null;
  voice_profile: string;
  generator: string | null;
  template_id: string | null;
  approved_by: string | null;
  approved_at: string | null;
  scheduled_for: string | null;
  published_at: string | null;
  unpublished_at: string | null;
  public_url: string | null;
  review_notes: string | null;
  hero_image_url?: string | null;
  created_at: string;
  updated_at: string;
}

interface FederationAppLite {
  slug: string;
  display_name: string;
  has_content_engine: boolean;
}

type ScientiaTab = 'drafts' | 'approval' | 'published';

const STATUS_LABEL: Record<DraftStatus, string> = {
  draft: 'Draft',
  pending_approval: 'In review',
  approved: 'Approved',
  scheduled: 'Scheduled',
  published: 'Published',
  unpublished: 'Unpublished',
  rejected: 'Sent back',
};

const STATUS_VARIANT: Record<DraftStatus, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  draft: 'secondary',
  pending_approval: 'default',
  approved: 'default',
  scheduled: 'outline',
  published: 'default',
  unpublished: 'outline',
  rejected: 'destructive',
};

const TABS: Array<{ value: ScientiaTab; label: string; icon: React.ElementType; statuses: DraftStatus[] }> = [
  { value: 'drafts',    label: 'Drafts',          icon: FileText,     statuses: ['draft', 'rejected'] },
  { value: 'approval',  label: 'Approval Queue',  icon: Inbox,        statuses: ['pending_approval'] },
  { value: 'published', label: 'Published',       icon: Globe,        statuses: ['approved', 'scheduled', 'published', 'unpublished'] },
];

// ── Helpers ─────────────────────────────────────────────────────────────

function fmt(ts: string | null): string {
  if (!ts) return '—';
  try { return format(new Date(ts), 'MMM d, h:mm a'); } catch { return ts; }
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

// ── Federation Apps query (drives App Switcher) ─────────────────────────

function useFederationApps() {
  return useQuery({
    queryKey: ['scientia', 'federation-apps'],
    queryFn: async (): Promise<FederationAppLite[]> => {
      const { data, error } = await (supabase as any)
        .from('federation_apps')
        .select('slug, display_name, has_content_engine')
        .eq('has_content_engine', true)
        .order('display_name');
      if (error) throw error;
      return (data ?? []) as FederationAppLite[];
    },
    staleTime: 60_000,
  });
}

// ── Drafts query — filter by status set + app + search ──────────────────

interface DraftQueryArgs {
  statuses: DraftStatus[];
  apps: string[];           // empty = all the user can see
  search: string;
}

function useDrafts(args: DraftQueryArgs) {
  return useQuery({
    queryKey: ['scientia', 'drafts', args],
    queryFn: async (): Promise<ContentDraftRow[]> => {
      let q = (supabase as any)
        .from('operator_content_drafts')
        .select(
          'id, source_app, status, draft_type, title, body, slug, voice_profile, generator, template_id,' +
          ' approved_by, approved_at, scheduled_for, published_at, unpublished_at,' +
          ' public_url, review_notes, hero_image_url, created_at, updated_at',
        )
        .in('status', args.statuses)
        .order('updated_at', { ascending: false })
        .limit(200);

      if (args.apps.length > 0) q = q.in('source_app', args.apps);
      if (args.search.trim()) q = q.ilike('title', `%${args.search.trim()}%`);

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as ContentDraftRow[];
    },
    staleTime: 5_000,
  });
}

// ── Mutations: approve / send back / publish / unpublish / schedule ─────

interface TransitionInput {
  draftId: string;
  sourceApp: string;
  fromStatus: DraftStatus;
  toStatus: DraftStatus;
  reviewNotes?: string;
  scheduledFor?: string | null;
  publicUrl?: string | null;
}

async function applyTransition(input: TransitionInput): Promise<void> {
  const now = new Date().toISOString();
  const { data: { user } } = await supabase.auth.getUser();
  const actorId = user?.id ?? null;

  const updates: Record<string, unknown> = {
    status: input.toStatus,
    updated_at: now,
  };

  if (input.toStatus === 'approved') {
    updates.approved_by = actorId;
    updates.approved_at = now;
    updates.review_notes = null;
  }
  if (input.toStatus === 'rejected') {
    updates.review_notes = input.reviewNotes ?? null;
    updates.approved_by = null;
    updates.approved_at = null;
  }
  if (input.toStatus === 'scheduled') {
    updates.scheduled_for = input.scheduledFor;
  }
  if (input.toStatus === 'published') {
    updates.published_at = now;
    updates.unpublished_at = null;
    if (input.publicUrl !== undefined) updates.public_url = input.publicUrl;
  }
  if (input.toStatus === 'unpublished') {
    updates.unpublished_at = now;
  }
  if (input.toStatus === 'draft') {
    // sending back to draft from rejected — keep notes, clear approval
    updates.approved_by = null;
    updates.approved_at = null;
    updates.scheduled_for = null;
  }

  const { error } = await (supabase as any)
    .from('operator_content_drafts')
    .update(updates)
    .eq('id', input.draftId);
  if (error) throw error;

  // Append to content_approval_log (in addition to RLS-safe federated_audit below)
  await (supabase as any).from('content_approval_log').insert({
    draft_id: input.draftId,
    source_app: input.sourceApp,
    actor: actorId,
    from_status: input.fromStatus,
    to_status: input.toStatus,
    notes: input.reviewNotes ?? null,
  });

  // Mirror to federated audit (fire-and-forget — never blocks UI)
  void recordAudit({
    sourceApp: input.sourceApp,
    action: `content.${input.toStatus}`,
    resource: `operator_content_drafts:${input.draftId}`,
    payload: { from: input.fromStatus, to: input.toStatus },
  });
}

// ── Component: AppSwitcher (multi-select) ───────────────────────────────

function AppSwitcher({
  selected, onChange, apps, isLoading,
}: {
  selected: string[];
  onChange: (next: string[]) => void;
  apps: FederationAppLite[];
  isLoading: boolean;
}) {
  if (isLoading) return <Skeleton className="h-9 w-48" />;
  // Single-select for v1 simplicity — empty = "All apps"
  // Multi-select can be added later without changing the data shape
  const value = selected.length === 1 ? selected[0] : '__all__';
  return (
    <Select
      value={value}
      onValueChange={(v) => onChange(v === '__all__' ? [] : [v])}
    >
      <SelectTrigger className="h-9 w-48" data-testid="scientia-app-switcher">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__all__">All apps</SelectItem>
        {apps.map((a) => (
          <SelectItem key={a.slug} value={a.slug}>{a.display_name}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// ── Component: StatusBadge ──────────────────────────────────────────────

function StatusBadge({ status }: { status: DraftStatus }) {
  return <Badge variant={STATUS_VARIANT[status]}>{STATUS_LABEL[status]}</Badge>;
}

// ── Component: AppBadge (small) ─────────────────────────────────────────

function AppBadge({ slug, apps }: { slug: string; apps: FederationAppLite[] }) {
  const app = apps.find((a) => a.slug === slug);
  return (
    <Badge variant="outline" className="font-mono text-xs">
      {app?.display_name ?? slug}
    </Badge>
  );
}

// ── Sub-page: Drafts tab ────────────────────────────────────────────────

function DraftsTab({
  apps, selectedApps, search,
}: {
  apps: FederationAppLite[];
  selectedApps: string[];
  search: string;
}) {
  const qc = useQueryClient();
  const { data, isLoading, error, refetch } = useDrafts({
    statuses: ['draft', 'rejected'],
    apps: selectedApps,
    search,
  });

  const submitMutation = useMutation({
    mutationFn: (row: ContentDraftRow) =>
      applyTransition({
        draftId: row.id,
        sourceApp: row.source_app,
        fromStatus: row.status,
        toStatus: 'pending_approval',
      }),
    onSuccess: () => {
      toast.success('Sent for review');
      qc.invalidateQueries({ queryKey: ['scientia'] });
    },
    onError: (e: any) => toast.error(e.message ?? 'Failed to submit'),
  });

  if (isLoading) return <Skeleton className="h-64 w-full" />;
  if (error) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-destructive">
          Couldn’t load drafts: {(error as Error).message}
        </CardContent>
      </Card>
    );
  }
  if (!data || data.length === 0) {
    return (
      <Card>
        <CardContent className="p-12 text-center text-sm text-muted-foreground">
          <FileText className="mx-auto h-10 w-10 mb-3 opacity-50" />
          No drafts in flight. Generate one from{' '}
          <Link to="/operator/nexus/content" className="underline">Content Studio</Link>.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">{data.length} draft{data.length === 1 ? '' : 's'}</CardTitle>
        <Button variant="ghost" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>App</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Updated</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row) => (
              <TableRow key={row.id}>
                <TableCell><AppBadge slug={row.source_app} apps={apps} /></TableCell>
                <TableCell className="max-w-md">
                  <div className="font-medium truncate">{row.title || '(untitled)'}</div>
                  {row.review_notes && (
                    <div className="text-xs text-destructive mt-1 line-clamp-1">
                      Sent back: {row.review_notes}
                    </div>
                  )}
                </TableCell>
                <TableCell><StatusBadge status={row.status} /></TableCell>
                <TableCell className="text-xs text-muted-foreground">{fmt(row.updated_at)}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button asChild variant="ghost" size="sm">
                      <Link to={`/operator/nexus/content?focus=${row.id}`}>
                        <Edit3 className="h-4 w-4 mr-1" /> Edit
                      </Link>
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => submitMutation.mutate(row)}
                      disabled={submitMutation.isPending}
                    >
                      <Send className="h-4 w-4 mr-1" /> Submit
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// ── Sub-page: Approval Queue tab (bulk-action inbox) ────────────────────

function ApprovalQueueTab({
  apps, selectedApps, search,
}: {
  apps: FederationAppLite[];
  selectedApps: string[];
  search: string;
}) {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [rejectDialog, setRejectDialog] = useState<{ rows: ContentDraftRow[] } | null>(null);
  const [rejectNotes, setRejectNotes] = useState('');

  const { data, isLoading, error, refetch } = useDrafts({
    statuses: ['pending_approval'],
    apps: selectedApps,
    search,
  });

  // Reset selection when data set changes
  const visibleIds = useMemo(() => new Set((data ?? []).map((r) => r.id)), [data]);
  const cleanSelection = (s: Set<string>) => new Set([...s].filter((id) => visibleIds.has(id)));

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };
  const toggleAll = () => {
    if (!data) return;
    if (selected.size === data.length) setSelected(new Set());
    else setSelected(new Set(data.map((r) => r.id)));
  };

  const selectedRows = useMemo(
    () => (data ?? []).filter((r) => selected.has(r.id)),
    [data, selected],
  );

  const approveMutation = useMutation({
    mutationFn: async (rows: ContentDraftRow[]) => {
      for (const r of rows) {
        await applyTransition({
          draftId: r.id,
          sourceApp: r.source_app,
          fromStatus: 'pending_approval',
          toStatus: 'approved',
        });
      }
    },
    onSuccess: (_, rows) => {
      toast.success(`Approved ${rows.length} draft${rows.length === 1 ? '' : 's'}`);
      setSelected(new Set());
      qc.invalidateQueries({ queryKey: ['scientia'] });
    },
    onError: (e: any) => toast.error(e.message ?? 'Approval failed'),
  });

  const publishMutation = useMutation({
    mutationFn: async (rows: ContentDraftRow[]) => {
      for (const r of rows) {
        // Auto-approve + publish in one shot for the "approve & publish" flow
        await applyTransition({
          draftId: r.id,
          sourceApp: r.source_app,
          fromStatus: 'pending_approval',
          toStatus: 'approved',
        });
        await applyTransition({
          draftId: r.id,
          sourceApp: r.source_app,
          fromStatus: 'approved',
          toStatus: 'published',
        });
        // Auto-slug if missing
        if (!r.slug) {
          await (supabase as any)
            .from('operator_content_drafts')
            .update({ slug: slugify(r.title) })
            .eq('id', r.id);
        }
      }
    },
    onSuccess: (_, rows) => {
      toast.success(`Published ${rows.length} draft${rows.length === 1 ? '' : 's'}`);
      setSelected(new Set());
      qc.invalidateQueries({ queryKey: ['scientia'] });
    },
    onError: (e: any) => toast.error(e.message ?? 'Publish failed'),
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ rows, notes }: { rows: ContentDraftRow[]; notes: string }) => {
      for (const r of rows) {
        await applyTransition({
          draftId: r.id,
          sourceApp: r.source_app,
          fromStatus: 'pending_approval',
          toStatus: 'rejected',
          reviewNotes: notes,
        });
      }
    },
    onSuccess: (_, { rows }) => {
      toast.success(`Sent back ${rows.length} draft${rows.length === 1 ? '' : 's'}`);
      setSelected(new Set());
      setRejectDialog(null);
      setRejectNotes('');
      qc.invalidateQueries({ queryKey: ['scientia'] });
    },
    onError: (e: any) => toast.error(e.message ?? 'Reject failed'),
  });

  if (isLoading) return <Skeleton className="h-64 w-full" />;
  if (error) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-destructive">
          Couldn’t load queue: {(error as Error).message}
        </CardContent>
      </Card>
    );
  }
  if (!data || data.length === 0) {
    return (
      <Card>
        <CardContent className="p-12 text-center text-sm text-muted-foreground">
          <Inbox className="mx-auto h-10 w-10 mb-3 opacity-50" />
          Inbox zero. Nothing to review.
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle className="text-base">
            {data.length} awaiting · {new Set(data.map((r) => r.source_app)).size} app
            {new Set(data.map((r) => r.source_app)).size === 1 ? '' : 's'}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={selected.size > 0 && selected.size === data.length}
                    onCheckedChange={toggleAll}
                    aria-label="Select all"
                  />
                </TableHead>
                <TableHead>App</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead className="text-right">Open</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((row) => (
                <TableRow
                  key={row.id}
                  className={selected.has(row.id) ? 'bg-accent/40' : ''}
                  onClick={() => toggle(row.id)}
                  style={{ cursor: 'pointer' }}
                >
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selected.has(row.id)}
                      onCheckedChange={() => toggle(row.id)}
                    />
                  </TableCell>
                  <TableCell><AppBadge slug={row.source_app} apps={apps} /></TableCell>
                  <TableCell className="max-w-md">
                    <div className="font-medium truncate">{row.title || '(untitled)'}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {row.draft_type} · {row.voice_profile}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{fmt(row.updated_at)}</TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <Button asChild variant="ghost" size="sm">
                      <Link to={`/operator/nexus/content?focus=${row.id}`}>
                        <Edit3 className="h-4 w-4" />
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {selected.size > 0 && (
        <div
          className="sticky bottom-4 mx-auto mt-4 flex w-fit items-center gap-2 rounded-lg border bg-background p-2 shadow-lg"
          data-testid="scientia-bulk-actions"
        >
          <span className="px-2 text-sm font-medium">{selected.size} selected</span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => approveMutation.mutate(selectedRows)}
            disabled={approveMutation.isPending}
          >
            <CheckCircle2 className="h-4 w-4 mr-1" /> Approve
          </Button>
          <Button
            size="sm"
            onClick={() => publishMutation.mutate(selectedRows)}
            disabled={publishMutation.isPending}
          >
            <Sparkles className="h-4 w-4 mr-1" /> Approve & publish
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setRejectDialog({ rows: selectedRows })}
          >
            <RotateCcw className="h-4 w-4 mr-1" /> Send back
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
            <XCircle className="h-4 w-4" />
          </Button>
        </div>
      )}

      <Dialog open={!!rejectDialog} onOpenChange={(o) => !o && setRejectDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send back {rejectDialog?.rows.length} draft{(rejectDialog?.rows.length ?? 0) === 1 ? '' : 's'}</DialogTitle>
            <DialogDescription>
              Add notes for the writer. The drafts return to the Drafts tab marked as Sent back.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={rejectNotes}
            onChange={(e) => setRejectNotes(e.target.value)}
            placeholder="What needs to change?"
            rows={4}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialog(null)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={!rejectNotes.trim() || rejectMutation.isPending}
              onClick={() =>
                rejectDialog && rejectMutation.mutate({ rows: rejectDialog.rows, notes: rejectNotes.trim() })
              }
            >
              Send back
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ── Sub-page: Published tab ─────────────────────────────────────────────

function PublishedTab({
  apps, selectedApps, search,
}: {
  apps: FederationAppLite[];
  selectedApps: string[];
  search: string;
}) {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<DraftStatus | 'all'>('all');

  const { data, isLoading, error, refetch } = useDrafts({
    statuses: ['approved', 'scheduled', 'published', 'unpublished'],
    apps: selectedApps,
    search,
  });

  const filtered = useMemo(() => {
    if (!data) return [];
    if (statusFilter === 'all') return data;
    return data.filter((r) => r.status === statusFilter);
  }, [data, statusFilter]);

  const unpublishMutation = useMutation({
    mutationFn: (row: ContentDraftRow) =>
      applyTransition({
        draftId: row.id,
        sourceApp: row.source_app,
        fromStatus: row.status,
        toStatus: 'unpublished',
      }),
    onSuccess: () => {
      toast.success('Unpublished');
      qc.invalidateQueries({ queryKey: ['scientia'] });
    },
    onError: (e: any) => toast.error(e.message ?? 'Failed'),
  });

  const republishMutation = useMutation({
    mutationFn: (row: ContentDraftRow) =>
      applyTransition({
        draftId: row.id,
        sourceApp: row.source_app,
        fromStatus: row.status,
        toStatus: 'published',
      }),
    onSuccess: () => {
      toast.success('Published');
      qc.invalidateQueries({ queryKey: ['scientia'] });
    },
    onError: (e: any) => toast.error(e.message ?? 'Failed'),
  });

  if (isLoading) return <Skeleton className="h-64 w-full" />;
  if (error) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-destructive">
          Couldn’t load: {(error as Error).message}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <div>
          <CardTitle className="text-base">{filtered.length} item{filtered.length === 1 ? '' : 's'}</CardTitle>
          <CardDescription>Approved, scheduled, live, and unpublished drafts.</CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as DraftStatus | 'all')}>
            <SelectTrigger className="h-9 w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="scheduled">Scheduled</SelectItem>
              <SelectItem value="published">Published</SelectItem>
              <SelectItem value="unpublished">Unpublished</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="ghost" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {filtered.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">
            <Globe className="mx-auto h-10 w-10 mb-3 opacity-50" />
            Nothing here yet.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>App</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>When</TableHead>
                <TableHead>URL</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((row) => (
                <TableRow key={row.id}>
                  <TableCell><AppBadge slug={row.source_app} apps={apps} /></TableCell>
                  <TableCell className="max-w-md">
                    <div className="font-medium truncate">{row.title || '(untitled)'}</div>
                  </TableCell>
                  <TableCell><StatusBadge status={row.status} /></TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {row.status === 'scheduled' && row.scheduled_for ? (
                      <span><Clock className="inline h-3 w-3 mr-1" />{fmt(row.scheduled_for)}</span>
                    ) : row.status === 'published' || row.status === 'unpublished' ? (
                      fmt(row.published_at)
                    ) : (
                      fmt(row.approved_at)
                    )}
                  </TableCell>
                  <TableCell>
                    {row.public_url ? (
                      <a
                        href={row.public_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-primary hover:underline inline-flex items-center"
                      >
                        Open <ExternalLink className="h-3 w-3 ml-1" />
                      </a>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button asChild variant="ghost" size="sm">
                        <Link to={`/operator/nexus/content?focus=${row.id}`}>
                          <Edit3 className="h-4 w-4" />
                        </Link>
                      </Button>
                      {row.status === 'published' ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => unpublishMutation.mutate(row)}
                        >
                          <EyeOff className="h-4 w-4 mr-1" /> Unpublish
                        </Button>
                      ) : row.status === 'unpublished' ? (
                        <Button
                          size="sm"
                          onClick={() => republishMutation.mutate(row)}
                        >
                          <Eye className="h-4 w-4 mr-1" /> Republish
                        </Button>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

// ── Page shell ──────────────────────────────────────────────────────────

export default function OperatorScientiaPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = (searchParams.get('tab') as ScientiaTab) || 'drafts';
  const appParam = searchParams.get('app') ?? '';
  const selectedApps = appParam ? appParam.split(',').filter(Boolean) : [];
  const [search, setSearch] = useState('');

  const { data: apps = [], isLoading: appsLoading } = useFederationApps();

  const setTab = (next: ScientiaTab) => {
    const sp = new URLSearchParams(searchParams);
    sp.set('tab', next);
    setSearchParams(sp, { replace: true });
  };

  const setApps = (next: string[]) => {
    const sp = new URLSearchParams(searchParams);
    if (next.length === 0) sp.delete('app');
    else sp.set('app', next.join(','));
    setSearchParams(sp, { replace: true });
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Scientia</h1>
          <p className="text-sm text-muted-foreground">
            Federated content workflow — write, approve, publish across the CROS family.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <AppSwitcher
            selected={selectedApps}
            onChange={setApps}
            apps={apps}
            isLoading={appsLoading}
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search titles…"
            className="h-9 w-56"
          />
        </div>
      </header>

      <Tabs value={tab} onValueChange={(v) => setTab(v as ScientiaTab)}>
        <TabsList>
          {TABS.map((t) => {
            const Icon = t.icon;
            return (
              <TabsTrigger key={t.value} value={t.value} data-testid={`scientia-tab-${t.value}`}>
                <Icon className="h-4 w-4 mr-1.5" />
                {t.label}
              </TabsTrigger>
            );
          })}
        </TabsList>

        <TabsContent value="drafts" className="mt-4">
          <DraftsTab apps={apps} selectedApps={selectedApps} search={search} />
        </TabsContent>
        <TabsContent value="approval" className="mt-4">
          <ApprovalQueueTab apps={apps} selectedApps={selectedApps} search={search} />
        </TabsContent>
        <TabsContent value="published" className="mt-4">
          <PublishedTab apps={apps} selectedApps={selectedApps} search={search} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
