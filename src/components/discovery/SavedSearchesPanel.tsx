import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Bookmark,
  Play,
  Trash2,
  Pencil,
  Check,
  X,
  Loader2,
  Clock,
  Sparkles,
} from 'lucide-react';
import {
  SavedSearch,
  useSavedSearchList,
  useRunSavedSearch,
  useDeleteSavedSearch,
  useRenameSavedSearch,
} from '@/hooks/useSavedSearches';
import { formatDistanceToNow } from 'date-fns';

interface SavedSearchesPanelProps {
  module: string;
  onRunStarted: (runId: string, savedSearchId: string) => void;
}

export function SavedSearchesPanel({ module, onRunStarted }: SavedSearchesPanelProps) {
  const { data: savedSearches, isLoading } = useSavedSearchList(module);
  const runMutation = useRunSavedSearch();
  const deleteMutation = useDeleteSavedSearch();
  const renameMutation = useRenameSavedSearch();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading saved searches…
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!savedSearches || savedSearches.length === 0) {
    return null; // Don't show panel if no saved searches
  }

  const handleRun = async (search: SavedSearch) => {
    const result = await runMutation.mutateAsync({ id: search.id, module });
    if (result.run_id) {
      onRunStarted(result.run_id, search.id);
    }
  };

  const handleStartRename = (search: SavedSearch) => {
    setEditingId(search.id);
    setEditName(search.name);
  };

  const handleSaveRename = async () => {
    if (!editingId || !editName.trim()) return;
    await renameMutation.mutateAsync({ id: editingId, name: editName.trim(), module });
    setEditingId(null);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
          <Bookmark className="w-4 h-4" />
          Saved Searches
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {savedSearches.map((search) => (
          <div
            key={search.id}
            className="p-3 rounded-lg border border-border hover:border-primary/30 transition-colors"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                {editingId === search.id ? (
                  <div className="flex items-center gap-1.5">
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="h-7 text-sm"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveRename();
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                      autoFocus
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0"
                      onClick={handleSaveRename}
                      disabled={renameMutation.isPending}
                    >
                      <Check className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0"
                      onClick={() => setEditingId(null)}
                    >
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <p className="text-sm font-medium truncate">{search.name}</p>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {search.raw_query}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <Badge variant="outline" className="text-xs">
                        {search.scope === 'metro' ? 'Metro' : 'National'}
                      </Badge>
                      {search.last_ran_at && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDistanceToNow(new Date(search.last_ran_at), { addSuffix: true })}
                        </span>
                      )}
                    </div>
                  </>
                )}
              </div>
              {editingId !== search.id && (
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="default"
                    size="sm"
                    className="h-7 gap-1 text-xs"
                    onClick={() => handleRun(search)}
                    disabled={runMutation.isPending}
                  >
                    {runMutation.isPending ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Play className="w-3 h-3" />
                    )}
                    Run
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => handleStartRename(search)}
                  >
                    <Pencil className="w-3 h-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={() => deleteMutation.mutate({ id: search.id, module })}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
