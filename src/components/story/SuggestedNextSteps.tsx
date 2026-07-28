import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Lightbulb, Check, X, Calendar, Loader2 } from 'lucide-react';
import { useEmailTaskSuggestions, useAcceptSuggestion, useDismissSuggestion } from '@/hooks/useEmailTaskSuggestions';
import { Skeleton } from '@/components/ui/skeleton';

interface SuggestedNextStepsProps {
  opportunityId: string;
}

export function SuggestedNextSteps({ opportunityId }: SuggestedNextStepsProps) {
  const { data: suggestions = [], isLoading } = useEmailTaskSuggestions(opportunityId);
  const accept = useAcceptSuggestion();
  const dismiss = useDismissSuggestion();

  if (isLoading) {
    return (
      <Card className="border-border/40">
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-12 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (suggestions.length === 0) return null;

  return (
    <Card className="border-border/40">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Lightbulb className="w-4 h-4 text-warning" />
          Suggested Next Steps
          <span className="text-xs font-normal text-muted-foreground">(from your emails)</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {suggestions.slice(0, 5).map(s => (
          <SuggestionRow
            key={s.id}
            suggestion={s}
            onAccept={() => accept.mutate(s.id)}
            onDismiss={() => dismiss.mutate(s.id)}
            isAccepting={accept.isPending}
            isDismissing={dismiss.isPending}
          />
        ))}
        {suggestions.length > 5 && (
          <p className="text-xs text-muted-foreground text-center pt-1">
            +{suggestions.length - 5} more suggestions
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function SuggestionRow({
  suggestion,
  onAccept,
  onDismiss,
  isAccepting,
  isDismissing,
}: {
  suggestion: { id: string; suggested_title: string; suggested_due_date: string | null; confidence: number | null; extracted_spans: Array<{ excerpt?: string }> };
  onAccept: () => void;
  onDismiss: () => void;
  isAccepting: boolean;
  isDismissing: boolean;
}) {
  const excerpt = suggestion.extracted_spans?.[0]?.excerpt;

  return (
    <div className="flex items-start gap-3 p-2.5 rounded-lg bg-muted/30 border border-border/30">
      <div className="flex-1 min-w-0 space-y-0.5">
        <p className="text-sm font-medium text-foreground truncate">{suggestion.suggested_title}</p>
        {excerpt && (
          <p className="text-xs text-muted-foreground line-clamp-1">{excerpt.slice(0, 140)}</p>
        )}
        <div className="flex items-center gap-2">
          {suggestion.suggested_due_date && (
            <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
              <Calendar className="w-3 h-3" />
              {suggestion.suggested_due_date}
            </span>
          )}
          {suggestion.confidence != null && (
            <Badge variant="secondary" className="text-[9px] px-1.5 py-0">
              {Math.round(suggestion.confidence * 100)}%
            </Badge>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <Button
          size="sm"
          variant="ghost"
          className="h-7 w-7 p-0 text-success hover:text-success hover:bg-success/10"
          onClick={onAccept}
          disabled={isAccepting || isDismissing}
          title="Create task"
        >
          {isAccepting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
          onClick={onDismiss}
          disabled={isAccepting || isDismissing}
          title="Dismiss"
        >
          {isDismissing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
        </Button>
      </div>
    </div>
  );
}
