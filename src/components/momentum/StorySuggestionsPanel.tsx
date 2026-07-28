import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { MessageCircle, Calendar, Feather, Check, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTenantPath } from '@/hooks/useTenantPath';
import { useStorySuggestions, useUpdateStorySuggestion, type StorySuggestion } from '@/hooks/useStorySuggestions';
import { formatDistanceToNow } from 'date-fns';

interface StorySuggestionsPanelProps {
  metroId: string;
  metroName: string;
}

const typeConfig: Record<StorySuggestion['suggestion_type'], { icon: typeof MessageCircle; label: string; action: string }> = {
  check_in: { icon: MessageCircle, label: 'Check In', action: 'Send a note' },
  event_connect: { icon: Calendar, label: 'Event Connect', action: 'Explore event' },
  reflection_prompt: { icon: Feather, label: 'Reflect', action: 'Add reflection' },
};

export function StorySuggestionsPanel({ metroId, metroName }: StorySuggestionsPanelProps) {
  const navigate = useNavigate();
  const { tenantPath } = useTenantPath();
  const { data: suggestions } = useStorySuggestions([metroId]);
  const updateSuggestion = useUpdateStorySuggestion();

  const metroSuggestions = (suggestions || []).filter(s => s.metro_id === metroId).slice(0, 3);

  if (metroSuggestions.length === 0) return null;

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium flex items-center gap-2">
        <MessageCircle className="w-4 h-4 text-primary" />
        Story Threads
      </h4>
      <p className="text-xs text-muted-foreground">
        Gentle nudges from the narrative — no urgency, just awareness.
      </p>
      <div className="space-y-2">
        {metroSuggestions.map(suggestion => {
          const config = typeConfig[suggestion.suggestion_type];
          const Icon = config.icon;
          return (
            <div
              key={suggestion.id}
              className="flex items-start gap-2 p-3 rounded-lg border border-border/50 bg-muted/20"
            >
              <Icon className="w-4 h-4 text-primary mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px] h-4 px-1">
                    {config.label}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground">
                    {formatDistanceToNow(new Date(suggestion.created_at), { addSuffix: true })}
                  </span>
                </div>
                <p className="text-sm text-foreground/80">{suggestion.summary}</p>
                <div className="flex items-center gap-1 pt-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[10px] gap-1"
                    disabled={updateSuggestion.isPending}
                    onClick={() => {
                      updateSuggestion.mutate({ id: suggestion.id, status: 'acted' });
                      if (suggestion.suggestion_type === 'check_in') {
                        navigate(tenantPath('/opportunities'));
                      } else if (suggestion.suggestion_type === 'reflection_prompt') {
                        navigate(tenantPath('/metros/narratives'));
                      }
                    }}
                  >
                    <Check className="w-2.5 h-2.5" />
                    {config.action}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[10px] gap-1 text-muted-foreground"
                    disabled={updateSuggestion.isPending}
                    onClick={() => updateSuggestion.mutate({ id: suggestion.id, status: 'dismissed' })}
                  >
                    <X className="w-2.5 h-2.5" />
                    Dismiss
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
