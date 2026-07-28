import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import { useActionEffectiveness, useOrgCampaignActions, useCampaignOutcomes } from '@/hooks/useCampaignIntelligence';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDistanceToNow } from 'date-fns';

interface CampaignIntelligenceCardProps {
  orgId: string;
}

const OUTCOME_LABELS: Record<string, { label: string; icon: typeof CheckCircle2; color: string }> = {
  reply: { label: 'Reply', icon: CheckCircle2, color: 'text-chart-2' },
  click: { label: 'Click', icon: TrendingUp, color: 'text-chart-1' },
  meeting: { label: 'Meeting', icon: CheckCircle2, color: 'text-chart-2' },
  ignore: { label: 'Ignored', icon: Clock, color: 'text-muted-foreground' },
  bounce: { label: 'Bounce', icon: AlertTriangle, color: 'text-destructive' },
  unsubscribe: { label: 'Unsub', icon: TrendingDown, color: 'text-destructive' },
};

function EffectivenessBadge({ rate }: { rate: number }) {
  if (rate >= 0.5) return <Badge className="bg-chart-2/15 text-chart-2 text-xs">Proven</Badge>;
  if (rate >= 0.15) return <Badge className="bg-warning/15 text-warning text-xs">Experimental</Badge>;
  return <Badge className="bg-destructive/15 text-destructive text-xs">Suppressed</Badge>;
}

export function CampaignIntelligenceCard({ orgId }: CampaignIntelligenceCardProps) {
  const { data: effectiveness, isLoading: effLoading } = useActionEffectiveness(orgId);
  const { data: actions, isLoading: actLoading } = useOrgCampaignActions(orgId);
  const actionIds = (actions || []).map((a) => a.id);
  const { data: outcomes } = useCampaignOutcomes(actionIds);

  const isLoading = effLoading || actLoading;
  const gmailEff = (effectiveness || []).find((e) => e.action_type === 'gmail_campaign');
  const executedActions = (actions || []).filter((a) => a.status === 'executed');
  const outcomeCounts = (outcomes || []).reduce(
    (acc, o) => {
      acc[o.outcome_type] = (acc[o.outcome_type] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-primary" />
            Campaign Intelligence
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-16 rounded-lg" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-primary" />
          Campaign Intelligence
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Effectiveness summary */}
        {gmailEff ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Gmail Campaign Success</span>
              <EffectivenessBadge rate={gmailEff.success_rate} />
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-muted/30 rounded-lg p-2">
                <p className="text-lg font-bold">{gmailEff.total_actions}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
              <div className="bg-muted/30 rounded-lg p-2">
                <p className="text-lg font-bold">{gmailEff.successful_actions}</p>
                <p className="text-xs text-muted-foreground">Successful</p>
              </div>
              <div className="bg-muted/30 rounded-lg p-2">
                <p className="text-lg font-bold">{Math.round(gmailEff.success_rate * 100)}%</p>
                <p className="text-xs text-muted-foreground">Rate</p>
              </div>
            </div>
            {gmailEff.last_success_at && (
              <p className="text-xs text-muted-foreground">
                Last success: {formatDistanceToNow(new Date(gmailEff.last_success_at))} ago
              </p>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No campaign history for this organization.</p>
        )}

        {/* Outcome breakdown */}
        {Object.keys(outcomeCounts).length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase">Outcomes</p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(outcomeCounts).map(([type, count]) => {
                const config = OUTCOME_LABELS[type] || { label: type, color: 'text-muted-foreground' };
                return (
                  <div key={type} className="flex items-center gap-1 text-xs">
                    <span className={config.color}>{config.label}</span>
                    <Badge variant="secondary" className="text-xs h-5 px-1.5">{count}</Badge>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Previously tried actions */}
        {executedActions.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase">
              Previously Tried ({executedActions.length})
            </p>
            <div className="space-y-1 max-h-[120px] overflow-y-auto">
              {executedActions.slice(0, 5).map((action) => (
                <div
                  key={action.id}
                  className="flex items-center justify-between text-xs p-1.5 rounded bg-muted/20"
                >
                  <span className="truncate text-muted-foreground">
                    {action.action_type.replace(/_/g, ' ')} — {action.source}
                  </span>
                  {action.executed_at && (
                    <span className="text-muted-foreground shrink-0 ml-2">
                      {formatDistanceToNow(new Date(action.executed_at))} ago
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
