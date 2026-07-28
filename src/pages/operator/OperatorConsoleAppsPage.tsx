/**
 * OperatorConsoleAppsPage — Federation Apps Registry (Gardener Console view)
 *
 * WHAT:  Read + lightweight edit surface over public.federation_apps,
 *        grouped by tier (Hub / Federation / Adjacent).
 * WHERE: /operator/console/apps — sits inside OperatorShell which already
 *        enforces the gardener route guard.
 * WHY:   Single source of truth for which apps are part of the CROS
 *        federation, their Sentry slug, SEO state, and Lovable URLs.
 *
 * Reads from edge function `console-apps` (service-role) and writes
 * through `console-apps-update` (gardener-guarded). The registry table
 * `federation_apps` still uses `slug` as its PK; the edge function
 * exposes it as `source_app` to match the spec.
 */
import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  AppWindow, ExternalLink, Pencil, Search, Check,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ConsoleApp {
  source_app: string;
  slug: string;
  display_name: string;
  short_description: string | null;
  tagline: string | null;
  lovable_url: string | null;
  primary_domain: string | null;
  github_repo: string | null;
  hosting_platform: string;
  tier: 'hub' | 'federation' | 'adjacent' | 'excluded';
  federation_phase: string | null;
  is_critical: boolean;
  sentry_org_slug: string | null;
  sentry_project_slug: string | null;
  seo_active: boolean;
  status: 'active' | 'prelaunch' | 'paused' | 'sunsetting' | 'archived';
  last_publish_at: string | null;
  last_publish_error: string | null;
  notes: string | null;
}

type FilterChip = 'all' | 'federation' | 'adjacent' | 'prelaunch';

const TIER_ORDER: Array<ConsoleApp['tier']> = ['hub', 'federation', 'adjacent', 'excluded'];
const TIER_LABEL: Record<ConsoleApp['tier'], string> = {
  hub: 'Hub',
  federation: 'Federation',
  adjacent: 'Adjacent',
  excluded: 'Excluded',
};

function statusVariant(status: ConsoleApp['status']) {
  switch (status) {
    case 'active': return 'default' as const;
    case 'prelaunch': return 'secondary' as const;
    case 'paused':
    case 'sunsetting':
      return 'outline' as const;
    case 'archived':
      return 'destructive' as const;
    default: return 'outline' as const;
  }
}

function formatTimestamp(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

async function fetchApps(): Promise<ConsoleApp[]> {
  const response = await fetch(
    `${SUPABASE_URL}/functions/v1/console-apps`,
    {
      method: 'GET',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
    }
  );
  if (!response.ok) throw new Error(`console-apps failed: ${response.status}`);
  const data = await response.json();
  return (data?.apps ?? []) as ConsoleApp[];
}

export default function OperatorConsoleAppsPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [chip, setChip] = useState<FilterChip>('all');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<ConsoleApp | null>(null);
  const [sessionInfo, setSessionInfo] = useState<string | null>(null);
  const [revealLoading, setRevealLoading] = useState(false);

  const { data: apps = [], isLoading, error } = useQuery({
    queryKey: ['console-apps'],
    queryFn: fetchApps,
    staleTime: 30_000,
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return apps.filter((a) => {
      if (chip === 'federation' && a.tier !== 'federation' && a.tier !== 'hub') return false;
      if (chip === 'adjacent' && a.tier !== 'adjacent') return false;
      if (chip === 'prelaunch' && a.status !== 'prelaunch') return false;
      if (q) {
        const hay = `${a.display_name} ${a.source_app}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [apps, chip, search]);

  const grouped = useMemo(() => {
    const groups = new Map<ConsoleApp['tier'], ConsoleApp[]>();
    for (const t of TIER_ORDER) groups.set(t, []);
    for (const app of filtered) groups.get(app.tier)?.push(app);
    return groups;
  }, [filtered]);

  const [importing, setImporting] = useState(false);
  const handleImportSchola = async () => {
    setImporting(true);
    try {
      const { data, error } = await supabase.functions.invoke('import-schola-sources', {
        method: 'POST',
      });
      if (error) throw error;
      toast({
        title: 'Schola sources imported',
        description: `${data?.sources_imported ?? 0} feeds, ${data?.items_imported ?? 0} items, ${data?.templates_imported ?? 0} templates${data?.errors?.length ? ` · ${data.errors.length} errors` : ''}`,
      });
    } catch (e) {
      toast({
        title: "Didn't complete",
        description: (e as Error).message,
        variant: 'destructive',
      });
    } finally {
      setImporting(false);
    }
  };

  const handleRevealSession = async () => {
    setRevealLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      let diagResult = '';
      try {
        const r = await fetch(
          'https://zmeawjhxbgvtcfcfcygf.supabase.co/functions/v1/console-apps?seo_active=true',
          { headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY } }
        );
        diagResult = `Direct fetch OK: HTTP ${r.status}, ${(await r.json())?.apps?.length ?? '?'} apps`;
      } catch (e: any) {
        diagResult = `Direct fetch FAILED: ${e.name}: ${e.message}`;
      }
      const info = {
        access_token: session?.access_token ?? 'none',
        expires_at: session?.expires_at ?? 'none',
        user_email: session?.user?.email ?? 'none',
        user_id: session?.user?.id ?? 'none',
        diag: diagResult,
        origin: window.location.origin,
        ua: navigator.userAgent,
      };
      setSessionInfo(JSON.stringify(info, null, 2));
    } catch (e: any) {
      setSessionInfo(`Error: ${e.message}`);
    } finally {
      setRevealLoading(false);
    }
  };

  const handleCopyToken = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        await navigator.clipboard.writeText(session.access_token);
        toast({ title: 'Token copied' });
      }
    } catch (e: any) {
      toast({ title: 'Copy failed', description: e.message, variant: 'destructive' });
    }
  };

  return (
    <div className="p-6 space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-serif flex items-center gap-2">
            <AppWindow className="h-6 w-6 text-muted-foreground" /> Federation Apps
          </h1>
          <p className="text-sm text-muted-foreground max-w-2xl">
            The registry of every app in the CROS family. This is read-mostly —
            edits flow through gentle changes to tier, status, and stewardship notes.
          </p>
        </div>
      </header>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-serif">Tools</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {sessionInfo && (
            <div className="space-y-2">
              <pre className="text-xs font-mono bg-muted p-3 rounded-md max-h-60 overflow-auto whitespace-pre-wrap break-all">
                {sessionInfo}
              </pre>
              <Button onClick={handleCopyToken} variant="secondary" size="sm">
                Copy Token
              </Button>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Button onClick={handleImportSchola} disabled={importing} variant="outline" size="sm">
              {importing ? 'Importing…' : 'Import Schola Sources'}
            </Button>
            <Button onClick={handleRevealSession} disabled={revealLoading} variant="outline" size="sm">
              {revealLoading ? 'Revealing…' : 'Reveal Session Info'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-2">
          {(['all', 'federation', 'adjacent', 'prelaunch'] as FilterChip[]).map((c) => (
            <Button
              key={c}
              variant={chip === c ? 'default' : 'outline'}
              size="sm"
              onClick={() => setChip(c)}
              className="capitalize"
            >
              {c}
            </Button>
          ))}
        </div>
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or slug…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="text-xs text-muted-foreground ml-auto">
          {filtered.length} of {apps.length} apps
        </div>
      </div>

      {error && (
        <Card className="border-destructive/40">
          <CardContent className="p-4 text-sm text-destructive">
            Could not load apps: {(error as Error).message}
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : (
        TIER_ORDER.filter((t) => (grouped.get(t)?.length ?? 0) > 0).map((tier) => (
          <Card key={tier}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-serif">
                {TIER_LABEL[tier]}{' '}
                <span className="text-muted-foreground text-sm font-sans">
                  ({grouped.get(tier)!.length})
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>App</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-center">SEO</TableHead>
                    <TableHead>Sentry</TableHead>
                    <TableHead>Lovable</TableHead>
                    <TableHead>Last publish</TableHead>
                    <TableHead className="text-right">Edit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {grouped.get(tier)!.map((app) => (
                    <TableRow key={app.source_app}>
                      <TableCell>
                        <div className="font-medium">{app.display_name}</div>
                        <div className="text-xs text-muted-foreground">
                          {app.short_description ?? app.tagline ?? app.source_app}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusVariant(app.status)} className="capitalize">
                          {app.status}
                        </Badge>
                        {app.is_critical && (
                          <Badge variant="outline" className="ml-1 text-xs">critical</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {app.seo_active ? (
                          <Check className="h-4 w-4 inline text-primary" aria-label="SEO active" />
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {app.sentry_project_slug ? (
                          <a
                            href={`https://${app.sentry_org_slug ?? 'cros-llc'}.sentry.io/projects/${app.sentry_project_slug}/`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                          >
                            {app.sentry_project_slug}
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {app.lovable_url ? (
                          <a
                            href={app.lovable_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                          >
                            open
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatTimestamp(app.last_publish_at)}
                        {app.last_publish_error && (
                          <div className="text-destructive truncate max-w-[200px]" title={app.last_publish_error}>
                            error: {app.last_publish_error}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="ghost" onClick={() => setEditing(app)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ))
      )}

      <EditDrawer
        app={editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          qc.invalidateQueries({ queryKey: ['console-apps'] });
          toast({ title: 'App updated' });
          setEditing(null);
        }}
      />
    </div>
  );
}

function EditDrawer({
  app, onClose, onSaved,
}: {
  app: ConsoleApp | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [tier, setTier] = useState<ConsoleApp['tier']>('adjacent');
  const [status, setStatus] = useState<ConsoleApp['status']>('active');
  const [seoActive, setSeoActive] = useState(false);
  const [notes, setNotes] = useState('');
  const { toast } = useToast();

  // Sync local state when app changes
  useMemo(() => {
    if (app) {
      setTier(app.tier);
      setStatus(app.status);
      setSeoActive(app.seo_active);
      setNotes(app.notes ?? '');
    }
  }, [app]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!app) throw new Error('no app');
      const { data, error } = await supabase.functions.invoke('console-apps-update', {
        body: {
          source_app: app.source_app,
          tier,
          status,
          seo_active: seoActive,
          notes: notes.trim() ? notes.trim() : null,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data;
    },
    onSuccess: onSaved,
    onError: (e: any) => toast({
      title: 'Could not update',
      description: e?.message ?? 'Unknown error',
      variant: 'destructive',
    }),
  });

  return (
    <Sheet open={!!app} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{app?.display_name ?? 'Edit app'}</SheetTitle>
          <SheetDescription>
            {app?.source_app} · {app?.hosting_platform}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 py-6">
          <div className="space-y-1.5">
            <Label htmlFor="tier">Tier</Label>
            <Select value={tier} onValueChange={(v) => setTier(v as ConsoleApp['tier'])}>
              <SelectTrigger id="tier"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="hub">Hub</SelectItem>
                <SelectItem value="federation">Federation</SelectItem>
                <SelectItem value="adjacent">Adjacent</SelectItem>
                <SelectItem value="excluded">Excluded</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="status">Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as ConsoleApp['status'])}>
              <SelectTrigger id="status"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="prelaunch">Prelaunch</SelectItem>
                <SelectItem value="paused">Paused</SelectItem>
                <SelectItem value="sunsetting">Sunsetting</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <Label htmlFor="seo">SEO active</Label>
              <p className="text-xs text-muted-foreground">Participates in the federated SEO pipeline.</p>
            </div>
            <input
              id="seo"
              type="checkbox"
              checked={seoActive}
              onChange={(e) => setSeoActive(e.target.checked)}
              className="h-4 w-4"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={5}
              placeholder="Stewardship notes for this app…"
            />
          </div>
        </div>

        <SheetFooter>
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending ? 'Saving…' : 'Save changes'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
