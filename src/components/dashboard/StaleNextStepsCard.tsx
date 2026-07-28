import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Clock, ChevronRight, AlertTriangle } from 'lucide-react';
import { useStaleNextSteps } from '@/hooks/useStaleNextSteps';
import { cn } from '@/lib/utils';
import { HelpTooltip } from '@/components/ui/help-tooltip';
import { useTranslation } from 'react-i18next';

export function StaleNextStepsCard() {
  const navigate = useNavigate();
  const { data: staleItems, isLoading } = useStaleNextSteps();
  const { t } = useTranslation('dashboard');

  if (!isLoading && (!staleItems || staleItems.length === 0)) {
    return null; // Don't show card if no stale items
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="w-4 h-4 text-warning" />
              {t('staleNextSteps.title')}
              <HelpTooltip contentKey="card.stale-next-steps" />
            </CardTitle>
            <CardDescription className="text-xs">
              {t('staleNextSteps.description')}
            </CardDescription>
          </div>
          {staleItems && (
            <Badge variant="outline" className="text-xs">
              {staleItems.length}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading ? (
          <>
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </>
        ) : (
          staleItems?.map(item => (
            <div
              key={item.id}
              className={cn(
                "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors hover:bg-accent/50",
                item.daysSinceUpdate >= 30
                  ? "border-l-4 border-l-destructive bg-destructive/5"
                  : "border-l-4 border-l-warning bg-warning/5"
              )}
              onClick={() => navigate(`/opportunities/${item.id}`)}
            >
              <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm truncate">{item.organization}</span>
                  <Badge variant="outline" className="text-xs shrink-0">
                    {item.daysSinceUpdate}d ago
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground truncate mt-0.5">
                  {item.next_step}
                  {item.metroName && <span className="ml-1">• {item.metroName}</span>}
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
