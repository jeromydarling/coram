/**
 * DataIntegrityPanel — Operator Nexus panel for data health.
 *
 * WHAT: Shows orphan FK sweep results and data completeness scores.
 * WHERE: Embeddable in Operator Nexus MACHINA zone.
 * WHY: Gardeners need calm visibility into data quality without technical jargon.
 */
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useOrphanSweep } from '@/hooks/useOrphanSweep';
import { useDataCompleteness } from '@/hooks/useDataCompleteness';
import { useTenant } from '@/contexts/TenantContext';
import { Shield, Database, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import { HelpTooltip } from '@/components/ui/help-tooltip';

function CompletenessBar({ label, pct }: { label: string; pct: number }) {
  const color = pct >= 80 ? 'bg-primary' : pct >= 50 ? 'bg-accent' : 'bg-destructive';
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{pct}%</span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function DataIntegrityPanel() {
  const { tenantId } = useTenant();
  const currentTenantId = tenantId;
  const { data: orphans, isLoading: orphansLoading } = useOrphanSweep();
  const { data: completeness, isLoading: completenessLoading } = useDataCompleteness(currentTenantId ?? undefined);

  const isLoading = orphansLoading || completenessLoading;
  const orphanCount = orphans?.reduce((sum, o) => sum + o.orphan_count, 0) ?? 0;
  const isHealthy = orphanCount === 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Shield className="h-4 w-4 text-primary" />
          Data Integrity
          <HelpTooltip
            what="Monitors the health of your data relationships and completeness."
            where="Operator Nexus — MACHINA zone"
            why="Orphan references and incomplete records silently degrade system reliability."
          />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Checking data health…
          </div>
        ) : (
          <>
            {/* Orphan Sweep */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Relationship Integrity</span>
                {isHealthy ? (
                  <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">
                    <CheckCircle2 className="h-3 w-3 mr-1" /> Clean
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50">
                    <AlertTriangle className="h-3 w-3 mr-1" /> {orphanCount} orphan{orphanCount !== 1 ? 's' : ''}
                  </Badge>
                )}
              </div>
              {!isHealthy && orphans?.map((o, i) => (
                <p key={i} className="text-xs text-muted-foreground pl-6">
                  {o.orphan_count} record{o.orphan_count !== 1 ? 's' : ''} in <code className="text-xs">{o.table}</code> reference missing <code className="text-xs">{o.references}</code>
                </p>
              ))}
              {isHealthy && (
                <p className="text-xs text-muted-foreground pl-6">
                  All references are intact. No orphaned records found.
                </p>
              )}
            </div>

            {/* Data Completeness */}
            {completeness && (
              <div className="space-y-3">
                <span className="text-sm font-medium">Data Completeness</span>
                <CompletenessBar label="People" pct={completeness.contacts.completeness_pct} />
                <CompletenessBar label="Partnerships" pct={completeness.opportunities.completeness_pct} />
                <p className="text-xs text-muted-foreground">
                  {completeness.contacts.total} people · {completeness.opportunities.total} partnerships
                </p>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
