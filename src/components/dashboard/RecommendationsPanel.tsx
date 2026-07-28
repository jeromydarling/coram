import { useTranslation } from 'react-i18next';
import { Lightbulb, ExternalLink, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useRecommendations, type Recommendation } from '@/hooks/useRecommendations';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { HelpTooltip } from '@/components/ui/help-tooltip';

interface RecommendationsPanelProps {
  metroId?: string | null;
}

function getPriorityVariant(priority: string | null): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (priority) {
    case 'high': return 'destructive';
    case 'medium': return 'default';
    case 'low': return 'secondary';
    default: return 'outline';
  }
}

function getPriorityLabel(priority: string | null, t: (key: string) => string): string {
  if (!priority) return t('nextBestActions.medium');
  return priority.charAt(0).toUpperCase() + priority.slice(1);
}

function RecommendationItem({ rec }: { rec: Recommendation }) {
  const { t } = useTranslation('dashboard');
  const navigate = useNavigate();
  const opportunityId = (rec.metadata as Record<string, unknown>)?.opportunity_id as string | undefined;

  return (
    <div className="border border-border rounded-lg p-4 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <h4 className="text-sm font-semibold text-foreground leading-tight flex-1">
          {rec.title}
        </h4>
        <Badge variant={getPriorityVariant(rec.priority)} className="text-xs shrink-0">
          {getPriorityLabel(rec.priority, t)}
        </Badge>
      </div>

      {rec.body && (
        <p className="text-sm text-muted-foreground leading-relaxed">
          {rec.body}
        </p>
      )}

      <div className="flex items-center gap-3 pt-1">
        <span className="text-xs text-muted-foreground">
          {formatDistanceToNow(new Date(rec.updated_at), { addSuffix: true })}
        </span>
        {rec.recommendation_type && rec.recommendation_type !== 'general' && (
          <Badge variant="outline" className="text-xs">
            {rec.recommendation_type.replace(/_/g, ' ')}
          </Badge>
        )}
        {opportunityId && (
          <button
            onClick={() => navigate(`/opportunities/${opportunityId}`)}
            className="text-xs text-primary hover:underline flex items-center gap-1"
          >
            <ExternalLink className="w-3 h-3" />
            {t('recommendations.viewOpportunity')}
          </button>
        )}
      </div>
    </div>
  );
}

export function RecommendationsPanel({ metroId }: RecommendationsPanelProps) {
  const { t } = useTranslation('dashboard');
  const { data: recommendations, isLoading } = useRecommendations(metroId);

  // Don't render the panel at all if there are no recommendations and not loading
  if (!isLoading && (!recommendations || recommendations.length === 0)) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Lightbulb className="w-5 h-5 text-warning" />
          {t('recommendations.title')}
          <HelpTooltip contentKey="card.recommendations" />
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-3">
            {recommendations?.map((rec) => (
              <RecommendationItem key={rec.id} rec={rec} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
