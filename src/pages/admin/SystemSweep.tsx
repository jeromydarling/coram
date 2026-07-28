import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { HelpCircle, Activity, Radar, ListChecks, CalendarClock, Loader2, PlayCircle, AlertTriangle } from 'lucide-react';
import {
  useSweepHeartbeat,
  useSystemJobs,
  useRecentJobRuns,
  useSystemSuggestions,
  useTriggerSweep,
  type MetroHealthRow,
  type SystemJobRun,
  type SystemSuggestion,
  type SystemJob,
} from '@/hooks/useSystemSweep';
import { formatDistanceToNow, format } from 'date-fns';

export default function SystemSweep() {
  const { data: heartbeat, isLoading: heartbeatLoading } = useSweepHeartbeat();
  const { data: jobs } = useSystemJobs();
  const { data: recentRuns, isLoading: runsLoading } = useRecentJobRuns(undefined, 30);
  const [suggestionType, setSuggestionType] = useState<string>('all');
  const { data: suggestions, isLoading: suggestionsLoading } = useSystemSuggestions({
    type: suggestionType === 'all' ? undefined : suggestionType,
    limit: 50,
  });
  const triggerSweep = useTriggerSweep();

  if (heartbeatLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
        {/* ── Heartbeat Cards ── */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <HeartbeatCard
            label="Last Sweep"
            value={heartbeat?.lastSweepRun?.started_at
              ? formatDistanceToNow(new Date(heartbeat.lastSweepRun.started_at), { addSuffix: true })
              : 'Never'}
            helpText="When the last system-wide sweep ran"
          />
          <HeartbeatCard
            label="Metros Processed"
            value={heartbeat?.metrosProcessed ?? 0}
            helpText="Number of metros checked in the last sweep"
          />
          <HeartbeatCard
            label="Suggestions This Week"
            value={heartbeat?.suggestionsThisWeek ?? 0}
            helpText="Total suggestions generated across all metros this week"
          />
          <HeartbeatCard
            label="Quiet Metros"
            value={heartbeat?.quietMetros ?? 0}
            variant={heartbeat?.quietMetros ? 'warning' : 'default'}
            helpText="Metros where ingestion ran but found nothing"
          />
          <HeartbeatCard
            label="Stale Metros"
            value={heartbeat?.staleMetros ?? 0}
            variant={heartbeat?.staleMetros ? 'danger' : 'default'}
            helpText="Metros with no completed run in 8+ days"
          />
        </div>

        {/* ── Manual Sweep Button ── */}
        <div className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() => triggerSweep.mutate()}
            disabled={triggerSweep.isPending}
          >
            {triggerSweep.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <PlayCircle className="h-4 w-4 mr-2" />
            )}
            Run Sweep Now
          </Button>
        </div>

        {/* ── Tabs ── */}
        <Tabs defaultValue="health">
          <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
            <TabsList className="inline-flex w-max md:w-auto">
              <TabsTrigger value="health" className="whitespace-nowrap gap-1.5">
                <Activity className="h-4 w-4" /> Metros Health
              </TabsTrigger>
              <TabsTrigger value="suggestions" className="whitespace-nowrap gap-1.5">
                <ListChecks className="h-4 w-4" /> Suggestion Ledger
              </TabsTrigger>
              <TabsTrigger value="runs" className="whitespace-nowrap gap-1.5">
                <Radar className="h-4 w-4" /> Recent Runs
              </TabsTrigger>
              <TabsTrigger value="schedules" className="whitespace-nowrap gap-1.5">
                <CalendarClock className="h-4 w-4" /> Schedules
              </TabsTrigger>
            </TabsList>
          </div>

          {/* ── Metros Health ── */}
          <TabsContent value="health">
            <MetroHealthTable rows={heartbeat?.metroHealth ?? []} />
          </TabsContent>

          {/* ── Suggestion Ledger ── */}
          <TabsContent value="suggestions">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Select value={suggestionType} onValueChange={setSuggestionType}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="All types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All types</SelectItem>
                    <SelectItem value="local_pulse_signal">Community Signal</SelectItem>
                    <SelectItem value="partner_check_in">Partner Check-in</SelectItem>
                    <SelectItem value="event_recommendation">Event Recommendation</SelectItem>
                    <SelectItem value="relationship_nudge">Relationship Nudge</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <SuggestionTable suggestions={suggestions ?? []} isLoading={suggestionsLoading} />
            </div>
          </TabsContent>

          {/* ── Recent Runs ── */}
          <TabsContent value="runs">
            <RunsTable runs={recentRuns ?? []} isLoading={runsLoading} />
          </TabsContent>

          {/* ── Schedules ── */}
          <TabsContent value="schedules">
            <SchedulesTable jobs={jobs ?? []} />
          </TabsContent>
        </Tabs>
      </div>
  );
}

// ── Sub-Components ──

function HeartbeatCard({
  label,
  value,
  variant = 'default',
  helpText,
}: {
  label: string;
  value: string | number;
  variant?: 'default' | 'warning' | 'danger';
  helpText: string;
}) {
  const colorClass =
    variant === 'warning' ? 'text-amber-600 dark:text-amber-400' :
    variant === 'danger' ? 'text-destructive' : '';

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
          {label}
          <Tooltip>
            <TooltipTrigger asChild>
              <HelpCircle className="h-3 w-3 text-muted-foreground/50" />
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[220px] text-xs">
              {helpText}
            </TooltipContent>
          </Tooltip>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${colorClass}`}>{value}</div>
      </CardContent>
    </Card>
  );
}

function StatusChip({ status }: { status: string }) {
  if (status === 'healthy') return <Badge variant="default" className="text-xs">Healthy</Badge>;
  if (status === 'quiet') return <Badge variant="secondary" className="text-xs">Quiet</Badge>;
  if (status === 'stale') return <Badge variant="destructive" className="text-xs">Stale</Badge>;
  return <Badge variant="outline" className="text-xs">{status}</Badge>;
}

function MetroHealthTable({ rows }: { rows: MetroHealthRow[] }) {
  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">
          <AlertTriangle className="h-6 w-6 mx-auto mb-2 text-muted-foreground/50" />
          No sweep data yet. Run a sweep to populate metro health.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="border rounded-lg overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="text-left p-3 font-medium">Metro</th>
            <th className="text-center p-3 font-medium">News</th>
            <th className="text-center p-3 font-medium">Events</th>
            <th className="text-center p-3 font-medium">Narrative</th>
            <th className="text-center p-3 font-medium">Drift</th>
            <th className="text-center p-3 font-medium">Suggestions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.metro_id} className="border-b last:border-0 hover:bg-muted/30">
              <td className="p-3 font-medium">{row.metro_name}</td>
              <td className="p-3 text-center"><StatusChip status={row.news_status} /></td>
              <td className="p-3 text-center"><StatusChip status={row.events_status} /></td>
              <td className="p-3 text-center"><StatusChip status={row.narrative_status} /></td>
              <td className="p-3 text-center"><StatusChip status={row.drift_status} /></td>
              <td className="p-3 text-center">{row.suggestions_created}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SuggestionTable({ suggestions, isLoading }: { suggestions: SystemSuggestion[]; isLoading: boolean }) {
  if (isLoading) {
    return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  if (suggestions.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">
          No suggestions yet. The system sweep generates gentle nudges weekly.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="border rounded-lg overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="text-left p-3 font-medium">Created</th>
            <th className="text-left p-3 font-medium">Type</th>
            <th className="text-left p-3 font-medium">Title</th>
            <th className="text-center p-3 font-medium">Confidence</th>
            <th className="text-center p-3 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {suggestions.map((s) => (
            <tr key={s.id} className="border-b last:border-0 hover:bg-muted/30">
              <td className="p-3 text-muted-foreground whitespace-nowrap">
                {format(new Date(s.created_at), 'MMM d, HH:mm')}
              </td>
              <td className="p-3">
                <Badge variant="outline" className="text-xs">{s.suggestion_type.replace(/_/g, ' ')}</Badge>
              </td>
              <td className="p-3">
                <div className="font-medium">{s.title}</div>
                <div className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{s.summary}</div>
              </td>
              <td className="p-3 text-center">{s.confidence}</td>
              <td className="p-3 text-center">
                {s.acted_at ? (
                  <Badge variant="default" className="text-xs">Acted</Badge>
                ) : s.dismissed_at ? (
                  <Badge variant="secondary" className="text-xs">Dismissed</Badge>
                ) : (
                  <Badge variant="outline" className="text-xs">Open</Badge>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RunsTable({ runs, isLoading }: { runs: SystemJobRun[]; isLoading: boolean }) {
  if (isLoading) {
    return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  if (runs.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">
          No job runs recorded yet.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="border rounded-lg overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="text-left p-3 font-medium">Started</th>
            <th className="text-left p-3 font-medium">Job</th>
            <th className="text-center p-3 font-medium">Scope</th>
            <th className="text-center p-3 font-medium">Status</th>
            <th className="text-right p-3 font-medium">Duration</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((r) => (
            <tr key={r.id} className="border-b last:border-0 hover:bg-muted/30">
              <td className="p-3 text-muted-foreground whitespace-nowrap">
                {format(new Date(r.started_at), 'MMM d, HH:mm')}
              </td>
              <td className="p-3 font-medium">{r.job_key.replace(/_/g, ' ')}</td>
              <td className="p-3 text-center">
                <Badge variant="outline" className="text-xs">{r.scope}</Badge>
              </td>
              <td className="p-3 text-center">
                <Badge
                  variant={r.status === 'completed' ? 'default' : r.status === 'failed' ? 'destructive' : 'secondary'}
                  className="text-xs"
                >
                  {r.status}
                </Badge>
              </td>
              <td className="p-3 text-right text-muted-foreground">
                {r.duration_ms ? `${(r.duration_ms / 1000).toFixed(1)}s` : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SchedulesTable({ jobs }: { jobs: SystemJob[] }) {
  if (jobs.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">
          No scheduled jobs configured.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="border rounded-lg overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="text-left p-3 font-medium">Job</th>
            <th className="text-left p-3 font-medium">Owner</th>
            <th className="text-left p-3 font-medium">Schedule</th>
            <th className="text-center p-3 font-medium">Enabled</th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((j) => (
            <tr key={j.id} className="border-b last:border-0 hover:bg-muted/30">
              <td className="p-3">
                <div className="font-medium">{j.name}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{j.description}</div>
              </td>
              <td className="p-3">
                <Badge variant="outline" className="text-xs">{j.owner}</Badge>
              </td>
              <td className="p-3 text-muted-foreground">{j.schedule}</td>
              <td className="p-3 text-center">
                {j.enabled ? (
                  <Badge variant="default" className="text-xs">Active</Badge>
                ) : (
                  <Badge variant="secondary" className="text-xs">Disabled</Badge>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
