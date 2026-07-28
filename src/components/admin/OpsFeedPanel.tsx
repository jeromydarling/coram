import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, AlertTriangle, Activity, Shield, TrendingUp } from 'lucide-react';
import { useOpsAlerts, useOpsDigest, type OpsAlert } from '@/hooks/useOpsAlerts';
import { workflowLabel } from '@/lib/automationHealthFormatters';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useState } from 'react';

function AlertSeverityBadge({ severity }: { severity: OpsAlert['severity'] }) {
  const variants: Record<string, 'destructive' | 'secondary' | 'outline'> = {
    critical: 'destructive',
    warning: 'secondary',
    info: 'outline',
  };
  return <Badge variant={variants[severity]} className="text-xs">{severity}</Badge>;
}

function AlertTypeIcon({ type }: { type: OpsAlert['type'] }) {
  switch (type) {
    case 'stuck_runs': return <AlertTriangle className="w-3.5 h-3.5 text-warning" />;
    case 'cap_hit': return <Shield className="w-3.5 h-3.5 text-destructive" />;
    case 'retry_spike': return <Activity className="w-3.5 h-3.5 text-primary" />;
    case 'high_usage': return <TrendingUp className="w-3.5 h-3.5 text-accent" />;
    case 'repeated_failure': return <AlertTriangle className="w-3.5 h-3.5 text-destructive" />;
    default: return null;
  }
}

function OpsFeedAlerts({ windowHours }: { windowHours: number }) {
  const { data: alerts, isLoading } = useOpsAlerts(windowHours);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          Active Alerts ({alerts?.length ?? 0})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!alerts?.length ? (
          <p className="text-sm text-muted-foreground py-2">No alerts — all clear ✓</p>
        ) : (
          <div className="space-y-2">
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 border border-border/50"
              >
                <AlertTypeIcon type={alert.type} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-medium">{alert.title}</span>
                    <AlertSeverityBadge severity={alert.severity} />
                  </div>
                  <p className="text-xs text-muted-foreground">{alert.detail}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function OpsDigestSummary() {
  const { data, isLoading } = useOpsDigest();

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Activity className="w-4 h-4" />
          24h Ops Digest
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <KPIStat label="Total Runs" value={data.totalRuns.toString()} />
          <KPIStat label="Processed" value={data.processed.toString()} />
          <KPIStat label="Failures" value={data.failures.toString()} highlight={data.failures > 0} />
          <KPIStat label="Cap Hits" value={data.capHits.toString()} highlight={data.capHits > 0} />
          <KPIStat label="Success Rate" value={`${data.successRate}%`} highlight={data.successRate < 90} />
        </div>

        {/* Failures by workflow */}
        {Object.keys(data.failuresByWorkflow).length > 0 && (
          <div className="space-y-1 pt-2 border-t">
            <p className="text-xs font-medium text-muted-foreground">Failures by Workflow</p>
            {Object.entries(data.failuresByWorkflow).map(([wk, count]) => (
              <div key={wk} className="flex justify-between text-xs">
                <span>{workflowLabel(wk)}</span>
                <Badge variant="destructive" className="text-xs">{count as number}</Badge>
              </div>
            ))}
          </div>
        )}

        {/* Top orgs */}
        {data.topOrgs.length > 0 && (
          <div className="space-y-1 pt-2 border-t">
            <p className="text-xs font-medium text-muted-foreground">Top Orgs (24h)</p>
            {data.topOrgs.map((o) => (
              <div key={o.org_id} className="flex justify-between text-xs">
                <span className="truncate">{o.org_name || o.org_id.slice(0, 8)}</span>
                <span className="font-mono">{o.count} runs</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function KPIStat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`p-3 rounded-lg text-center ${highlight ? 'bg-destructive/10' : 'bg-muted/50'}`}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-lg font-bold ${highlight ? 'text-destructive' : ''}`}>{value}</p>
    </div>
  );
}

export function OpsFeedPanel() {
  const [windowHours, setWindowHours] = useState(24);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Select value={String(windowHours)} onValueChange={(v) => setWindowHours(Number(v))}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="24">Last 24 hours</SelectItem>
            <SelectItem value="168">Last 7 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <OpsDigestSummary />
      <OpsFeedAlerts windowHours={windowHours} />
    </div>
  );
}
