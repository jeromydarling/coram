import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useGrantMatches } from '@/hooks/useGrantMatches';
import { useUpdateGrant } from '@/hooks/useGrants';
import { Sparkles, Star, Link, ExternalLink, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/components/ui/sonner';

interface GrantSuggestionsPanelProps {
  opportunityId: string;
  onGrantLinked?: () => void;
}

export function GrantSuggestionsPanel({ opportunityId, onGrantLinked }: GrantSuggestionsPanelProps) {
  const { data, isLoading, error } = useGrantMatches(opportunityId);
  const updateGrant = useUpdateGrant();

  const handleLinkGrant = async (grantId: string, grantName: string) => {
    try {
      await updateGrant.mutateAsync({
        id: grantId,
        opportunity_id: opportunityId
      });
      toast.success(`Linked "${grantName}" to this opportunity`);
      onGrantLinked?.();
    } catch (error) {
      console.error('Failed to link grant:', error);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="w-4 h-4 text-primary" />
            Grant Suggestions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (error || !data?.suggestions?.length) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="w-4 h-4 text-primary" />
            Grant Suggestions
          </CardTitle>
          <CardDescription>
            Smart grant matching based on alignment
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            No matching grants found. Try updating the opportunity's grant alignment or mission snapshot.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="w-4 h-4 text-primary" />
          Suggested Grants
        </CardTitle>
        <CardDescription>
          Based on alignment and mission
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {data.suggestions.map((suggestion) => (
          <div 
            key={suggestion.id}
            className="p-3 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors space-y-2"
          >
            {/* Row 1: Name + Stars */}
            <div className="flex items-start justify-between gap-2">
              <span className="font-medium text-sm leading-snug break-words min-w-0">{suggestion.grant_name}</span>
              <div className="flex items-center gap-0.5 text-warning shrink-0">
                {Array.from({ length: suggestion.star_rating }).map((_, i) => (
                  <Star key={i} className="w-3 h-3 fill-current" />
                ))}
              </div>
            </div>

            {/* Row 2: Metadata */}
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
              <span>{suggestion.funder_name}</span>
              <span>•</span>
              <span>{suggestion.stage}</span>
              {suggestion.metro && (
                <>
                  <span>•</span>
                  <span>{suggestion.metro}</span>
                </>
              )}
            </div>

            {/* Row 3: Match reasons */}
            <div className="flex flex-wrap gap-1">
              {suggestion.match_reasons.slice(0, 2).map((reason, i) => (
                <Badge key={i} variant="secondary" className="text-xs py-0">
                  {reason}
                </Badge>
              ))}
            </div>

            {/* Row 4: Score + Link */}
            <div className="flex items-center justify-between pt-1">
              <Badge 
                variant="outline" 
                className={cn(
                  "text-xs",
                  suggestion.match_score >= 60 && "bg-success/10 text-success border-success/30",
                  suggestion.match_score >= 40 && suggestion.match_score < 60 && "bg-warning/10 text-warning border-warning/30"
                )}
              >
                {suggestion.match_score}% match
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleLinkGrant(suggestion.id, suggestion.grant_name)}
                disabled={updateGrant.isPending}
                className="gap-1 h-7 text-xs"
              >
                <Link className="w-3 h-3" />
                Link
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
