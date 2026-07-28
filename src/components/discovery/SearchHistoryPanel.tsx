import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { History, RefreshCw, MapPin, Loader2, Users, Building2 } from 'lucide-react';
import { useSearchHistory, type SearchHistoryRun } from '@/hooks/useSearchHistory';
import { formatDistanceToNow } from 'date-fns';

interface SearchHistoryPanelProps {
  module: string;
  onRerun: (run: SearchHistoryRun) => void;
}

export function SearchHistoryPanel({ module, onRerun }: SearchHistoryPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const { data: runs, isLoading } = useSearchHistory(module, expanded);

  return (
    <Card>
      <CardHeader className="pb-2">
        <button
          type="button"
          className="flex items-center gap-2 text-left w-full"
          onClick={() => setExpanded(!expanded)}
        >
          <History className="w-4 h-4 text-muted-foreground" />
          <CardTitle className="text-sm font-medium text-muted-foreground flex-1">
            Search History
          </CardTitle>
          <Badge variant="outline" className="text-xs">
            {expanded ? 'Hide' : 'Show'}
          </Badge>
        </button>
      </CardHeader>
      {expanded && (
        <CardContent className="space-y-2 pt-0">
          {isLoading && (
            <div className="flex items-center justify-center py-4 text-muted-foreground text-sm">
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
              Loading…
            </div>
          )}

          {!isLoading && (!runs || runs.length === 0) && (
            <p className="text-xs text-muted-foreground py-4 text-center">
              Your recent searches will appear here.
            </p>
          )}

          {!isLoading && runs && runs.length > 0 && (
            <div className="space-y-1.5 max-h-64 overflow-y-auto">
              {runs.map((run) => (
                <div
                  key={run.run_id}
                  className="flex items-center gap-2 p-2.5 rounded-lg border border-border hover:border-primary/30 transition-colors group"
                >
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <p className="text-xs font-medium truncate">
                      {run.raw_query || run.enforced_query || 'Search'}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant="outline" className="text-[10px] py-0 h-4">
                        {run.scope === 'metro' ? (
                          <><MapPin className="w-2.5 h-2.5 mr-0.5" />Metro</>
                        ) : 'National'}
                      </Badge>
                      <span>{formatDistanceToNow(new Date(run.created_at), { addSuffix: true })}</span>
                      {run.people_added_count > 0 && (
                        <span className="flex items-center gap-0.5">
                          <Users className="w-2.5 h-2.5" />
                          {run.people_added_count} added
                        </span>
                      )}
                      {run.opportunities_created_count > 0 && (
                        <span className="flex items-center gap-0.5">
                          <Building2 className="w-2.5 h-2.5" />
                          {run.opportunities_created_count}
                        </span>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 gap-1 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => onRerun(run)}
                  >
                    <RefreshCw className="w-3 h-3" />
                    Re-run
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
