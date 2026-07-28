import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, MapPin, RefreshCw, ExternalLink, ChevronDown, ChevronUp, Globe, Lock } from 'lucide-react';
import { useNeighborhoodInsight, useGenerateNeighborhoodInsight } from '@/hooks/useNeighborhoodInsights';
import { DeepInsightBadge } from '@/components/ai/DeepInsightBadge';
import { useOrgKnowledge } from '@/hooks/useOrgKnowledge';
import { formatDistanceToNow, isPast } from 'date-fns';
import { NeighborhoodInsightDetails } from './NeighborhoodInsightDetails';

interface NeighborhoodInsightsCardProps {
  orgId: string;
  hasLocation?: boolean;
}

export function NeighborhoodInsightsCard({ orgId, hasLocation: hasLocationProp = true }: NeighborhoodInsightsCardProps) {
  const { data: insight, isLoading } = useNeighborhoodInsight(orgId);
  const { data: orgKnowledgeData, isLoading: orgKnowledgeLoading } = useOrgKnowledge(orgId);
  const generateMutation = useGenerateNeighborhoodInsight();
  const [expanded, setExpanded] = useState(false);

  const hasOrgKnowledge = !!orgKnowledgeData?.snapshot;

  // Also check org knowledge snapshot headquarters as fallback for location
  const hq = orgKnowledgeData?.snapshot?.structured_json?.headquarters;
  const hasLocationFromKnowledge = !!(hq?.zip || (hq?.city && hq?.state));
  const hasLocation = hasLocationProp || hasLocationFromKnowledge;

  const isStale = insight ? isPast(new Date(insight.fresh_until)) : false;
  const freshDays = insight
    ? Math.max(0, Math.ceil((new Date(insight.fresh_until).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0;

  const handleGenerate = (force = false) => {
    generateMutation.mutate({ orgId, force });
  };

  // Gate: org knowledge must exist before neighborhood insights are available
  if (!hasOrgKnowledge && !orgKnowledgeLoading) {
    return (
      <Card className="opacity-75">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <MapPin className="w-4 h-4 text-muted-foreground" />
            Neighborhood Insights
            <Lock className="w-3.5 h-3.5 text-muted-foreground" />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Organization Knowledge must be generated first. Once available, neighborhood insights will use it to provide community context.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Gate: location data required
  if (!hasLocation) {
    return (
      <Card className="opacity-75">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <MapPin className="w-4 h-4 text-muted-foreground" />
            Neighborhood Insights
            <Lock className="w-3.5 h-3.5 text-muted-foreground" />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            This organization needs at least a zip code or city and state to generate neighborhood insights. Edit the organization to add location data.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading || orgKnowledgeLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <MapPin className="w-4 h-4 text-primary" />
            Neighborhood Insights
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading…
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!insight) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <MapPin className="w-4 h-4 text-primary" />
            Neighborhood Insights
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-3">
            No insights generated yet. Generate to see community context, trends, and opportunities informed by organization knowledge.
          </p>
          <Button
            size="sm"
            onClick={() => handleGenerate()}
            disabled={generateMutation.isPending}
          >
            {generateMutation.isPending ? (
              <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Generating…</>
            ) : (
              <><Globe className="w-4 h-4 mr-1" /> Generate Insights</>
            )}
          </Button>
          <DeepInsightBadge className="mt-2" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <MapPin className="w-4 h-4 text-primary" />
            Neighborhood Insights
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant={isStale ? 'destructive' : 'secondary'} className="text-xs">
              {isStale ? 'Stale' : `${freshDays}d fresh`}
            </Badge>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => handleGenerate(true)}
              disabled={generateMutation.isPending}
              title="Refresh insights"
            >
              {generateMutation.isPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5" />
              )}
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
          <span>📍 {insight.location_key}</span>
          {insight.state_fips && <span>• FIPS {insight.state_fips}</span>}
          <span>• Generated {formatDistanceToNow(new Date(insight.generated_at))} ago</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-sm whitespace-pre-line leading-relaxed">
          {insight.summary}
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setExpanded(!expanded)}
          className="w-full justify-between text-muted-foreground"
        >
          <span>{expanded ? 'Show less' : 'Show details'}</span>
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </Button>

        {expanded && <NeighborhoodInsightDetails insights={insight.insights_json} />}
      </CardContent>
    </Card>
  );
}
