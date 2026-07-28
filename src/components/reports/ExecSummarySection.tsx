import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Heart, Users, Calendar, Package, TrendingUp, TrendingDown, Minus, HandHeart } from 'lucide-react';
import type { ExecSummaryData } from '@/hooks/useHumanImpactData';
import { useProvisionMode } from '@/hooks/useProvisionMode';

interface ExecSummarySectionProps {
  data: ExecSummaryData;
}

const trendConfig = {
  rising: { icon: TrendingUp, label: 'Momentum building', className: 'text-green-600 dark:text-green-400' },
  steady: { icon: Minus, label: 'Holding steady', className: 'text-muted-foreground' },
  declining: { icon: TrendingDown, label: 'Quieter period', className: 'text-amber-500' },
};

const provisionLabel: Record<string, string> = {
  care: 'Care Provided',
  stewardship: 'Items Shared',
  enterprise: 'Items Delivered',
};

export function ExecSummarySection({ data }: ExecSummarySectionProps) {
  const trend = trendConfig[data.momentumTrend];
  const TrendIcon = trend.icon;
  const { mode } = useProvisionMode();
  const supportLabel = provisionLabel[mode] || 'Support Delivered';

  return (
    <Card className="border-primary/10 bg-gradient-to-br from-background to-primary/[0.02]">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Heart className="w-5 h-5 text-primary" />
          What We Made Possible
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Narrative */}
        <p className="text-sm text-foreground/80 leading-relaxed">
          {data.narrativeSummary}
        </p>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-muted/30 rounded-lg p-3 text-center">
            <Users className="w-4 h-4 text-primary mx-auto mb-1" />
            <div className="text-2xl font-bold">{data.partnersActive}</div>
            <div className="text-[11px] text-muted-foreground">Active Partners</div>
          </div>
          <div className="bg-muted/30 rounded-lg p-3 text-center">
            <HandHeart className="w-4 h-4 text-primary mx-auto mb-1" />
            <div className="text-2xl font-bold">{data.careProvided.toLocaleString()}</div>
            <div className="text-[11px] text-muted-foreground">{supportLabel}</div>
          </div>
          <div className="bg-muted/30 rounded-lg p-3 text-center">
            <Calendar className="w-4 h-4 text-primary mx-auto mb-1" />
            <div className="text-2xl font-bold">{data.eventsAttended}</div>
            <div className="text-[11px] text-muted-foreground">Events Attended</div>
          </div>
          <div className="bg-muted/30 rounded-lg p-3 text-center">
            <Heart className="w-4 h-4 text-primary mx-auto mb-1" />
            <div className="text-2xl font-bold">{data.newRelationships}</div>
            <div className="text-[11px] text-muted-foreground">New Relationships</div>
          </div>
        </div>

        {/* Trend badge */}
        <div className="flex items-center gap-2">
          <TrendIcon className={`w-4 h-4 ${trend.className}`} />
          <span className={`text-sm ${trend.className}`}>{trend.label}</span>
        </div>
      </CardContent>
    </Card>
  );
}
