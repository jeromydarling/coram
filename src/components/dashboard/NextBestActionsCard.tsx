import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { HelpTooltip } from '@/components/ui/help-tooltip';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Zap, ChevronRight, MoreHorizontal, Check, X, Clock, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTopNextActions, useUpdateNextAction, type NextAction } from '@/hooks/useNextActions';
import { useTranslation } from 'react-i18next';
import { addDays } from 'date-fns';

function severityColor(severity: number) {
  if (severity >= 4) return 'bg-destructive/15 text-destructive border-l-destructive';
  if (severity >= 3) return 'bg-warning/15 text-warning border-l-warning';
  return 'bg-muted/50 text-muted-foreground border-l-muted';
}

function scoreBadge(score: number, t: (key: string) => string) {
  if (score >= 15) return { label: t('nextBestActions.highPriority'), className: 'bg-destructive/15 text-destructive' };
  if (score >= 10) return { label: t('nextBestActions.medium'), className: 'bg-warning/15 text-warning' };
  return { label: t('nextBestActions.low'), className: 'bg-muted text-muted-foreground' };
}

function ActionRow({ action }: { action: NextAction }) {
  const navigate = useNavigate();
  const update = useUpdateNextAction();
  const { t } = useTranslation('dashboard');
  const badge = scoreBadge(action.score, t);

  return (
    <div
      className={cn(
        'flex items-center gap-3 p-3 rounded-lg border-l-4 cursor-pointer transition-colors hover:bg-accent/50',
        severityColor(action.severity)
      )}
      onClick={() => navigate(`/opportunities/${action.org_id}`)}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="font-medium text-sm truncate text-foreground">{action.summary}</span>
          <Badge className={cn('text-[10px] shrink-0', badge.className)}>{badge.label}</Badge>
        </div>
        <p className="text-xs text-muted-foreground truncate">
          {action.action_type} • {action.source_type} • Score: {action.score.toFixed(1)}
          {action.predicted_success_rate != null && (
            <span> • {(action.predicted_success_rate * 100).toFixed(0)}% predicted</span>
          )}
        </p>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
            {update.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MoreHorizontal className="w-3.5 h-3.5" />}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
          <DropdownMenuItem onClick={() => update.mutate({ id: action.id, status: 'executed' })}>
            <Check className="w-3.5 h-3.5 mr-2" /> {t('nextBestActions.execute')}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => update.mutate({ id: action.id, status: 'dismissed' })}>
            <X className="w-3.5 h-3.5 mr-2" /> {t('nextBestActions.dismiss')}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() =>
              update.mutate({
                id: action.id,
                status: 'snoozed',
                snoozed_until: addDays(new Date(), 7).toISOString(),
              })
            }
          >
            <Clock className="w-3.5 h-3.5 mr-2" /> {t('nextBestActions.snooze7d')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
    </div>
  );
}

export function NextBestActionsCard() {
  const { data: actions, isLoading } = useTopNextActions(8);
  const { t } = useTranslation('dashboard');

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-primary" />
              {t('nextBestActions.title')}
              <HelpTooltip contentKey="card.next-best-actions" />
            </CardTitle>
            <CardDescription>{t('nextBestActions.description')}</CardDescription>
          </div>
          <Badge variant="secondary" className="text-xs">{actions?.length || 0}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)
        ) : !actions?.length ? (
          <p className="text-sm text-muted-foreground text-center py-6">{t('nextBestActions.noPendingActions')}</p>
        ) : (
          actions.map((a) => <ActionRow key={a.id} action={a} />)
        )}
      </CardContent>
    </Card>
  );
}
