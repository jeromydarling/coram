/**
 * CommunioHealthTab — Admin-only governance tab for the Operator Console.
 *
 * WHAT: Displays aggregated Communio group health, sharing distribution, quiet groups, and NRI metrics.
 * WHERE: Rendered inside OperatorConsole as the "Communio Health" tab.
 * WHY: Gives CROS leadership visibility into cross-tenant sharing patterns without exposing CRM data.
 */
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { UsersRound, Radio, AlertCircle, BarChart3 } from 'lucide-react';
import { useCommunioGovernance } from '@/hooks/useCommunioGovernance';
import { HelpTooltip } from '@/components/ui/help-tooltip';
const SectionTooltip = HelpTooltip;

const SHARING_LEVEL_ORDER = ['none', 'signals', 'reflections', 'collaboration'];

export function CommunioHealthTab() {
  const {
    totalGroups,
    avgTenantsPerGroup,
    signalsThisWeek,
    sharingDistribution,
    quietGroups,
    nriMetrics,
    isLoading,
  } = useCommunioGovernance();

  const totalMemberships = Object.values(sharingDistribution).reduce(
    (s, v) => s + v,
    0,
  );

  // NRI aggregate (latest week across all tenants)
  const latestNriWeek = nriMetrics.data?.[0]?.week_start;
  const latestNri = nriMetrics.data?.filter((n) => n.week_start === latestNriWeek) ?? [];
  const nriTotals = {
    signalsGenerated: latestNri.reduce((s, n) => s + n.signals_generated, 0),
    signalsShared: latestNri.reduce((s, n) => s + n.signals_shared_to_communio, 0),
    reflections: latestNri.reduce((s, n) => s + n.reflections_triggered, 0),
    flags: latestNri.reduce((s, n) => s + n.testimonium_flags_generated, 0),
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Active Groups */}
      <section>
        <h3 className="text-base font-semibold text-foreground mb-3">
          Active Groups
          <SectionTooltip
            what="Summary of Communio group participation across the platform"
            where="communio_group_metrics (latest week)"
            why="Understand how widely cross-tenant sharing is being adopted"
          />
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <MetricCard icon={UsersRound} label="Total Groups" value={totalGroups} />
          <MetricCard icon={UsersRound} label="Avg Tenants / Group" value={avgTenantsPerGroup} />
          <MetricCard icon={Radio} label="Signals This Week" value={signalsThisWeek} />
        </div>
      </section>

      {/* Sharing Levels Distribution */}
      <section>
        <h3 className="text-base font-semibold text-foreground mb-3">
          Sharing Levels
          <SectionTooltip
            what="Distribution of sharing levels across all group memberships"
            where="communio_group_metrics.collaboration_levels"
            why="Track how deeply organizations are engaging with cross-tenant sharing"
          />
        </h3>
        <Card>
          <CardContent className="py-4 space-y-2">
            {SHARING_LEVEL_ORDER.map((level) => {
              const count = sharingDistribution[level] || 0;
              const pct = totalMemberships > 0 ? Math.round((count / totalMemberships) * 100) : 0;
              return (
                <div key={level} className="flex items-center gap-3">
                  <span className="text-sm capitalize w-28 text-muted-foreground font-serif">{level}</span>
                  <div className="flex-1 bg-muted rounded-full h-3 overflow-hidden">
                    <div
                      className="bg-primary/60 h-full rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground w-16 text-right">{count} ({pct}%)</span>
                </div>
              );
            })}
            {totalMemberships === 0 && (
              <p className="text-sm text-muted-foreground text-center py-2 font-serif">
                No membership data yet. Run the governance rollup to populate.
              </p>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Quiet Groups */}
      <section>
        <h3 className="text-base font-semibold text-foreground mb-3">
          Quiet Groups
          <SectionTooltip
            what="Groups with no shared signals or events this week"
            where="communio_group_metrics (signals + events = 0)"
            why="Identify groups that may need encouragement or review"
          />
        </h3>
        {quietGroups.length > 0 ? (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Group ID</TableHead>
                    <TableHead className="text-right">Members</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {quietGroups.map((g) => (
                    <TableRow key={g.group_id}>
                      <TableCell className="font-mono text-xs truncate max-w-[200px]">{g.group_id}</TableCell>
                      <TableCell className="text-right">{g.tenant_count}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="py-6 text-center text-muted-foreground text-sm font-serif">
              All groups have activity this week. A healthy network.
            </CardContent>
          </Card>
        )}
      </section>

      {/* NRI Activity */}
      <section>
        <h3 className="text-base font-semibold text-foreground mb-3">
          NRI Activity (This Week)
          <SectionTooltip
            what="Narrative Relational Intelligence usage across all tenants"
            where="nri_usage_metrics (latest week)"
            why="Track how actively the platform's relational intelligence is being used"
          />
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <MetricCard icon={BarChart3} label="Signals Generated" value={nriTotals.signalsGenerated} />
          <MetricCard icon={Radio} label="Shared to Communio" value={nriTotals.signalsShared} />
          <MetricCard icon={BarChart3} label="Reflections" value={nriTotals.reflections} />
          <MetricCard icon={AlertCircle} label="Testimonium Flags" value={nriTotals.flags} />
        </div>
      </section>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 py-5">
        <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Icon className="h-4 w-4 text-primary" />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-lg font-bold text-foreground">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
