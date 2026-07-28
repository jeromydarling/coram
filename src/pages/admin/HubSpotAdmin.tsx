import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Building2, CheckCircle2, XCircle, AlertTriangle, Clock, ArrowUp, ArrowDown, Activity } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { HelpCircle } from 'lucide-react';

function HelpTip({ text }: { text: string }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <HelpCircle className="h-3.5 w-3.5 text-muted-foreground inline-block ml-1 cursor-help" />
        </TooltipTrigger>
        <TooltipContent className="max-w-xs text-xs">{text}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function useAdminHubSpotConnections() {
  return useQuery({
    queryKey: ['admin-hubspot-connections'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('hubspot_connections')
        .select('id, user_id, hubspot_portal_id, status, hubspot_mode, sync_direction, sync_scope, token_expires_at, created_at, updated_at')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
}

function useAdminSyncStats() {
  return useQuery({
    queryKey: ['admin-hubspot-sync-stats'],
    queryFn: async () => {
      // Get last 7 days of sync logs aggregated
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from('hubspot_sync_log')
        .select('direction, status, created_at')
        .gte('created_at', sevenDaysAgo)
        .order('created_at', { ascending: false })
        .limit(1000);
      if (error) throw error;

      const logs = data || [];
      const pushOk = logs.filter(l => l.direction === 'push' && l.status === 'ok').length;
      const pushSkipped = logs.filter(l => l.direction === 'push' && l.status === 'skipped').length;
      const pushFailed = logs.filter(l => l.direction === 'push' && l.status === 'failed').length;
      const pullOk = logs.filter(l => l.direction === 'pull' && l.status === 'ok').length;
      const pullFailed = logs.filter(l => l.direction === 'pull' && l.status === 'failed').length;
      const lastSync = logs.length > 0 ? logs[0].created_at : null;

      return { pushOk, pushSkipped, pushFailed, pullOk, pullFailed, lastSync, totalLogs: logs.length };
    },
  });
}

function useAdminJobDuration() {
  return useQuery({
    queryKey: ['admin-hubspot-job-duration'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('system_job_runs')
        .select('job_key, started_at, completed_at, status, duration_ms')
        .like('job_key', '%hubspot%')
        .order('started_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data || []).map(r => ({
        ...r,
        computed_duration_ms: r.duration_ms ?? (r.completed_at && r.started_at
          ? new Date(r.completed_at).getTime() - new Date(r.started_at).getTime()
          : null),
      }));
    },
  });
}

export default function HubSpotAdmin() {
  const { data: connections, isLoading: loadingConns } = useAdminHubSpotConnections();
  const { data: stats, isLoading: loadingStats } = useAdminSyncStats();
  const { data: jobRuns, isLoading: loadingJobs } = useAdminJobDuration();

  const isLoading = loadingConns || loadingStats || loadingJobs;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Building2 className="h-6 w-6" />
          HubSpot Integration Health
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Admin view of all HubSpot connections, sync stats, and job health.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-2xl font-bold">{connections?.length || 0}</p>
            <p className="text-xs text-muted-foreground">Active Connections</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <div className="flex items-center justify-center gap-1">
              <ArrowUp className="h-4 w-4 text-green-600" />
              <p className="text-2xl font-bold">{stats?.pushOk || 0}</p>
            </div>
            <p className="text-xs text-muted-foreground">Pushed (7d)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <div className="flex items-center justify-center gap-1">
              <XCircle className="h-4 w-4 text-destructive" />
              <p className="text-2xl font-bold">{stats?.pushFailed || 0}</p>
            </div>
            <p className="text-xs text-muted-foreground">Failed (7d)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-2xl font-bold text-muted-foreground">
              {stats?.lastSync ? formatDistanceToNow(new Date(stats.lastSync), { addSuffix: true }) : '—'}
            </p>
            <p className="text-xs text-muted-foreground">Last Sync</p>
          </CardContent>
        </Card>
      </div>

      {/* Connections Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Connections <HelpTip text="All HubSpot OAuth connections across users. Shows token health and sync config." /></CardTitle>
        </CardHeader>
        <CardContent>
          {!connections?.length ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No connections yet</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Portal</TableHead>
                  <TableHead>Mode</TableHead>
                  <TableHead>Direction</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Token Health</TableHead>
                  <TableHead>Connected</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {connections.map(c => {
                  const tokenExpired = c.token_expires_at && new Date(c.token_expires_at) < new Date();
                  return (
                    <TableRow key={c.id}>
                      <TableCell className="font-mono text-xs">{c.hubspot_portal_id || '—'}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {c.hubspot_mode === 'deal' ? 'Deal' : 'Company'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={c.sync_direction === 'push_pull' ? 'default' : 'secondary'} className="text-xs">
                          {c.sync_direction === 'push_pull' ? '↑↓ Push+Pull' : '↑ Push'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {c.status === 'active' && <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 text-xs"><CheckCircle2 className="h-3 w-3 mr-1" />Active</Badge>}
                        {c.status === 'error' && <Badge variant="destructive" className="text-xs"><XCircle className="h-3 w-3 mr-1" />Error</Badge>}
                        {c.status === 'revoked' && <Badge variant="secondary" className="text-xs">Revoked</Badge>}
                      </TableCell>
                      <TableCell>
                        {tokenExpired ? (
                          <Badge variant="destructive" className="text-xs"><AlertTriangle className="h-3 w-3 mr-1" />Expired</Badge>
                        ) : (
                          <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 text-xs">Valid</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {format(new Date(c.created_at), 'MMM d, yyyy')}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Sync Stats */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sync Stats (7 days) <HelpTip text="Aggregate counts of push and pull operations across all connections." /></CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
            <div>
              <p className="text-lg font-semibold text-green-600">{stats?.pushOk || 0}</p>
              <p className="text-xs text-muted-foreground">Push OK</p>
            </div>
            <div>
              <p className="text-lg font-semibold text-muted-foreground">{stats?.pushSkipped || 0}</p>
              <p className="text-xs text-muted-foreground">Push Skipped</p>
            </div>
            <div>
              <p className="text-lg font-semibold text-destructive">{stats?.pushFailed || 0}</p>
              <p className="text-xs text-muted-foreground">Push Failed</p>
            </div>
            <div>
              <p className="text-lg font-semibold text-blue-600">{stats?.pullOk || 0}</p>
              <p className="text-xs text-muted-foreground">Pull OK</p>
            </div>
            <div>
              <p className="text-lg font-semibold text-destructive">{stats?.pullFailed || 0}</p>
              <p className="text-xs text-muted-foreground">Pull Failed</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Job Duration Trend */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Job Duration Trend
            <HelpTip text="Recent HubSpot-related background job runs from system_job_runs." />
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!jobRuns?.length ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No HubSpot job runs recorded yet</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Job</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Started</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobRuns.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-mono text-xs">{r.job_key}</TableCell>
                    <TableCell>
                      {r.status === 'success' && <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 text-xs">OK</Badge>}
                      {r.status === 'error' && <Badge variant="destructive" className="text-xs">Error</Badge>}
                      {r.status === 'running' && <Badge variant="secondary" className="text-xs"><Loader2 className="h-3 w-3 mr-1 animate-spin" />Running</Badge>}
                      {!['success', 'error', 'running'].includes(r.status || '') && <Badge variant="outline" className="text-xs">{r.status}</Badge>}
                    </TableCell>
                    <TableCell className="text-xs">
                      {r.computed_duration_ms != null ? `${(r.computed_duration_ms / 1000).toFixed(1)}s` : '—'}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {r.started_at ? format(new Date(r.started_at), 'MMM d, h:mm a') : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
