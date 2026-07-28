import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { GitCompare, Loader2, Signal } from 'lucide-react';
import { useOrgDiffs, useOrgWatchlistSignals } from '@/hooks/useOrgWatchlist';
import { format, parseISO } from 'date-fns';

interface RecentChangesPanelProps {
  orgId: string;
}

export function RecentChangesPanel({ orgId }: RecentChangesPanelProps) {
  const { data: diffs, isLoading: diffsLoading } = useOrgDiffs(orgId);
  const { data: signals, isLoading: signalsLoading } = useOrgWatchlistSignals(orgId);

  const isLoading = diffsLoading || signalsLoading;
  const changedDiffs = diffs?.filter((d) => {
    const diff = d.diff as Record<string, unknown>;
    return diff?.changed === true;
  }) ?? [];

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-6">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <GitCompare className="w-4 h-4" />
          Recent Changes
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Changed diffs */}
        {!changedDiffs.length && !signals?.length ? (
          <p className="text-sm text-muted-foreground">No changes detected yet</p>
        ) : (
          <>
            {changedDiffs.length > 0 && (
              <div className="space-y-2">
                {changedDiffs.map((d) => {
                  const diff = d.diff as Record<string, unknown>;
                  const delta = diff?.delta as Record<string, number> | undefined;
                  return (
                    <div key={d.id} className="p-2 rounded-lg bg-muted/30 text-sm">
                      <p className="text-muted-foreground">
                        {format(parseISO(d.created_at), 'MMM d, yyyy h:mm a')}
                      </p>
                      {delta && (
                        <p className="text-xs text-muted-foreground">
                          +{delta.added_chars ?? 0} / -{delta.removed_chars ?? 0} chars
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Signals */}
            {signals && signals.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <Signal className="w-3 h-3" /> Signals
                </p>
                {signals.map((s) => (
                  <div key={s.id} className="p-2 rounded-lg bg-accent/5 border border-accent/10 text-sm">
                    <p>{s.summary}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {format(parseISO(s.created_at), 'MMM d, yyyy')} · {Math.round(s.confidence * 100)}%
                    </p>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
