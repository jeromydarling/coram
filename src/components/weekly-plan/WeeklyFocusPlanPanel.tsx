import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useWeeklyPlan, useGenerateWeeklyPlan, useEventWeekContext } from '@/hooks/useWeeklyPlan';
import { getWeekDisplayRange, getWeekStartDate, getWeekMode } from '@/lib/weekDate';
import { FocusPlanItem } from './FocusPlanItem';
import { RefreshCw, Target, CheckCircle2, Focus, Eye, Calendar } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface WeeklyFocusPlanPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function WeeklyFocusPlanPanel({ open, onOpenChange }: WeeklyFocusPlanPanelProps) {
  const { data: plan, isLoading } = useWeeklyPlan();
  const generatePlan = useGenerateWeeklyPlan();
  const { data: eventWeekContext } = useEventWeekContext();
  const weekStartDate = getWeekStartDate();
  const weekMode = getWeekMode();
  const [showRegenConfirm, setShowRegenConfirm] = useState(false);
  
  const items = plan?.plan_json || [];
  const doneCount = items.filter(i => i.status === 'done').length;
  const totalCount = items.filter(i => i.status !== 'dismissed').length;
  const progressPercent = totalCount > 0 ? (doneCount / totalCount) * 100 : 0;
  
  const handleRegenerate = async () => {
    setShowRegenConfirm(false);
    await generatePlan.mutateAsync();
  };
  
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-hidden flex flex-col">
        <SheetHeader className="shrink-0">
          <div className="flex items-center justify-between">
            <SheetTitle className="flex items-center gap-2">
              <Target className="w-5 h-5 text-primary" />
              Weekly Focus Plan
            </SheetTitle>
            <Badge 
              variant={weekMode === 'focus' ? 'default' : 'secondary'}
              className="gap-1"
            >
              {weekMode === 'focus' ? (
                <>
                  <Focus className="w-3 h-3" />
                  Focus Mode
                </>
              ) : (
                <>
                  <Eye className="w-3 h-3" />
                  Review Mode
                </>
              )}
            </Badge>
          </div>
          <SheetDescription>
            {getWeekDisplayRange(weekStartDate)}
          </SheetDescription>
          
          {/* Event Week Indicator */}
          {eventWeekContext?.isEventWeek && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 rounded-full text-sm mt-2">
              <Calendar className="w-4 h-4 text-primary" />
              <span className="text-primary font-medium">Event Week</span>
              {eventWeekContext.conferenceNames.length > 0 && (
                <span className="text-muted-foreground text-xs truncate max-w-[200px]">
                  {eventWeekContext.conferenceNames.join(', ')}
                </span>
              )}
            </div>
          )}
        </SheetHeader>
        
        <div className="shrink-0 py-4 space-y-3 border-b">
          {/* Progress */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-medium flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4 text-success" />
                {doneCount} of {totalCount} completed
              </span>
            </div>
            <Progress value={progressPercent} className="h-2" />
          </div>
          
          {/* Regenerate button */}
          <AlertDialog open={showRegenConfirm} onOpenChange={setShowRegenConfirm}>
            <AlertDialogTrigger asChild>
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full gap-2"
                disabled={generatePlan.isPending}
              >
                {generatePlan.isPending ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                Regenerate Plan
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Regenerate Focus Plan?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will replace your current plan with a fresh analysis. 
                  All progress on current items will be reset.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleRegenerate}>
                  Regenerate
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
        
        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-3 py-4">
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                Loading plan...
              </div>
            ) : items.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Target className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No focus items for this week.</p>
                <p className="text-sm">Click "Regenerate Plan" to create one.</p>
              </div>
            ) : (
              items
                .filter(item => item.status !== 'dismissed')
                .sort((a, b) => a.rank - b.rank)
                .map((item) => (
                  <FocusPlanItem 
                    key={item.id} 
                    item={item} 
                    planId={plan!.id}
                  />
                ))
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
