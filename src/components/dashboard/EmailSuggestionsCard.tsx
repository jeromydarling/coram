/**
 * Relationship Signals — Suggested follow-ups from your sent emails.
 *
 * WHAT: Surfaces NRI-detected action items from email conversations with partners.
 * WHERE: Mission Rhythm dashboard, gated to steward/shepherd/companion lenses.
 * WHY: Helps stewards stay present with the humans they're caring for — without manual tracking.
 */

import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { HelpTooltip } from '@/components/ui/help-tooltip';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Mail, Check, X, Calendar, Loader2, ChevronRight } from 'lucide-react';
import { useDashboardEmailSuggestions, type DashboardEmailSuggestion } from '@/hooks/useDashboardEmailSuggestions';
import { useAcceptSuggestion, useDismissSuggestion } from '@/hooks/useEmailTaskSuggestions';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';

function SuggestionRow({ item }: { item: DashboardEmailSuggestion }) {
  const { t } = useTranslation('dashboard');
  const navigate = useNavigate();
  const accept = useAcceptSuggestion();
  const dismiss = useDismissSuggestion();
  const excerpt = item.extracted_spans?.[0]?.excerpt;
  const isPending = accept.isPending || dismiss.isPending;

  return (
    <div
      className="flex items-start gap-3 p-3 rounded-lg border-l-4 border-l-primary/40 bg-muted/30 hover:bg-accent/50 transition-colors cursor-pointer"
      onClick={() => navigate(`/opportunities/${item.opportunity_id}`)}
    >
      <div className="flex-1 min-w-0 space-y-0.5">
        <p className="text-sm font-medium text-foreground truncate">{item.suggested_title}</p>
        <p className="text-xs text-muted-foreground truncate">{item.organization}</p>
        {excerpt && (
          <p className="text-xs text-muted-foreground/70 line-clamp-1 italic">
            "{excerpt.slice(0, 180)}"
          </p>
        )}
        <div className="flex items-center gap-2 flex-wrap">
          {item.metro_name && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">{item.metro_name}</Badge>
          )}
          {item.suggested_due_date && (
            <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
              <Calendar className="w-3 h-3" />
              {item.suggested_due_date}
            </span>
          )}
          <span className="text-[10px] text-muted-foreground">
            {formatDistanceToNow(new Date(item.created_at))} ago
          </span>
        </div>
      </div>

      <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
        {item.status === 'pending' && (
          <>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0 text-success hover:text-success hover:bg-success/10"
              onClick={() => accept.mutate(item.id)}
              disabled={isPending}
              title={t('relationshipSignals.createCareTask')}
            >
              {accept.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              onClick={() => dismiss.mutate(item.id)}
              disabled={isPending}
              title={t('nextBestActions.dismiss')}
            >
              {dismiss.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
            </Button>
          </>
        )}
        {item.status === 'accepted' && (
          <Badge variant="secondary" className="text-[10px]">{t('relationshipSignals.careTaskCreated')}</Badge>
        )}
      </div>

      <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 mt-1" />
    </div>
  );
}

export function EmailSuggestionsCard() {
  const { t } = useTranslation('dashboard');
  const { data: suggestions, isLoading } = useDashboardEmailSuggestions(10);

  if (!isLoading && (!suggestions || suggestions.length === 0)) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Mail className="w-4 h-4 text-primary" />
              {t('relationshipSignals.title')}
              <HelpTooltip
                what="Follow-up suggestions detected from your recent email conversations with partners."
                where="Mission Rhythm dashboard — visible to stewards, shepherds, and companions."
                why="Helps you stay present with the people you're caring for, without manual tracking."
              />
            </CardTitle>
            <CardDescription className="text-xs">{t('relationshipSignals.description')}</CardDescription>
          </div>
          {suggestions && suggestions.length > 0 && (
            <Badge variant="secondary" className="text-xs">{suggestions.length}</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)
        ) : (
          suggestions!.map((item) => <SuggestionRow key={item.id} item={item} />)
        )}
      </CardContent>
    </Card>
  );
}
