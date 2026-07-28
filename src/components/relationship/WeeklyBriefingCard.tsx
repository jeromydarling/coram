import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { BookOpen, ExternalLink, Calendar, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMetroBriefings, useOpportunityBriefings, type RelationshipBriefing } from '@/hooks/useRelationshipBriefings';

function BriefingContent({ briefing }: { briefing: RelationshipBriefing }) {
  const json = briefing.briefing_json;
  const topMoves = json?.top_moves || [];
  const upcoming = json?.upcoming_soon || [];
  const metrics = json?.metrics || {};

  return (
    <div className="space-y-4">
      {/* Headline */}
      {json?.headline && (
        <p className="text-sm font-medium text-foreground">{json.headline}</p>
      )}

      {/* Metrics */}
      <div className="flex gap-3">
        {metrics.open_actions != null && (
          <Badge variant="secondary" className="text-xs">
            {metrics.open_actions} actions
          </Badge>
        )}
        {metrics.high_priority != null && metrics.high_priority > 0 && (
          <Badge className="text-xs bg-destructive/15 text-destructive">
            {metrics.high_priority} high priority
          </Badge>
        )}
      </div>

      {/* Happening Soon */}
      {upcoming.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs font-medium text-warning">
            <AlertTriangle className="w-3 h-3" />
            Happening Soon
          </div>
          {upcoming.map((item, i) => (
            <div key={i} className="flex items-start gap-2 pl-4 text-xs">
              <Calendar className="w-3 h-3 mt-0.5 text-muted-foreground shrink-0" />
              <div>
                <span className="font-medium">{item.title}</span>
                {item.date && <span className="text-muted-foreground"> ({item.date})</span>}
                {item.why_it_matters && (
                  <p className="text-muted-foreground">{item.why_it_matters}</p>
                )}
                {item.url && (
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline inline-flex items-center gap-0.5"
                  >
                    <ExternalLink className="w-2.5 h-2.5" /> Link
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Top Moves */}
      {topMoves.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-xs font-medium text-muted-foreground">Top Moves</div>
          {topMoves.slice(0, 5).map((move, i) => (
            <div key={i} className="flex items-start gap-2 pl-4 text-xs">
              <span className="text-primary font-bold mt-0.5">{i + 1}.</span>
              <div>
                <span className="font-medium">{move.title}</span>
                {move.when && <span className="text-muted-foreground"> — {move.when}</span>}
                <p className="text-muted-foreground">{move.why}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface WeeklyBriefingCardProps {
  scope: 'metro' | 'opportunity';
  metroId?: string;
  opportunityId?: string;
}

export function WeeklyBriefingCard({ scope, metroId, opportunityId }: WeeklyBriefingCardProps) {
  const metroQuery = useMetroBriefings(scope === 'metro' ? metroId : undefined);
  const oppQuery = useOpportunityBriefings(scope === 'opportunity' ? opportunityId : undefined);

  const query = scope === 'metro' ? metroQuery : oppQuery;
  const { data: briefings, isLoading } = query;

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <BookOpen className="w-4 h-4 text-primary" /> This Week
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!briefings || briefings.length === 0) return null;

  const latest = briefings[0];

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <BookOpen className="w-4 h-4 text-primary" />
            This Week
          </CardTitle>
          <span className="text-xs text-muted-foreground">
            {latest.week_start} — {latest.week_end}
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <BriefingContent briefing={latest} />
      </CardContent>
    </Card>
  );
}
