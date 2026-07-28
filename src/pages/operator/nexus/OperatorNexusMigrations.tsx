/**
 * OperatorNexusMigrations — Migration & Integration workflow dashboard.
 *
 * WHAT: Connector registry health, migration run history, and sandbox status.
 * WHERE: /operator/nexus/migrations
 * WHY: Operators need a human-centered view of data migration workflows.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Link } from 'react-router-dom';
import {
  CheckCircle2,
  Clock,
  Database,
  ExternalLink,
  FlaskConical,
  Plug,
  XCircle,
} from 'lucide-react';
import { calmText } from '@/lib/calmMode';

export default function OperatorNexusMigrations() {
  // Active connectors
  const { data: connectors, isLoading: cl } = useQuery({
    queryKey: ['nexus-mig-connectors'],
    queryFn: async () => {
      const { data } = await supabase
        .from('integration_connectors')
        .select('key, display_name, active, direction, notes')
        .order('display_name');
      return data ?? [];
    },
  });

  // Recent migration runs (last 30 days)
  const { data: migrationRuns, isLoading: ml } = useQuery({
    queryKey: ['nexus-mig-runs'],
    queryFn: async () => {
      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from('migration_runs')
        .select('id, connector_key, environment, status, started_at, completed_at, tenant_id, mode, total_records, successful_records, failed_records')
        .gte('started_at', since)
        .order('started_at', { ascending: false })
        .limit(20);
      return data ?? [];
    },
  });

  // Active tenant connections
  const { data: connectionCount } = useQuery({
    queryKey: ['nexus-mig-connections-count'],
    queryFn: async () => {
      const { count } = await supabase
        .from('integration_connections')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active');
      return count ?? 0;
    },
  });

  const statusIcon = (status: string) => {
    if (status === 'completed') return <CheckCircle2 className="w-3.5 h-3.5 text-primary" />;
    if (status === 'failed') return <XCircle className="w-3.5 h-3.5 text-muted-foreground" />;
    return <Clock className="w-3.5 h-3.5 text-muted-foreground" />;
  };

  const envBadge = (env: string) => (
    <Badge variant="outline" className="text-xs">
      {env === 'sandbox' ? '🧪 Sandbox' : '🟢 Production'}
    </Badge>
  );

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-foreground font-serif">Migration & Integrations</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Connector health, migration history, and data movement workflows.
        </p>
      </div>

      {/* Summary Stats */}
      <section>
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">Overview</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {cl ? (
            Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24" />)
          ) : (
            <>
              <Card>
                <CardContent className="pt-5 pb-4">
                  <p className="text-xs text-muted-foreground">Active Connectors</p>
                  <p className="text-2xl font-semibold text-foreground font-serif">
                    {connectors?.filter(c => c.active).length ?? 0}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">of {connectors?.length ?? 0} total</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-5 pb-4">
                  <p className="text-xs text-muted-foreground">Live Connections</p>
                  <p className="text-2xl font-semibold text-foreground font-serif">{connectionCount ?? 0}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Active tenant integrations</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-5 pb-4">
                  <p className="text-xs text-muted-foreground">Migrations (30d)</p>
                  <p className="text-2xl font-semibold text-foreground font-serif">{migrationRuns?.length ?? 0}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Runs completed</p>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </section>

      {/* Quick Links */}
      <section>
        <div className="flex flex-wrap gap-2">
          <Link to="/operator/nexus/integrations">
            <Button variant="outline" size="sm" className="gap-1.5">
              <Plug className="w-3.5 h-3.5" /> Relatio Registry
              <ExternalLink className="w-3 h-3" />
            </Button>
          </Link>
          <Link to="/operator/scenario-lab">
            <Button variant="outline" size="sm" className="gap-1.5">
              <FlaskConical className="w-3.5 h-3.5" /> Demo Lab
              <ExternalLink className="w-3 h-3" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Connector Registry */}
      <section>
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">Connector Registry</h2>
        {cl ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16" />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {connectors?.map((c: any) => (
              <Card key={c.key} className="hover:border-primary/20 transition-colors">
                <CardContent className="pt-4 pb-3 flex items-center gap-3">
                  <div className="p-1.5 rounded-md bg-muted shrink-0">
                    <Database className="w-4 h-4 text-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{c.display_name}</p>
                    <p className="text-xs text-muted-foreground">{c.direction || 'General'}</p>
                  </div>
                  <Badge variant={c.active ? 'default' : 'outline'} className="text-xs shrink-0">
                    {c.active ? 'Active' : 'Inactive'}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Recent Migration Runs */}
      <section>
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">Recent Migrations</h2>
        {ml ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20" />)}
          </div>
        ) : migrationRuns && migrationRuns.length > 0 ? (
          <div className="space-y-2">
            {migrationRuns.map((run: any) => (
              <Card key={run.id} className="hover:border-primary/20 transition-colors">
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        {statusIcon(run.status)}
                        <p className="text-sm font-medium text-foreground">
                          {run.connector_key} · {run.mode === 'dry_run' ? 'Dry Run' : 'Commit'}
                        </p>
                        {envBadge(run.environment)}
                      </div>
                      <p className="text-xs text-muted-foreground ml-5">
                        {run.successful_records ?? 0} imported · {run.failed_records ?? 0} issues · {new Date(run.started_at).toLocaleDateString()}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-xs shrink-0">
                      {calmText(run.status === 'failed' ? 'Failed' : run.status)}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="pt-5 pb-4 flex items-center gap-3 text-muted-foreground">
              <CheckCircle2 className="w-4 h-4 text-primary" />
              <p className="text-sm">No migration runs in the last 30 days.</p>
            </CardContent>
          </Card>
        )}
      </section>
    </div>
  );
}
