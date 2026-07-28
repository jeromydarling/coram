import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import {
  useActionTypeEffectiveness,
  useSignalTypeEffectiveness,
  useIgnoredSignalOrgs,
} from '@/hooks/useLearningDashboard';
import { useTopNextActions } from '@/hooks/useNextActions';
import { Brain, TrendingUp, AlertTriangle, BarChart3, Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

function EffectivenessBar({ label, rate, count }: { label: string; rate: number; count: number }) {
  const pct = Math.round(rate * 100);
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium truncate">{label}</span>
        <span className="text-muted-foreground text-xs">{pct}% ({count})</span>
      </div>
      <Progress value={pct} className="h-2" />
    </div>
  );
}

export function LearningDashboardPanel() {
  const { t } = useTranslation('dashboard');
  const { data: actionTypes, isLoading: atLoading } = useActionTypeEffectiveness();
  const { data: signalTypes, isLoading: stLoading } = useSignalTypeEffectiveness();
  const { data: ignoredOrgs, isLoading: ioLoading } = useIgnoredSignalOrgs();
  const { data: topActions, isLoading: taLoading } = useTopNextActions(5);
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      {/* What Works Best */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-success" /> {t('learningDashboard.whatWorksBest')}
            </CardTitle>
            <CardDescription>{t('learningDashboard.whatWorksBestDescription')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {atLoading ? (
              Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)
            ) : !actionTypes?.length ? (
              <p className="text-sm text-muted-foreground text-center py-4">{t('learningDashboard.noDataYet')}</p>
            ) : (
              actionTypes
                .sort((a, b) => b.success_rate - a.success_rate)
                .map((at) => (
                  <EffectivenessBar
                    key={at.action_type}
                    label={at.action_type.replace(/_/g, ' ')}
                    rate={at.success_rate}
                    count={at.executed_actions}
                  />
                ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-primary" /> {t('learningDashboard.signalSources')}
            </CardTitle>
            <CardDescription>{t('learningDashboard.signalSourcesDescription')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {stLoading ? (
              Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)
            ) : !signalTypes?.length ? (
              <p className="text-sm text-muted-foreground text-center py-4">{t('learningDashboard.noDataYet')}</p>
            ) : (
              signalTypes
                .sort((a, b) => b.success_rate - a.success_rate)
                .map((st) => (
                  <EffectivenessBar
                    key={st.source}
                    label={st.source.replace(/_/g, ' ')}
                    rate={st.success_rate}
                    count={st.actions_executed}
                  />
                ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top Actions Today + Ignored Signals */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Brain className="w-4 h-4 text-primary" /> {t('learningDashboard.topActionsToday')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {taLoading ? (
              Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)
            ) : !topActions?.length ? (
              <p className="text-sm text-muted-foreground text-center py-4">{t('learningDashboard.noPendingActions')}</p>
            ) : (
              topActions.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center gap-2 p-2 rounded-lg bg-muted/30 hover:bg-muted/50 cursor-pointer transition-colors"
                  onClick={() => navigate(`/opportunities/${a.org_id}`)}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{a.summary}</p>
                    <p className="text-[10px] text-muted-foreground">
                      Score: {a.score.toFixed(1)} • {a.action_type}
                    </p>
                  </div>
                  <Badge
                    className={cn(
                      'text-[10px]',
                      a.score >= 15
                        ? 'bg-destructive/15 text-destructive'
                        : a.score >= 10
                        ? 'bg-warning/15 text-warning'
                        : 'bg-muted text-muted-foreground'
                    )}
                  >
                    {a.severity}/5
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-warning" /> {t('learningDashboard.signalsWithoutActions')}
            </CardTitle>
            <CardDescription>{t('learningDashboard.signalsWithoutActionsDescription')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {ioLoading ? (
              Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)
            ) : !ignoredOrgs?.length ? (
              <p className="text-sm text-muted-foreground text-center py-4">{t('learningDashboard.allSignalsActedUpon')}</p>
            ) : (
              ignoredOrgs.map((o) => (
                <div
                  key={o.org_id}
                  className="flex items-center gap-2 p-2 rounded-lg bg-warning/5 hover:bg-warning/10 cursor-pointer transition-colors"
                  onClick={() => navigate(`/opportunities/${o.org_id}`)}
                >
                  <Building2 className="w-4 h-4 text-warning shrink-0" />
                  <span className="text-sm font-medium truncate">{o.organization}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
