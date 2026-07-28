import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useUpdatePlanItemStatus } from '@/hooks/useWeeklyPlan';
import { getCategoryDisplayLabel, getUrgencyConfig } from '@/lib/categoryLabels';
import type { WeeklyPlanItem } from '@/types/weekly-plan';
import { FocusPlanItemCTA } from './FocusPlanItemCTA';
import { ChevronDown, ChevronUp, Check, X, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FocusPlanItemProps {
  item: WeeklyPlanItem;
  planId: string;
}

export function FocusPlanItem({ item, planId }: FocusPlanItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const updateStatus = useUpdatePlanItemStatus();
  
  const urgencyConfig = getUrgencyConfig(item);
  const categoryLabel = getCategoryDisplayLabel(item);
  const isDone = item.status === 'done';
  
  const handleMarkDone = async () => {
    await updateStatus.mutateAsync({
      planId,
      itemId: item.id,
      status: 'done',
    });
  };
  
  const handleDismiss = async () => {
    await updateStatus.mutateAsync({
      planId,
      itemId: item.id,
      status: 'dismissed',
    });
  };
  
  return (
    <Card data-tour="focus-plan-item" className={cn(
      "transition-all",
      isDone && "opacity-60 bg-muted/30"
    )}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {/* Rank Badge */}
          <div className={cn(
            "flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm shrink-0",
            isDone 
              ? "bg-success/20 text-success" 
              : "bg-primary/10 text-primary"
          )}>
            {isDone ? <Check className="w-4 h-4" /> : item.rank}
          </div>
          
          <div className="flex-1 min-w-0">
            {/* Header */}
            <div className="flex items-start justify-between gap-2 mb-1">
              <div className="min-w-0">
                <h4 className={cn(
                  "font-medium text-sm",
                  isDone && "line-through text-muted-foreground"
                )}>
                  {item.title}
                </h4>
                <div className="flex items-center gap-2 mt-0.5">
                  <Badge variant="secondary" className="text-xs">
                    {categoryLabel}
                  </Badge>
                  {urgencyConfig.label && (
                    <Badge 
                      variant={urgencyConfig.variant === 'destructive' ? 'destructive' : 'outline'}
                      className="text-xs"
                    >
                      {urgencyConfig.label}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            
            {/* Recommended Action */}
            <p className="text-sm text-muted-foreground mt-2">
              {item.recommended_action}
            </p>
            
            {/* Reasoning Quote */}
            {item.ai_reasoning && (
              <div className="flex items-start gap-2 mt-2 p-2 rounded bg-primary/5 border border-primary/10">
                <Sparkles className="w-3 h-3 text-primary shrink-0 mt-0.5" />
                <p className="text-xs text-muted-foreground italic">
                  "{item.ai_reasoning}"
                </p>
              </div>
            )}
            
            {/* Expandable Reasons */}
            {item.reasons.length > 0 && (
              <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
                <CollapsibleTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-auto p-0 mt-2 text-xs text-muted-foreground hover:text-foreground"
                  >
                    {isExpanded ? (
                      <>
                        <ChevronUp className="w-3 h-3 mr-1" />
                        Hide reasons
                      </>
                    ) : (
                      <>
                        <ChevronDown className="w-3 h-3 mr-1" />
                        {item.reasons.length} reason{item.reasons.length > 1 ? 's' : ''}
                      </>
                    )}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2">
                  <ul className="text-xs text-muted-foreground space-y-1 pl-4 list-disc">
                    {item.reasons.map((reason, idx) => (
                      <li key={idx}>{reason}</li>
                    ))}
                  </ul>
                </CollapsibleContent>
              </Collapsible>
            )}
            
            {/* Actions */}
            {!isDone && (
              <div className="flex items-center gap-2 mt-3">
                <FocusPlanItemCTA item={item} planId={planId} />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleMarkDone}
                  disabled={updateStatus.isPending}
                  className="gap-1"
                >
                  <Check className="w-3 h-3" />
                  Done
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDismiss}
                  disabled={updateStatus.isPending}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <X className="w-3 h-3" />
                </Button>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
