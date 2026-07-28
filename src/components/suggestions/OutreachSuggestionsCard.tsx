import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Mail, X, Clock, Sparkles } from 'lucide-react';
import { useOrgCampaignSuggestions, useSuggestionAction } from '@/hooks/useCampaignSuggestions';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { SuggestionDecisionBadge } from '@/components/insights/SuggestionDecisionBadge';

interface Props {
  orgId: string;
}

export function OutreachSuggestionsCard({ orgId }: Props) {
  const { data: suggestions, isLoading } = useOrgCampaignSuggestions(orgId);
  const action = useSuggestionAction();
  const { hasAnyRole } = useAuth();
  const navigate = useNavigate();

  const canAct = hasAnyRole(['admin', 'leadership', 'regional_lead', 'staff']);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-6">
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!suggestions?.length) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          Outreach Suggestions
          <Badge variant="secondary" className="ml-auto text-xs">{suggestions.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {suggestions.map((s) => (
          <div key={s.id} className="border rounded-lg p-3 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{s.title}</p>
                <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{s.reason}</p>
              </div>
              <Badge variant="outline" className="text-xs shrink-0">
                {Math.round(s.confidence * 100)}%
              </Badge>
              <SuggestionDecisionBadge suggestionId={s.id} />
            </div>
            <div className="text-xs text-muted-foreground">
              {format(parseISO(s.created_at), 'MMM d, yyyy')}
            </div>
            {canAct && (
              <div className="flex gap-1.5 pt-1">
                <Button
                  size="sm"
                  variant="default"
                  className="h-7 text-xs gap-1"
                  disabled={action.isPending}
                  onClick={async () => {
                    const result = await action.mutateAsync({
                      suggestion_id: s.id,
                      action: 'convert',
                    });
                    if (result?.campaign_id) {
                      navigate(`/outreach/campaigns/${result.campaign_id}`);
                    }
                  }}
                >
                  <Mail className="w-3 h-3" />
                  Create Draft
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs gap-1"
                  disabled={action.isPending}
                  onClick={() => action.mutate({ suggestion_id: s.id, action: 'snooze', days: 7 })}
                >
                  <Clock className="w-3 h-3" />
                  Snooze
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs gap-1 text-muted-foreground"
                  disabled={action.isPending}
                  onClick={() => action.mutate({ suggestion_id: s.id, action: 'dismiss' })}
                >
                  <X className="w-3 h-3" />
                </Button>
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
