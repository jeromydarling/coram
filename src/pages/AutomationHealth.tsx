import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useTabPersistence } from '@/hooks/useTabPersistence';
import { MainLayout } from '@/components/layout/MainLayout';
import { useAutomationHealth, useRetryRun } from '@/hooks/useAutomationHealth';
import { useFilteredRuns, isBillableStatus, type AutomationRunDetail } from '@/hooks/useRunDetail';
import { AutomationHealthSummary } from '@/components/admin/AutomationHealthSummary';
import { WatchlistSignalsTable } from '@/components/admin/WatchlistSignalsTable';
import { RunDetailDrawer } from '@/components/admin/RunDetailDrawer';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Loader2, Download, Copy, RotateCcw, DollarSign } from 'lucide-react';
import { toast } from '@/components/ui/sonner';
import { useAuth } from '@/contexts/AuthContext';
import {
  workflowLabel,
  statusVariant,
  statusLabel,
  formatTimestamp,
  formatDuration,
} from '@/lib/automationHealthFormatters';
import { exportRunsCSV } from '@/lib/csvExport';

const WORKFLOW_OPTIONS = [
  { value: 'all', key: 'all' },
  { value: 'partner_enrich', key: 'partnerEnrich' },
  { value: 'opportunity_monitor', key: 'opportunityMonitor' },
  { value: 'recommendations_generate', key: 'recommendations' },
  { value: 'watchlist_ingest', key: 'watchlistIngest' },
  { value: 'watchlist_diff', key: 'watchlistDiff' },
];

const STATUS_OPTIONS = [
  { value: 'all', key: 'all' },
  { value: 'processed', key: 'processed' },
  { value: 'dispatched', key: 'dispatched' },
  { value: 'running', key: 'running' },
  { value: 'error', key: 'error' },
  { value: 'deduped', key: 'deduped' },
  { value: 'skipped_due_to_cap', key: 'skippedCap' },
  { value: 'throttled', key: 'throttled' },
  { value: 'rate_limited', key: 'rateLimited' },
  { value: 'failed_timeout', key: 'failedTimeout' },
];

const WINDOW_OPTIONS = [
  { value: '24', key: '24h' },
  { value: '168', key: '7d' },
  { value: '720', key: '30d' },
];

export default function AutomationHealth() {
  const { t } = useTranslation('common');
  const [workflowFilter, setWorkflowFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [orgIdFilter, setOrgIdFilter] = useState('');
  const [windowHours, setWindowHours] = useState(24);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const { activeTab, setActiveTab } = useTabPersistence('runs');

  const { hasAnyRole } = useAuth();
  const canRetry = hasAnyRole(['admin', 'leadership', 'regional_lead']);

  const workflowKey = workflowFilter === 'all' ? null : workflowFilter;
  const statusKey = statusFilter === 'all' ? null : statusFilter;
  const orgId = orgIdFilter.trim() || null;

  const { data: healthData, isLoading: healthLoading } = useAutomationHealth(workflowKey, windowHours);
  const { data: filteredRuns, isLoading: runsLoading } = useFilteredRuns({
    workflowKey,
    status: statusKey,
    orgId,
    windowHours,
  });
  const { retryRun, retryingRunId } = useRetryRun();

  const billableCounts = useMemo(() => {
    if (!filteredRuns) return { billable: 0, nonBillable: 0 };
    let billable = 0, nonBillable = 0;
    for (const r of filteredRuns) {
      if (isBillableStatus(r.status)) billable++;
      else nonBillable++;
    }
    return { billable, nonBillable };
  }, [filteredRuns]);

  const durationSeconds = (r: AutomationRunDetail): number | null => {
    if (!r.processed_at) return null;
    return (new Date(r.processed_at).getTime() - new Date(r.created_at).getTime()) / 1000;
  };

  const copyRunId = (id: string) => {
    navigator.clipboard.writeText(id);
    toast.success(t('automationHealth.runIdCopied'));
  };

  return (
    <MainLayout title={t('automationHealth.title')} subtitle={t('automationHealth.subtitle')} helpKey="page.automation-health">
      <div className="space-y-6">
        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-end">
          <Select value={workflowFilter} onValueChange={setWorkflowFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {WORKFLOW_OPTIONS.map(o => (
                <SelectItem key={o.value} value={o.value}>{t(`automationHealth.workflows.${o.key}`)}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[170px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map(o => (
                <SelectItem key={o.value} value={o.value}>{t(`automationHealth.statuses.${o.key}`)}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Input
            placeholder={t('automationHealth.orgIdFilter')}
            value={orgIdFilter}
            onChange={(e) => setOrgIdFilter(e.target.value)}
            className="w-[200px] font-mono text-xs"
          />

          <Select value={String(windowHours)} onValueChange={v => setWindowHours(Number(v))}>
            <SelectTrigger className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {WINDOW_OPTIONS.map(o => (
                <SelectItem key={o.value} value={o.value}>{t(`automationHealth.windows.${o.key}`)}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="sm"
            className="gap-1"
            onClick={() => filteredRuns && exportRunsCSV(filteredRuns)}
            disabled={!filteredRuns?.length}
          >
            <Download className="w-3.5 h-3.5" />
            {t('automationHealth.exportCsv')}
          </Button>
        </div>

        {/* Billable summary */}
        {filteredRuns && filteredRuns.length > 0 && (
          <div className="flex gap-4 text-xs text-muted-foreground">
            <span>{t('automationHealth.showingRuns', { count: filteredRuns.length })}</span>
            <span>• <strong className="text-foreground">{t('automationHealth.billable', { count: billableCounts.billable })}</strong></span>
            <span>• <strong className="text-muted-foreground">{t('automationHealth.notBillable', { count: billableCounts.nonBillable })}</strong></span>
          </div>
        )}

        {healthLoading && (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        )}

        {healthData && <AutomationHealthSummary data={healthData} />}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="flex-wrap">
            <TabsTrigger value="runs">
              {`Filtered Runs (${filteredRuns?.length ?? '…'})`}
            </TabsTrigger>
            <TabsTrigger value="errors">
              {t('automationHealth.tabs.errors', { count: healthData?.recent_errors.length ?? 0 })}
            </TabsTrigger>
            <TabsTrigger value="stuck">
              {t('automationHealth.tabs.stuck', { count: healthData?.stuck_runs.length ?? 0 })}
            </TabsTrigger>
            <TabsTrigger value="watchlist">
              {t('automationHealth.tabs.watchlistChanges')}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="runs">
            {runsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : !filteredRuns?.length ? (
              <Card>
                <CardContent className="pt-6 text-center text-muted-foreground">
                  {t('automationHealth.noMatchFilters')}
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t('automationHealth.table.runId')}</TableHead>
                          <TableHead>{t('automationHealth.table.workflow')}</TableHead>
                          <TableHead>{t('automationHealth.table.org')}</TableHead>
                          <TableHead>{t('automationHealth.table.status')}</TableHead>
                          <TableHead>{t('automationHealth.table.billable')}</TableHead>
                          <TableHead>{t('automationHealth.table.created')}</TableHead>
                          <TableHead>{t('automationHealth.table.duration')}</TableHead>
                          {canRetry && <TableHead>{t('automationHealth.table.actions')}</TableHead>}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredRuns.map(run => (
                          <TableRow
                            key={run.run_id}
                            className="cursor-pointer"
                            onClick={() => setSelectedRunId(run.run_id)}
                          >
                            <TableCell className="font-mono text-xs">
                              <div className="flex items-center gap-1">
                                <span>{run.run_id.slice(0, 8)}</span>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-5 w-5"
                                  onClick={(e) => { e.stopPropagation(); copyRunId(run.run_id); }}
                                >
                                  <Copy className="h-3 w-3" />
                                </Button>
                              </div>
                            </TableCell>
                            <TableCell className="text-sm">{workflowLabel(run.workflow_key)}</TableCell>
                            <TableCell className="text-xs text-muted-foreground truncate max-w-[120px]">
                              {run.org_name || run.org_id?.slice(0, 8) || '—'}
                            </TableCell>
                            <TableCell>
                              <Badge variant={statusVariant(run.status)}>{statusLabel(run.status)}</Badge>
                            </TableCell>
                            <TableCell>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Badge
                                    variant={isBillableStatus(run.status) ? 'default' : 'outline'}
                                    className="text-xs gap-0.5"
                                  >
                                    <DollarSign className="w-2.5 h-2.5" />
                                    {isBillableStatus(run.status) ? t('automationHealth.table.billableYes') : t('automationHealth.table.billableNo')}
                                  </Badge>
                                </TooltipTrigger>
                                <TooltipContent className="text-xs">
                                  {isBillableStatus(run.status) ? t('automationHealth.table.billableTooltipYes') : t('automationHealth.table.billableTooltipNo')}
                                </TooltipContent>
                              </Tooltip>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                              {formatTimestamp(run.created_at)}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {formatDuration(durationSeconds(run))}
                            </TableCell>
                            {canRetry && (
                              <TableCell>
                                {(run.status === 'error' || run.status === 'failed_timeout') && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 text-xs gap-1"
                                    disabled={retryingRunId === run.run_id}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      retryRun(run.run_id, 'retry');
                                    }}
                                  >
                                    {retryingRunId === run.run_id ? (
                                      <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : (
                                      <RotateCcw className="h-3 w-3" />
                                    )}
                                    {t('automationHealth.table.retry')}
                                  </Button>
                                )}
                              </TableCell>
                            )}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="errors">
            {healthData ? (
              <RunsSubTable
                runs={healthData.recent_errors}
                emptyMessage={t('automationHealth.noErrors')}
                canRetry={canRetry}
                retryRun={retryRun}
                retryingRunId={retryingRunId}
                onSelectRun={setSelectedRunId}
              />
            ) : null}
          </TabsContent>

          <TabsContent value="stuck">
            {healthData ? (
              <RunsSubTable
                runs={healthData.stuck_runs}
                emptyMessage={t('automationHealth.noStuck')}
                canRetry={canRetry}
                retryRun={retryRun}
                retryingRunId={retryingRunId}
                onSelectRun={setSelectedRunId}
              />
            ) : null}
          </TabsContent>

          <TabsContent value="watchlist">
            <WatchlistSignalsTable windowHours={windowHours} />
          </TabsContent>
        </Tabs>

        {/* Run Detail Drawer */}
        <RunDetailDrawer
          runId={selectedRunId}
          open={!!selectedRunId}
          onClose={() => setSelectedRunId(null)}
        />
      </div>
    </MainLayout>
  );
}

/** Reusable sub-table for errors/stuck tabs using health data format */
function RunsSubTable({
  runs,
  emptyMessage,
  canRetry,
  retryRun,
  retryingRunId,
  onSelectRun,
}: {
  runs: { run_id: string; workflow_key: string; status: string; created_at: string; processed_at: string | null; error_message: string | null }[];
  emptyMessage: string;
  canRetry: boolean;
  retryRun: (id: string, mode?: 'retry' | 'force_crawl') => Promise<void>;
  retryingRunId: string | null;
  onSelectRun: (id: string) => void;
}) {
  const { t } = useTranslation('common');
  if (!runs.length) {
    return (
      <Card>
        <CardContent className="pt-6 text-center text-muted-foreground">{emptyMessage}</CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('automationHealth.table.runId')}</TableHead>
                <TableHead>{t('automationHealth.table.workflow')}</TableHead>
                <TableHead>{t('automationHealth.table.status')}</TableHead>
                <TableHead>{t('automationHealth.table.billable')}</TableHead>
                <TableHead>{t('automationHealth.table.created')}</TableHead>
                <TableHead>{t('automationHealth.table.error')}</TableHead>
                {canRetry && <TableHead>{t('automationHealth.table.actions')}</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {runs.map(run => (
                <TableRow
                  key={run.run_id}
                  className="cursor-pointer"
                  onClick={() => onSelectRun(run.run_id)}
                >
                  <TableCell className="font-mono text-xs">{run.run_id.slice(0, 8)}</TableCell>
                  <TableCell className="text-sm">{workflowLabel(run.workflow_key)}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(run.status)}>{statusLabel(run.status)}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={isBillableStatus(run.status) ? 'default' : 'outline'} className="text-xs gap-0.5">
                      <DollarSign className="w-2.5 h-2.5" />
                      {isBillableStatus(run.status) ? t('automationHealth.table.billableYes') : t('automationHealth.table.billableNo')}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                    {formatTimestamp(run.created_at)}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                    {run.error_message || '—'}
                  </TableCell>
                  {canRetry && (
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs gap-1"
                        disabled={retryingRunId === run.run_id}
                        onClick={(e) => { e.stopPropagation(); retryRun(run.run_id, 'retry'); }}
                      >
                        {retryingRunId === run.run_id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <RotateCcw className="h-3 w-3" />
                        )}
                        {t('automationHealth.table.retry')}
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
