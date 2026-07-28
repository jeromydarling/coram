/**
 * ErrorDeskPage — Centralized operator error tracking console.
 *
 * WHAT: Admin-only view of platform errors, sourced live from Sentry.
 * WHERE: /operator/error-desk
 * WHY: One place to see, triage, and generate Lovable repair prompts for all issues.
 *      Sentry is the source of truth (replaces the homegrown operator_app_errors table).
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Copy, Check, Search, AlertCircle, ExternalLink } from 'lucide-react';
import { toast } from '@/components/ui/sonner';
import { format } from 'date-fns';
import { ErrorDetailDrawer } from '@/components/operator/ErrorDetailDrawer';
import { classifyImpact } from '@/lib/operatorImpactClassifier';
import { buildLovableFixPrompt, buildBulkRepairPrompt } from '@/lib/buildLovableFixPrompt';
import { calmVariant } from '@/lib/calmMode';
import { useBulkSelection } from '@/hooks/useBulkSelection';
import { useFederatedApps } from '@/hooks/useFederatedApps';
import { HelpTooltip } from '@/components/ui/help-tooltip';
const SectionTooltip = HelpTooltip;

// Normalized Sentry issue shape returned by the sentry-issues-proxy edge function.
export interface SentryIssueRecord {
  id: string;
  source: string;
  severity: string;
  fingerprint: string;
  message: string;
  context: {
    route: string | null;
    function_name: string | null;
    app_slug: string | null;
    environment: string | null;
    release: string | null;
    platform: string | null;
  };
  count: number;
  first_seen_at: string;
  last_seen_at: string;
  status: string;
  sentry_url: string | null;
  owner_notes: null;
  lovable_prompt: null;
}

interface ProxyResponse {
  issues: SentryIssueRecord[];
  next_cursor: string | null;
  prev_cursor: string | null;
}

const SENTRY_ORG_URL = 'https://cros-llc.sentry.io';

export default function ErrorDeskPage() {
  const [tab, setTab] = useState<'open' | 'resolved' | 'ignored'>('open');
  const [appFilter, setAppFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [cursor, setCursor] = useState<string | null>(null);
  const [selectedError, setSelectedError] = useState<SentryIssueRecord | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [bulkCopied, setBulkCopied] = useState(false);

  const bulk = useBulkSelection<SentryIssueRecord>();
  const { data: apps = [] } = useFederatedApps();

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['sentry-issues', tab, appFilter, severityFilter, search, cursor],
    queryFn: async (): Promise<ProxyResponse> => {
      const { data, error } = await supabase.functions.invoke('sentry-issues-proxy', {
        body: {
          status: tab,
          app_slug: appFilter,
          query: search,
          limit: 50,
          cursor: cursor ?? undefined,
        },
      });
      if (error) throw error;
      // The proxy returns a sentry_auth error in the body (HTTP 502) — surface it.
      if (data?.error === 'sentry_auth') {
        const e = new Error(data.message || 'Sentry token not configured');
        e.name = 'sentry_auth';
        throw e;
      }
      if (data?.error) throw new Error(data.message || data.error);
      return data as ProxyResponse;
    },
    retry: false,
  });

  const issues = data?.issues ?? [];
  const sentryAuthMissing = isError && (error as Error)?.name === 'sentry_auth';

  // Severity filtering is applied client-side on the returned page.
  const filteredErrors = severityFilter === 'all'
    ? issues
    : issues.filter((e) => e.severity === severityFilter);

  const handleRowClick = (issue: SentryIssueRecord) => {
    setSelectedError(issue);
    setDrawerOpen(true);
  };

  const handleBulkCopy = async () => {
    const selected = bulk.getSelectedItems(filteredErrors);
    if (selected.length === 0) {
      toast.error('Select at least one issue');
      return;
    }
    const prompt = selected.length === 1
      ? buildLovableFixPrompt(selected[0])
      : buildBulkRepairPrompt(selected);
    await navigator.clipboard.writeText(prompt);
    setBulkCopied(true);
    toast.success(`${selected.length === 1 ? 'Repair prompt' : 'Bulk stabilization prompt'} copied.`);
    setTimeout(() => setBulkCopied(false), 3000);
  };

  const changeTab = (v: string) => {
    setTab(v as 'open' | 'resolved' | 'ignored');
    setCursor(null);
    bulk.clearSelection();
  };

  return (
    <div className="space-y-5 pb-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground flex items-center gap-1">
            Error Desk
            <SectionTooltip
              what="Centralized error tracking for the CROS platform"
              where="Sentry (cros-llc org)"
              why="One place to triage, understand, and fix platform issues"
            />
          </h1>
          <p className="text-sm text-muted-foreground">Quiet visibility into what may need attention.</p>
        </div>
      </div>

      {/* Live-data banner */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
        </span>
        Showing live data from Sentry
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search errors..."
            className="pl-8"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setCursor(null); }}
          />
        </div>
        <Select value={appFilter} onValueChange={(v) => { setAppFilter(v); setCursor(null); }}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="App" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Apps</SelectItem>
            {apps.map((app) => (
              <SelectItem key={app.source_app} value={app.source_app}>
                {app.display_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={severityFilter} onValueChange={setSeverityFilter}>
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder="Severity" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Severity</SelectItem>
            <SelectItem value="low">Low</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="high">High</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Bulk actions */}
      {bulk.selectedCount > 0 && (
        <div className="flex items-center gap-3 px-3 py-2 bg-muted/50 rounded-md">
          <span className="text-sm text-muted-foreground">{bulk.selectedCount} selected</span>
          <Button size="sm" variant="outline" onClick={handleBulkCopy} disabled={bulkCopied}>
            {bulkCopied ? <Check className="h-3.5 w-3.5 mr-1" /> : <Copy className="h-3.5 w-3.5 mr-1" />}
            {bulk.selectedCount === 1 ? 'Copy Prompt' : 'Copy Combined Prompt'}
          </Button>
          <Button size="sm" variant="ghost" onClick={bulk.clearSelection}>Clear</Button>
        </div>
      )}

      <Tabs value={tab} onValueChange={changeTab}>
        <TabsList>
          <TabsTrigger value="open">Open</TabsTrigger>
          <TabsTrigger value="resolved">Resolved</TabsTrigger>
          <TabsTrigger value="ignored">Ignored</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-4">
          {isLoading ? (
            <Skeleton className="h-60 w-full" />
          ) : sentryAuthMissing ? (
            <Card>
              <CardContent className="py-12 text-center space-y-3 text-sm text-muted-foreground">
                <p>Sentry token not configured. Set <code>SENTRY_AUTH_TOKEN</code> in Supabase Edge Function secrets.</p>
                <Button variant="outline" size="sm" asChild>
                  <a href={`${SENTRY_ORG_URL}/settings/auth-tokens/`} target="_blank" rel="noreferrer">
                    Open Sentry settings <ExternalLink className="h-3.5 w-3.5 ml-1" />
                  </a>
                </Button>
              </CardContent>
            </Card>
          ) : isError ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground text-sm">
                Could not load issues from Sentry. {(error as Error)?.message}
              </CardContent>
            </Card>
          ) : filteredErrors.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground text-sm">
                {tab === 'open' ? 'No open issues — the system is running smoothly.' : `No ${tab} items.`}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8">
                        <Checkbox
                          checked={bulk.isAllSelected(filteredErrors)}
                          onCheckedChange={(checked) => checked ? bulk.selectAll(filteredErrors) : bulk.clearSelection()}
                        />
                      </TableHead>
                      <TableHead>App</TableHead>
                      <TableHead className="hidden sm:table-cell">Severity</TableHead>
                      <TableHead>Message</TableHead>
                      <TableHead className="text-right hidden md:table-cell">Count</TableHead>
                      <TableHead className="text-right">Last Seen</TableHead>
                      <TableHead className="w-8" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredErrors.map((issue) => {
                      const impact = classifyImpact(issue);
                      return (
                        <TableRow
                          key={issue.id}
                          className="cursor-pointer"
                          onClick={() => handleRowClick(issue)}
                        >
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={bulk.isSelected(issue.id)}
                              onCheckedChange={() => bulk.toggle(issue.id)}
                            />
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-[10px]">
                              {issue.context.app_slug ?? 'unknown'}
                            </Badge>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell">
                            <Badge variant={calmVariant(issue.severity === 'high' ? 'error' : 'ok')} className="text-[10px]">
                              {issue.severity}
                            </Badge>
                          </TableCell>
                          <TableCell className="max-w-[200px] md:max-w-xs">
                            <div className="flex items-center gap-1.5 min-w-0">
                              {impact === 'high' && (
                                <AlertCircle className="h-3.5 w-3.5 text-primary shrink-0 animate-pulse" />
                              )}
                              <span className="truncate text-sm">{issue.message}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right hidden md:table-cell text-muted-foreground text-xs">{issue.count}</TableCell>
                          <TableCell className="text-right text-muted-foreground text-xs whitespace-nowrap">
                            {format(new Date(issue.last_seen_at), 'MMM d, h:mm a')}
                          </TableCell>
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            {issue.sentry_url && (
                              <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                                <a href={issue.sentry_url} target="_blank" rel="noreferrer" title="Open in Sentry">
                                  <ExternalLink className="h-3.5 w-3.5" />
                                </a>
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Cursor pagination */}
          {!isLoading && !isError && (data?.prev_cursor || data?.next_cursor) && (
            <div className="flex justify-end gap-2 mt-3">
              <Button
                size="sm"
                variant="outline"
                disabled={!data?.prev_cursor}
                onClick={() => { setCursor(data!.prev_cursor); bulk.clearSelection(); }}
              >
                Previous
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={!data?.next_cursor}
                onClick={() => { setCursor(data!.next_cursor); bulk.clearSelection(); }}
              >
                Next
              </Button>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <ErrorDetailDrawer
        error={selectedError}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        onUpdated={() => refetch()}
      />
    </div>
  );
}
