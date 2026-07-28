/**
 * AIUsageCard — Gentle AI usage display for tenant settings.
 *
 * WHAT: Shows current AI call usage, dynamic quota, and soft upgrade nudge.
 * WHERE: Tenant Settings page.
 * WHY: Stewards need calm visibility into their AI capacity without pressure.
 */
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Brain, Users, Sparkles } from 'lucide-react';
import { HelpTooltip } from '@/components/ui/help-tooltip';
import { useAIQuota } from '@/hooks/useAIQuota';
import { Skeleton } from '@/components/ui/skeleton';

export function AIUsageCard() {
  const { t } = useTranslation('settings');
  const { data: summary, isLoading } = useAIQuota();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            {t('aiUsage.title')}
          </CardTitle>
        </CardHeader>
        <CardContent><Skeleton className="h-24 w-full" /></CardContent>
      </Card>
    );
  }

  if (!summary) return null;

  const { quota, used, callPct, isNearLimit, isAtLimit } = summary;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="h-5 w-5" />
          {t('aiUsage.title')}
          <HelpTooltip content={t('aiUsage.tooltipContent')} />
        </CardTitle>
        <CardDescription>
          {t('aiUsage.description')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Usage bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{t('aiUsage.conversationsUsed')}</span>
            <span className="font-medium tabular-nums">
              {used.calls.toLocaleString()} / {quota.calls.toLocaleString()}
            </span>
          </div>
          <Progress
            value={Math.min(callPct, 100)}
            className="h-2"
          />
          {isAtLimit && (
            <p className="text-sm text-destructive">
              {t('aiUsage.atLimit')}
            </p>
          )}
          {isNearLimit && !isAtLimit && (
            <p className="text-sm text-warning">
              {t('aiUsage.nearLimit')}
            </p>
          )}
        </div>

        {/* Capacity info */}
        <div className="flex items-center gap-4 text-sm text-muted-foreground pt-2 border-t">
          <div className="flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" />
            <span>{t('aiUsage.activeMembers', { count: quota.active_users })}</span>
          </div>
          {quota.scaled && (
            <Badge variant="outline" className="text-xs">
              <Sparkles className="h-3 w-3 mr-1" />
              {t('aiUsage.sharedPool')}
            </Badge>
          )}
        </div>

        {quota.scaled && (
          <p className="text-xs text-muted-foreground">
            {t('aiUsage.sharedPoolNote')}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
