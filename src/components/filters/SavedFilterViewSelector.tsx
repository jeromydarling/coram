/**
 * SavedFilterViewSelector — Dropdown to select/save filter views.
 *
 * WHAT: Lets users save current filters as named views and switch between them.
 * WHERE: Used in any list page header with filtering capability.
 * WHY: Saves time for users who frequently switch between filter combinations.
 */
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Bookmark, Plus, Trash2, Star } from 'lucide-react';
import { useSavedFilterViews, SavedFilterView } from '@/hooks/useSavedFilterViews';

interface SavedFilterViewSelectorProps {
  entityType: string;
  currentFilters: Record<string, unknown>;
  currentSort?: Record<string, unknown>;
  onApplyView: (filters: Record<string, unknown>, sort: Record<string, unknown>) => void;
}

export function SavedFilterViewSelector({
  entityType,
  currentFilters,
  currentSort = {},
  onApplyView,
}: SavedFilterViewSelectorProps) {
  const { views, saveView, deleteView } = useSavedFilterViews(entityType);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [viewName, setViewName] = useState('');

  const handleSave = () => {
    if (!viewName.trim()) return;
    saveView.mutate({
      view_name: viewName.trim(),
      filters: currentFilters,
      sort_config: currentSort,
    });
    setViewName('');
    setSaveDialogOpen(false);
  };

  const handleApply = (view: SavedFilterView) => {
    onApplyView(view.filters, view.sort_config);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            <Bookmark className="h-3.5 w-3.5 mr-1.5" />
            Views
            {views.length > 0 && (
              <span className="ml-1 text-xs text-muted-foreground">({views.length})</span>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          {views.map((view) => (
            <DropdownMenuItem key={view.id} className="flex items-center justify-between">
              <button
                className="flex items-center gap-2 flex-1 text-left"
                onClick={() => handleApply(view)}
              >
                {view.is_default && <Star className="h-3 w-3 text-primary" />}
                <span className="truncate">{view.view_name}</span>
              </button>
              <button
                className="ml-2 text-muted-foreground hover:text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  deleteView.mutate(view.id);
                }}
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </DropdownMenuItem>
          ))}
          {views.length > 0 && <DropdownMenuSeparator />}
          <DropdownMenuItem onClick={() => setSaveDialogOpen(true)}>
            <Plus className="h-3.5 w-3.5 mr-2" />
            Save current filters
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Save Filter View</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="View name…"
            value={viewName}
            onChange={(e) => setViewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={!viewName.trim() || saveView.isPending}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
