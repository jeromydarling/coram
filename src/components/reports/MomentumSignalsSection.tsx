import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Activity, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { MomentumSignalData } from '@/hooks/useHumanImpactData';

interface MomentumSignalsSectionProps {
  data: MomentumSignalData;
}

const trendIcons: Record<string, typeof TrendingUp> = {
  rising: TrendingUp,
  falling: TrendingDown,
  stable: Minus,
};

const trendColors: Record<string, string> = {
  rising: 'text-green-600 dark:text-green-400',
  falling: 'text-amber-500',
  stable: 'text-muted-foreground',
};

export function MomentumSignalsSection({ data }: MomentumSignalsSectionProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Activity className="w-5 h-5 text-primary" />
          Momentum & Signals
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          A gentle read on where energy is flowing
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Trend overview */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-green-500/5 rounded-lg p-3 text-center">
            <TrendingUp className="w-4 h-4 text-green-600 dark:text-green-400 mx-auto mb-1" />
            <div className="text-xl font-bold">{data.risingCount}</div>
            <div className="text-[11px] text-muted-foreground">Rising</div>
          </div>
          <div className="bg-muted/30 rounded-lg p-3 text-center">
            <Minus className="w-4 h-4 text-muted-foreground mx-auto mb-1" />
            <div className="text-xl font-bold">{data.stableCount}</div>
            <div className="text-[11px] text-muted-foreground">Steady</div>
          </div>
          <div className="bg-amber-500/5 rounded-lg p-3 text-center">
            <TrendingDown className="w-4 h-4 text-amber-500 mx-auto mb-1" />
            <div className="text-xl font-bold">{data.fallingCount}</div>
            <div className="text-[11px] text-muted-foreground">Quieter</div>
          </div>
        </div>

        {/* Signal cards */}
        {data.topSignals.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground">Top Signals</h4>
            <div className="space-y-1.5">
              {data.topSignals.map((signal, i) => {
                const Icon = trendIcons[signal.trend] || Minus;
                const color = trendColors[signal.trend] || 'text-muted-foreground';
                return (
                  <div key={i} className="flex items-center justify-between p-2 rounded-md bg-muted/20">
                    <div className="flex items-center gap-2 min-w-0">
                      <Icon className={`w-3.5 h-3.5 shrink-0 ${color}`} />
                      <span className="text-sm truncate">{signal.orgName}</span>
                    </div>
                    <Badge variant="outline" className="text-xs shrink-0 ml-2">
                      {signal.score}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {data.topSignals.length === 0 && (
          <p className="text-sm text-muted-foreground/60 italic text-center py-4">
            Momentum signals will appear as relationship activity builds.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
