/**
 * SeasonSummaryCard — Displays a single season summary for a person.
 *
 * WHAT: Read-only card showing companion season narrative.
 * WHERE: PersonDetail page, care tab.
 * WHY: Companions need to review and share versioned season summaries.
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { BookOpen, Clock, FileText } from 'lucide-react';
import type { SeasonSummary } from '@/hooks/useSeasonSummaries';

interface SeasonSummaryCardProps {
  summary: SeasonSummary;
}

export function SeasonSummaryCard({ summary }: SeasonSummaryCardProps) {
  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-primary" />
            Season Summary v{summary.version}
          </CardTitle>
          <Badge variant={summary.visibility === 'private' ? 'secondary' : 'default'} className="text-xs">
            {summary.visibility}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          {format(new Date(summary.date_range_start), 'MMM d, yyyy')} — {format(new Date(summary.date_range_end), 'MMM d, yyyy')}
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <FileText className="h-3.5 w-3.5" />
            {summary.care_log_count} moments of care
          </span>
          {summary.total_hours != null && (
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {summary.total_hours}h
            </span>
          )}
        </div>

        {summary.themes && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">Themes</p>
            <p className="text-sm">{summary.themes}</p>
          </div>
        )}

        {summary.excerpts && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">Selected moments</p>
            <p className="text-sm italic text-muted-foreground">{summary.excerpts}</p>
          </div>
        )}

        {summary.gratitude_line && (
          <p className="text-sm text-primary/80 border-l-2 border-primary/30 pl-3 italic">
            {summary.gratitude_line}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
