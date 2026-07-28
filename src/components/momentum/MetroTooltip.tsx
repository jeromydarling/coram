import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { MetroMomentum } from '@/hooks/useMomentumData';
import { Anchor, Calendar, Package, Star } from 'lucide-react';

interface MetroTooltipProps {
  metro: MetroMomentum;
}

const statusColors: Record<MetroMomentum['momentumStatus'], string> = {
  Resting: 'bg-[#4ECDC4] text-slate-900',
  Steady: 'bg-[#F5C6A5] text-slate-900',
  Growing: 'bg-[#FFD93D] text-slate-900',
  Strong: 'bg-[#FFB627] text-slate-900',
};

export function MetroTooltip({ metro }: MetroTooltipProps) {
  return (
    <div className="bg-card border rounded-lg shadow-xl p-3 min-w-[180px] max-w-[240px]">
      <div className="flex items-center justify-between gap-2 mb-2">
        <h4 className="font-semibold text-sm truncate">{metro.metroName}</h4>
        <Badge className={cn('text-xs', statusColors[metro.momentumStatus])}>
          {metro.momentumStatus}
        </Badge>
      </div>

      {metro.hasMilestone && (
        <div className="flex items-center gap-1.5 text-xs text-amber-500 mb-2">
          <Star className="w-3 h-3 fill-amber-500" />
          <span>First anchor achieved!</span>
        </div>
      )}

      <div className="space-y-1.5 text-xs">
        <div className="flex items-center justify-between text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Anchor className="w-3 h-3" />
            Anchors (90d)
          </span>
          <span className="font-medium text-foreground">{metro.anchors90d}</span>
        </div>
        <div className="flex items-center justify-between text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Calendar className="w-3 h-3" />
            Events (Qtr)
          </span>
          <span className="font-medium text-foreground">{metro.eventsThisQuarter}</span>
        </div>
        <div className="flex items-center justify-between text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Package className="w-3 h-3" />
            Orders (30d)
          </span>
          <span className="font-medium text-foreground">{metro.orders30d}</span>
        </div>
      </div>
    </div>
  );
}
