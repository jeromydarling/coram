import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, TrendingDown, Minus, Activity, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRelationshipMomentum, type MomentumDriver } from '@/hooks/useRelationshipMomentum';
import { formatDistanceToNow } from 'date-fns';

function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'rising') return <TrendingUp className="w-4 h-4 text-green-600 dark:text-green-400" />;
  if (trend === 'falling') return <TrendingDown className="w-4 h-4 text-destructive" />;
  return <Minus className="w-4 h-4 text-muted-foreground" />;
}

function trendLabel(trend: string) {
  if (trend === 'rising') return 'Rising';
  if (trend === 'falling') return 'Falling';
  return 'Stable';
}

function trendColor(trend: string) {
  if (trend === 'rising') return 'bg-green-500/15 text-green-700 dark:text-green-400';
  if (trend === 'falling') return 'bg-destructive/15 text-destructive';
  return 'bg-muted text-muted-foreground';
}

function scoreColor(score: number) {
  if (score >= 75) return 'text-green-600 dark:text-green-400';
  if (score >= 50) return 'text-warning';
  if (score >= 25) return 'text-orange-500';
  return 'text-muted-foreground';
}

function ScoreRing({ score }: { score: number }) {
  const circumference = 2 * Math.PI * 36;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  return (
    <div className="relative w-20 h-20">
      <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
        <circle cx="40" cy="40" r="36" stroke="currentColor" strokeWidth="6" fill="none" className="text-muted/30" />
        <circle
          cx="40" cy="40" r="36"
          stroke="currentColor"
          strokeWidth="6"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className={scoreColor(score)}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={cn('text-xl font-bold', scoreColor(score))}>{score}</span>
      </div>
    </div>
  );
}

function DriverRow({ driver }: { driver: MomentumDriver }) {
  return (
    <div className="flex items-start gap-2 text-sm py-1.5 border-b border-border/50 last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-foreground truncate">{driver.label}</p>
        {driver.evidence_snippet && (
          <p className="text-xs text-muted-foreground truncate mt-0.5">{driver.evidence_snippet}</p>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Badge variant="outline" className="text-[10px] px-1.5">{driver.weight.toFixed(1)}</Badge>
        {driver.evidence_url && (
          <a
            href={driver.evidence_url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-primary hover:text-primary/80"
          >
            <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>
    </div>
  );
}

export function MomentumCard({ organizationId }: { organizationId: string }) {
  const { data: momentum, isLoading } = useRelationshipMomentum(organizationId);
  // organizationId here is actually the opportunity_id passed from the parent
  const [showAllDrivers, setShowAllDrivers] = useState(false);

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="w-4 h-4 text-primary" />
            Relationship Momentum
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!momentum) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="w-4 h-4 text-primary" />
            Relationship Momentum
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No momentum data yet. Scores are computed automatically from signals, connections, and activity.</p>
        </CardContent>
      </Card>
    );
  }

  const topDrivers = showAllDrivers ? momentum.drivers : momentum.drivers.slice(0, 3);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="w-4 h-4 text-primary" />
            Relationship Momentum
          </CardTitle>
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(momentum.computed_at), { addSuffix: true })}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Score + Trend */}
        <div className="flex items-center gap-6">
          <ScoreRing score={momentum.score} />
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <TrendIcon trend={momentum.trend} />
              <Badge className={cn('text-xs', trendColor(momentum.trend))}>
                {trendLabel(momentum.trend)}
              </Badge>
            </div>
            {momentum.score_delta !== 0 && (
              <p className="text-sm text-muted-foreground">
                {momentum.score_delta > 0 ? '+' : ''}{momentum.score_delta} from last compute
              </p>
            )}
          </div>
        </div>

        {/* Drivers */}
        {topDrivers.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">Key Drivers</p>
            <div className="space-y-0">
              {topDrivers.map((d, i) => (
                <DriverRow key={i} driver={d} />
              ))}
            </div>
            {momentum.drivers.length > 3 && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full mt-2 text-xs"
                onClick={() => setShowAllDrivers(!showAllDrivers)}
              >
                {showAllDrivers ? (
                  <>
                    <ChevronUp className="w-3 h-3 mr-1" /> Show fewer
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-3 h-3 mr-1" /> Show all {momentum.drivers.length} drivers
                  </>
                )}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
