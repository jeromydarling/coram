import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import type { MetroMomentum } from '@/hooks/useMomentumData';
import type { MetroStoryData } from '@/hooks/useStoryMomentum';
import { StoryDetailSections } from './StoryDetailSections';

import { Anchor, Calendar, Package, Star, MapPin, TrendingUp } from 'lucide-react';
import { format } from 'date-fns';

interface MetroDetailPanelProps {
  metro: MetroMomentum | null;
  onClose: () => void;
  storyData?: MetroStoryData;
  storyLoading?: boolean;
}

const statusColors: Record<MetroMomentum['momentumStatus'], string> = {
  Resting: 'bg-[#4ECDC4] text-slate-900',
  Steady: 'bg-[#F5C6A5] text-slate-900',
  Growing: 'bg-[#FFD93D] text-slate-900',
  Strong: 'bg-[#FFB627] text-slate-900',
};

const statusDescriptions: Record<MetroMomentum['momentumStatus'], string> = {
  Resting: 'Building a foundation for future growth',
  Steady: 'Maintaining consistent activity levels',
  Growing: 'Momentum is building — great progress!',
  Strong: 'Exceptional activity — keep it up!',
};

export function MetroDetailPanel({ metro, onClose, storyData, storyLoading }: MetroDetailPanelProps) {
  if (!metro) return null;

  return (
    <Sheet open={!!metro} onOpenChange={() => onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-md p-0">
        <div className="flex flex-col h-full">
          {/* Header */}
          <SheetHeader className="px-6 py-4 border-b bg-muted/30">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-muted-foreground" />
                  <SheetTitle className="text-lg">{metro.metroName}</SheetTitle>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={cn(statusColors[metro.momentumStatus])}>
                    {metro.momentumStatus}
                  </Badge>
                  {storyData && (
                    <span className="text-xs text-muted-foreground capitalize">
                      Story is {storyData.densityLabel}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </SheetHeader>

          <ScrollArea className="flex-1">
            <div className="p-6 space-y-6">
              {/* Momentum Status */}
              <div className="space-y-2">
                <h3 className="text-sm font-medium flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" />
                  Momentum Status
                </h3>
                <p className="text-sm text-muted-foreground">
                  {statusDescriptions[metro.momentumStatus]}
                </p>
              </div>

              {/* Milestone */}
              {metro.hasMilestone && (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                    <Star className="w-5 h-5 fill-current" />
                    <span className="font-medium">First Anchor Achieved!</span>
                  </div>
                  {metro.milestoneAchievedAt && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {format(new Date(metro.milestoneAchievedAt), 'MMMM d, yyyy')}
                    </p>
                  )}
                </div>
              )}

              {/* Activity Summary */}
              <div className="space-y-3">
                <h3 className="text-sm font-medium">Recent Activity</h3>
                
                <div className="grid gap-3">
                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <Anchor className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">Anchors</p>
                        <p className="text-xs text-muted-foreground">Last 90 days</p>
                      </div>
                    </div>
                    <span className="text-2xl font-bold">{metro.anchors90d}</span>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <Calendar className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">Events Attended</p>
                        <p className="text-xs text-muted-foreground">This quarter</p>
                      </div>
                    </div>
                    <span className="text-2xl font-bold">{metro.eventsThisQuarter}</span>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <Package className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">Orders</p>
                        <p className="text-xs text-muted-foreground">Last 30 days</p>
                      </div>
                    </div>
                    <span className="text-2xl font-bold">{metro.orders30d}</span>
                  </div>
                </div>
              </div>

              {/* Story Layer Sections — only if story data available */}
              {(storyData || storyLoading) && (
                <>
                  <Separator />
                  <StoryDetailSections
                    storyData={storyData ?? null}
                    isLoading={!!storyLoading}
                    metroName={metro.metroName}
                  />
                </>
              )}


              {/* Encouragement */}
              <div className="bg-gradient-to-br from-primary/5 to-primary/10 rounded-lg p-4 text-center">
                <p className="text-sm text-muted-foreground">
                  {metro.momentumStatus === 'Strong' && "🎉 This metro is on fire! Amazing work."}
                  {metro.momentumStatus === 'Growing' && "📈 Momentum is building. Keep it up!"}
                  {metro.momentumStatus === 'Steady' && "💪 Consistent effort matters. You're doing great."}
                  {metro.momentumStatus === 'Resting' && "🌱 Every journey starts with a single step. The foundation is being built."}
                </p>
              </div>

              {/* Data freshness */}
              <p className="text-xs text-muted-foreground text-center">
                Data as of {format(new Date(metro.computedAt), 'MMM d, h:mm a')}
              </p>
            </div>
          </ScrollArea>
        </div>
      </SheetContent>
    </Sheet>
  );
}
