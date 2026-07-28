/**
 * ConnectorConfidencePanel — Computed confidence score per connector.
 *
 * WHAT: Weighted score from success rate, simulation pass, and uptime.
 * WHERE: Operator Console → Overview tab.
 * WHY: At-a-glance connector reliability without schema changes.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Shield } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { HelpCircle } from 'lucide-react';

function computeConfidence(ih: any): number {
  const successRate = Number(ih.success_rate ?? 0);
  const simPassed = Number(ih.simulated_runs_passed ?? 0);
  const simFailed = Number(ih.simulated_runs_failed ?? 0);
  const simTotal = simPassed + simFailed;
  const simRate = simTotal > 0 ? (simPassed / simTotal) * 100 : 100;

  // Weighted: 50% real success rate, 30% simulation pass rate, 20% recent activity
  const hasRecent = ih.last_checked_at &&
    new Date(ih.last_checked_at) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const uptimeScore = hasRecent ? 100 : 50;

  return Math.round(successRate * 0.5 + simRate * 0.3 + uptimeScore * 0.2);
}

function confidenceLabel(score: number): { label: string; variant: 'default' | 'secondary' | 'destructive' } {
  if (score >= 80) return { label: 'OK', variant: 'default' };
  if (score >= 50) return { label: 'Needs Attention', variant: 'secondary' };
  return { label: 'Broken', variant: 'destructive' };
}

/** Connectors with full adapters (not stubs) */
const FULL_ADAPTER_KEYS = new Set([
  'salesforce', 'airtable', 'fluentcrm', 'jetpackcrm', 'wperp', 'dynamics365', 'civicrm',
]);

/** Connectors with outbound (two-way) support */
const OUTBOUND_KEYS = new Set([
  'dynamics365', 'salesforce', 'blackbaud', 'hubspot',
]);

function rungLabel(key: string): { rung: number; label: string } {
  if (OUTBOUND_KEYS.has(key) && FULL_ADAPTER_KEYS.has(key)) return { rung: 4, label: 'Rung 4 — Runner Verified' };
  if (FULL_ADAPTER_KEYS.has(key)) return { rung: 2, label: 'Rung 2 — Adapter + Drift' };
  return { rung: 1, label: 'Rung 1 — Registry + Guide' };
}

export function ConnectorConfidencePanel() {
  const { data: health, isLoading } = useQuery({
    queryKey: ['operator-integration-health-confidence'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('operator_integration_health')
        .select('*')
        .order('connector_key');
      if (error) throw error;
      return data || [];
    },
  });

  if (isLoading) return <Skeleton className="h-32 w-full" />;
  if (!health?.length) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <h3 className="text-lg font-semibold text-foreground">
          Connector Confidence
        </h3>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              <HelpCircle className="h-4 w-4 text-muted-foreground" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p className="text-xs">
                <strong>What:</strong> Weighted reliability score per connector.<br />
                <strong>Where:</strong> Derived from success rates + simulation passes.<br />
                <strong>Why:</strong> Quick signal on integration health — computed in UI, no schema change.
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {health.map((ih) => {
          const score = computeConfidence(ih);
          const { label, variant } = confidenceLabel(score);

          return (
            <Card key={ih.id} className="rounded-xl">
              <CardContent className="p-4 space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <Shield className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium capitalize truncate">
                        {ih.connector_key}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {ih.environment}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-lg font-bold text-foreground">{score}%</span>
                    <Badge variant={variant} className="text-xs">{label}</Badge>
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground pl-7">
                  {rungLabel(ih.connector_key).label}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
