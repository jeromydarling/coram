/**
 * OperatorAuditPage — Federated Audit Log
 *
 * WHAT: Cross-app, append-only log of significant actions across the CROS
 *       federation. Surfaced to gardeners with a grant on each app.
 * WHERE: /operator/audit (MACHINA zone — sits next to Error Desk)
 * WHY: One pane to answer "who did what, when, where" across 16+ satellite
 *      apps without bouncing between consoles. Drives incident response,
 *      compliance review, and the upcoming notification rules engine.
 *
 * Backed by public.federated_audit (Phase 0 migration), which is RLS-scoped
 * by has_gardener_grant(source_app) — so a direct supabase.from('federated_audit')
 * query is already safe: a gardener only sees rows for apps they have access
 * to. Federation-wide gardeners ('*') see everything.
 *
 * Filters (all server-side):
 *   - source_app  (single app or all apps the user can see)
 *   - actor_email (substring, case-insensitive)
 *   - action      (substring, case-insensitive — e.g. 'lead.', 'content.publish')
 *   - date range  (last 24h / 7d / 30d / 90d / all)
 *
 * Pagination: 50 rows per page, keyset on (occurred_at, id) so it stays fast
 * even as the table grows. We intentionally do NOT use offset pagination —
 * that gets quadratic on large tables and breaks under concurrent inserts.
 *
 * NOTE: types.ts has not been regenerated for the federation tables yet, so
 * we cast `supabase.from('federated_audit')` through `any`. Same pattern as
 * OperatorAppsPage. TODO: regenerate once Phase 0 is on staging.
 */
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  ScrollText, Search, Filter, ChevronLeft, ChevronRight,
  ExternalLink, Eye, RefreshCw,
} from 'lucide-react';

// ── Types ───────────────────────────────────────────────────────────────

interface FederationAppLite {
  slug: string;
  display_name: string;
}

interface AuditRow {
  id: number;
  occurred_at: string;
  source_app: string;
  actor_id: string | null;
  actor_email: string | null;
  action: string;
  resource: string | null;
  payload: Record<string, unknown>;
  ip: string | null;
  user_agent: string | null;
}

type DateRange = '24h' | '7d' | '30d' | '90d' | 'all';

const DATE_RANGE_HOURS: Record<DateRange, number | null> = {
  '24h': 24,
  '7d': 24 * 7,
  '30d': 24 * 30,
  '90d': 24 * 90,
  all: null,
};

const PAGE_SIZE = 50;

// ── Page ────────────────────────────────────────────────────────────────

export default function OperatorAuditPage() {
  const [appFilter, setAppFilter] = useState<string>('all');
  const [actorQuery, setActorQuery] = useState('');
  const [actionQuery, setActionQuery] = useState('');
  const [dateRange, setDateRange] = useState<DateRange>('7d');
  const [inspecting, setInspecting] = useState<AuditRow | null>(null);

  // Keyset pagination: each "page" stores the (occurred_at, id) cursor of
  // its first row. The current page is the last entry in `pageStack`.
  // Going back pops; going forward pushes. We compute the cursor from the
  // 51st row of the previous page (we ask for PAGE_SIZE + 1 rows so we
  // know whether a next page exists without a separate count query).
  const [pageStack, setPageStack] = useState<
    Array<{ occurred_at: string; id: number } | null>
  >([null]);
  const cursor = pageStack[pageStack.length - 1];
  const isFirstPage = pageStack.length === 1;

  // App list — for the filter dropdown. We pull this from federation_apps
  // (already RLS-filtered to apps this gardener can see).
  const { data: apps } = useQuery({
    queryKey: ['operator-audit-app-options'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('federation_apps')
        .select('slug, display_name')
        .order('display_name', { ascending: true });
      if (error) throw error;
      return (data ?? []) as FederationAppLite[];
    },
  });

  // The audit query itself. We ask for PAGE_SIZE + 1 to detect "has next".
  const {
    data: rows,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useQuery({
    queryKey: [
      'operator-audit',
      appFilter,
      actorQuery.trim().toLowerCase(),
      actionQuery.trim().toLowerCase(),
      dateRange,
      cursor?.occurred_at,
      cursor?.id,
    ],
    queryFn: async () => {
      let q = (supabase as any)
        .from('federated_audit')
        .select(
          'id, occurred_at, source_app, actor_id, actor_email, action, resource, payload, ip, user_agent',
        )
        .order('occurred_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(PAGE_SIZE + 1);

      if (appFilter !== 'all') q = q.eq('source_app', appFilter);

      const actor = actorQuery.trim();
      if (actor) q = q.ilike('actor_email', `%${actor}%`);

      const action = actionQuery.trim();
      if (action) q = q.ilike('action', `%${action}%`);

      const hours = DATE_RANGE_HOURS[dateRange];
      if (hours != null) {
        const since = new Date(Date.now() - hours * 3600 * 1000).toISOString();
        q = q.gte('occurred_at', since);
      }

      if (cursor) {
        // Keyset: rows strictly before the cursor (older).
        // Postgres tuple comparison would be ideal but PostgREST doesn't
        // expose it — so we encode (occurred_at < c) OR (= c AND id < c.id)
        // as a pair of OR-ed `or()` filters via .or() on a string clause.
        q = q.or(
          `occurred_at.lt.${cursor.occurred_at},and(occurred_at.eq.${cursor.occurred_at},id.lt.${cursor.id})`,
        );
      }

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as AuditRow[];
    },
    placeholderData: (prev) => prev,
  });

  const visibleRows = useMemo(
    () => (rows ?? []).slice(0, PAGE_SIZE),
    [rows],
  );
  const hasNext = (rows?.length ?? 0) > PAGE_SIZE;

  function resetFilters() {
    setAppFilter('all');
    setActorQuery('');
    setActionQuery('');
    setDateRange('7d');
    setPageStack([null]);
  }

  function nextPage() {
    if (!hasNext || visibleRows.length === 0) return;
    const last = visibleRows[visibleRows.length - 1];
    setPageStack((s) => [...s, { occurred_at: last.occurred_at, id: last.id }]);
  }

  function prevPage() {
    if (isFirstPage) return;
    setPageStack((s) => s.slice(0, -1));
  }

  // When filters change, restart pagination.
  function onFilterChange<T>(setter: (v: T) => void, v: T) {
    setter(v);
    setPageStack([null]);
  }

  return (
    <div className="space-y-6 p-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <ScrollText className="h-6 w-6 text-primary" />
            Federated Audit Log
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Append-only log of significant actions across every app in the CROS
            federation. Scoped by your gardener grants — you only see rows for
            apps you can access.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button variant="ghost" size="sm" onClick={resetFilters}>
            Reset filters
          </Button>
        </div>
      </header>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Filter className="h-4 w-4" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">App</label>
              <Select
                value={appFilter}
                onValueChange={(v) => onFilterChange(setAppFilter, v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All apps" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All apps</SelectItem>
                  {(apps ?? []).map((a) => (
                    <SelectItem key={a.slug} value={a.slug}>
                      {a.display_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Actor email
              </label>
              <div className="relative">
                <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-8"
                  placeholder="alice@example.com"
                  value={actorQuery}
                  onChange={(e) => onFilterChange(setActorQuery, e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Action</label>
              <div className="relative">
                <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-8"
                  placeholder="lead.create, content.publish, …"
                  value={actionQuery}
                  onChange={(e) => onFilterChange(setActionQuery, e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Date range
              </label>
              <Select
                value={dateRange}
                onValueChange={(v: DateRange) => onFilterChange(setDateRange, v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="24h">Last 24 hours</SelectItem>
                  <SelectItem value="7d">Last 7 days</SelectItem>
                  <SelectItem value="30d">Last 30 days</SelectItem>
                  <SelectItem value="90d">Last 90 days</SelectItem>
                  <SelectItem value="all">All time</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base">
            {isLoading ? 'Loading…' : `${visibleRows.length} event${visibleRows.length === 1 ? '' : 's'}`}
            {!isFirstPage && <span className="ml-2 text-xs text-muted-foreground">(page {pageStack.length})</span>}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={prevPage}
              disabled={isFirstPage || isFetching}
            >
              <ChevronLeft className="mr-1 h-4 w-4" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={nextPage}
              disabled={!hasNext || isFetching}
            >
              Next
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {error ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
              Failed to load audit log: {(error as Error).message}
            </div>
          ) : isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : visibleRows.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              No audit events match these filters.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap">When</TableHead>
                    <TableHead>App</TableHead>
                    <TableHead>Actor</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Resource</TableHead>
                    <TableHead className="w-12 text-right" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleRows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="whitespace-nowrap font-mono text-xs">
                        {formatWhen(row.occurred_at)}
                      </TableCell>
                      <TableCell>
                        <Link
                          to={`/operator/apps?slug=${row.source_app}`}
                          className="inline-flex items-center gap-1 text-xs hover:underline"
                        >
                          <Badge variant="secondary" className="font-normal">
                            {row.source_app}
                          </Badge>
                          <ExternalLink className="h-3 w-3 opacity-50" />
                        </Link>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-sm">
                        {row.actor_email ?? <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{row.action}</TableCell>
                      <TableCell className="max-w-[260px] truncate text-xs text-muted-foreground">
                        {row.resource ?? '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setInspecting(row)}
                          aria-label="Inspect event"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!inspecting} onOpenChange={(open) => !open && setInspecting(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-mono text-base">{inspecting?.action}</DialogTitle>
          </DialogHeader>
          {inspecting && (
            <div className="space-y-4 text-sm">
              <DetailRow label="When" value={new Date(inspecting.occurred_at).toLocaleString()} />
              <DetailRow label="App" value={inspecting.source_app} />
              <DetailRow label="Actor" value={inspecting.actor_email ?? '—'} />
              {inspecting.actor_id && (
                <DetailRow label="Actor user id" value={inspecting.actor_id} mono />
              )}
              <DetailRow label="Resource" value={inspecting.resource ?? '—'} mono />
              {inspecting.ip && <DetailRow label="IP" value={inspecting.ip} mono />}
              {inspecting.user_agent && (
                <DetailRow label="User agent" value={inspecting.user_agent} mono />
              )}
              <div>
                <div className="mb-1 text-xs font-medium text-muted-foreground">Payload</div>
                <pre className="max-h-[300px] overflow-auto rounded border bg-muted/30 p-3 text-xs">
                  {JSON.stringify(inspecting.payload, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Bits ────────────────────────────────────────────────────────────────

function DetailRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="grid grid-cols-[120px_1fr] gap-2">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className={`break-all ${mono ? 'font-mono text-xs' : 'text-sm'}`}>{value}</div>
    </div>
  );
}

/** Compact relative-then-absolute timestamp. <60s "just now", <60m "3m ago",
 *  <24h "5h ago", else local date+time. Keeps the table scannable. */
function formatWhen(iso: string): string {
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
