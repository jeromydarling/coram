import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { HelpTooltip } from '@/components/ui/help-tooltip';
import { useWeeklyPlan, useOpenPlanItemCount, useGenerateWeeklyPlan } from '@/hooks/useWeeklyPlan';
import { getWeekDisplayRange, getWeekStartDate } from '@/lib/weekDate';
import { getCategoryDisplayLabel } from '@/lib/categoryLabels';
import { Target, ChevronRight, Sparkles, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { WeeklyFocusPlanPanel } from './WeeklyFocusPlanPanel';

interface WeeklyFocusCardProps {
  defaultOpen?: boolean;
}

export function WeeklyFocusCard({ defaultOpen = false }: WeeklyFocusCardProps) {
  const [isPanelOpen, setIsPanelOpen] = useState(defaultOpen);
  const { data: plan, isLoading } = useWeeklyPlan();
  const openCount = useOpenPlanItemCount();
  const generatePlan = useGenerateWeeklyPlan();
  const weekStartDate = getWeekStartDate();
  
  const hasPlan = plan && plan.plan_json.length > 0;
  
  // Get preview items (up to 3, excluding dismissed)
  const previewItems = plan?.plan_json
    .filter(item => item.status !== 'dismissed')
    .slice(0, 3) || [];
  
  const handleGeneratePlan = async () => {
    await generatePlan.mutateAsync();
  };
  
  return (
    <>
      <Card data-tour="weekly-focus-card" className="bg-gradient-to-br from-primary/5 via-background to-background border-primary/20">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Target className="w-4 h-4 text-primary" />
              This Week's Focus
              <HelpTooltip contentKey="card.weekly-focus-plan" />
            </CardTitle>
            {hasPlan && openCount > 0 && (
              <Badge variant="default" className="text-xs">
                {openCount} open
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {getWeekDisplayRange(weekStartDate)}
          </p>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : !hasPlan ? (
            <div className="text-center py-4">
              <Sparkles className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground mb-3">
                No focus plan for this week yet
              </p>
              <Button 
                onClick={handleGeneratePlan}
                disabled={generatePlan.isPending}
                size="sm"
                className="gap-2"
              >
                {generatePlan.isPending ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                Generate Plan
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {previewItems.map((item) => (
                <div
                  key={item.id}
                  className={cn(
                    "flex items-center gap-3 p-2 rounded-lg bg-muted/50 cursor-pointer hover:bg-muted transition-colors",
                    item.status === 'done' && "opacity-60"
                  )}
                  onClick={() => setIsPanelOpen(true)}
                >
                  <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary font-semibold text-xs">
                    {item.rank}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn(
                      "text-sm font-medium truncate",
                      item.status === 'done' && "line-through"
                    )}>
                      {item.title}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {getCategoryDisplayLabel(item)}
                    </p>
                  </div>
                  {item.urgency.is_overdue && (
                    <Badge variant="destructive" className="text-xs shrink-0">
                      Overdue
                    </Badge>
                  )}
                </div>
              ))}
              
              {plan.plan_json.length > 3 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full mt-2"
                  onClick={() => setIsPanelOpen(true)}
                >
                  View all {plan.plan_json.length} items
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              )}
              
              {plan.plan_json.length <= 3 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full mt-2"
                  onClick={() => setIsPanelOpen(true)}
                >
                  View details
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
      
      <WeeklyFocusPlanPanel 
        open={isPanelOpen} 
        onOpenChange={setIsPanelOpen} 
      />
    </>
  );
}
