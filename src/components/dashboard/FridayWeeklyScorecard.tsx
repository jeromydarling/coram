import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { HelpTooltip } from '@/components/ui/help-tooltip';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ClipboardList,
  Users,
  Calendar,
  Target,
  Sparkles,
  TrendingUp,
  ArrowRight,
  Anchor,
  Star,
} from 'lucide-react';
import { useFridayScorecard } from '@/hooks/useFridayScorecard';
import { useTranslation } from 'react-i18next';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';

interface FridayWeeklyScorecardProps {
  metroFilter?: string | null;
}

export function FridayWeeklyScorecard({ metroFilter }: FridayWeeklyScorecardProps) {
  const { data, isLoading } = useFridayScorecard(metroFilter);
  const { t } = useTranslation('dashboard');

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-20 rounded-lg" />
            ))}
          </div>
          <Skeleton className="h-24 mt-4 rounded-lg" />
          <Skeleton className="h-32 mt-4 rounded-lg" />
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const metrics = [
    {
      label: t('scorecard.newOpportunities'),
      value: data.newOpportunities,
      icon: ClipboardList,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
    },
    {
      label: t('scorecard.meetingsHeld'),
      value: data.meetingsHeld,
      icon: Users,
      color: 'text-info',
      bgColor: 'bg-info/10',
    },
    {
      label: t('scorecard.eventsAttended'),
      value: data.eventsAttended,
      icon: Calendar,
      color: 'text-warning',
      bgColor: 'bg-warning/10',
    },
    {
      label: t('scorecard.anchorCandidates'),
      value: data.anchorCandidatesIdentified,
      icon: Anchor,
      color: 'text-success',
      bgColor: 'bg-success/10',
    },
  ];

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3 border-b bg-gradient-to-r from-primary/5 to-accent/5">
        <CardTitle className="text-lg flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary" />
          {t('scorecard.fridayWeeklyScorecard')}
          <HelpTooltip contentKey="card.friday-scorecard" />
          <Badge variant="secondary" className="ml-2 text-xs">
            {t('scorecard.thisWeek')}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4 space-y-6">
        {/* Key Metrics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {metrics.map((metric) => (
            <div
              key={metric.label}
              className={cn(
                "rounded-lg p-3 border transition-all hover:shadow-sm",
                metric.bgColor
              )}
            >
              <div className="flex items-center gap-2 mb-1">
                <metric.icon className={cn("w-4 h-4", metric.color)} />
                <span className="text-xs text-muted-foreground font-medium">
                  {metric.label}
                </span>
              </div>
              <p className={cn("text-2xl font-bold", metric.color)}>
                {metric.value}
              </p>
            </div>
          ))}
        </div>

        {/* Funnel vs Target */}
        <div className="rounded-lg border p-4 bg-card">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-chart-1" />
              <span className="text-sm font-medium">{t('scorecard.ordersVsTarget')}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-foreground">
                {data.funnelVolume.toLocaleString()}
              </span>
              <span className="text-sm text-muted-foreground">
                / {data.quarterlyTarget.toLocaleString()} {t('scorecard.devices')}
              </span>
            </div>
          </div>
          <Progress
            value={Math.min(data.funnelPercentage, 100)}
            className="h-3"
          />
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-muted-foreground">
              {t('scorecard.percentOfTarget', { percent: data.funnelPercentage })}
            </span>
            {data.funnelPercentage >= 100 ? (
              <Badge variant="default" className="bg-success text-success-foreground">
                <TrendingUp className="w-3 h-3 mr-1" />
                {t('scorecard.targetMet')}
              </Badge>
            ) : data.funnelPercentage >= 75 ? (
              <Badge variant="secondary" className="bg-info/20 text-info">
                {t('scorecard.onTrack')}
              </Badge>
            ) : (
              <Badge variant="outline" className="text-muted-foreground">
                {t('scorecard.toGo', { count: data.quarterlyTarget - data.funnelVolume })}
              </Badge>
            )}
          </div>
        </div>

        {/* Next Week Top 3 Priorities */}
        <div className="rounded-lg border p-4 bg-card">
          <div className="flex items-center gap-2 mb-3">
            <Star className="w-4 h-4 text-warning" />
            <span className="text-sm font-medium">{t('scorecard.nextWeekTop3')}</span>
          </div>

          {data.topPriorities.length === 0 ? (
            <p className="text-sm text-muted-foreground italic py-2">
              {t('scorecard.noNextWeekEvents')}
            </p>
          ) : (
            <div className="space-y-2">
              {data.topPriorities.map((priority, index) => (
                <div
                  key={priority.id}
                  className={cn(
                    "flex items-start gap-3 p-3 rounded-lg border transition-all hover:shadow-sm",
                    priority.type === 'event' ? "bg-warning/5 border-warning/20" : "bg-primary/5 border-primary/20"
                  )}
                >
                  <div className={cn(
                    "flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold shrink-0",
                    index === 0 ? "bg-warning text-warning-foreground" :
                    index === 1 ? "bg-muted text-muted-foreground" :
                    "bg-muted/50 text-muted-foreground"
                  )}>
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {priority.type === 'event' ? (
                        <Calendar className="w-3.5 h-3.5 text-warning shrink-0" />
                      ) : (
                        <Users className="w-3.5 h-3.5 text-primary shrink-0" />
                      )}
                      <span className="text-sm font-medium truncate">
                        {priority.title}
                      </span>
                      {priority.isAnchorRelated && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-success/10 text-success">
                          <Anchor className="w-2.5 h-2.5 mr-0.5" />
                          {t('scorecard.highPotential')}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                      <span>{format(parseISO(priority.date), 'EEE, MMM d')}</span>
                      {priority.type === 'meeting' && (
                        <span>@ {format(parseISO(priority.date), 'h:mm a')}</span>
                      )}
                      {priority.organization && (
                        <>
                          <ArrowRight className="w-3 h-3" />
                          <span className="truncate">{priority.organization}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
