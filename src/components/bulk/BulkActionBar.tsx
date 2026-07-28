/**
 * BulkActionBar — Floating action bar for multi-select operations.
 *
 * WHAT: Appears when items are selected, offering bulk delete/edit actions.
 * WHERE: Used in contacts and opportunities list pages.
 * WHY: Users need clear, accessible controls for batch operations.
 */
import { Button } from '@/components/ui/button';
import { Trash2, X, Pencil } from 'lucide-react';
import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface BulkActionBarProps {
  selectedCount: number;
  onClear: () => void;
  onDelete: () => void;
  onEdit?: () => void;
  isDeleting?: boolean;
  entityLabel?: string;
}

export function BulkActionBar({
  selectedCount,
  onClear,
  onDelete,
  onEdit,
  isDeleting = false,
  entityLabel = 'items',
}: BulkActionBarProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);

  if (selectedCount === 0) return null;

  return (
    <>
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-lg border bg-card px-4 py-3 shadow-lg">
        <span className="text-sm font-medium">
          {selectedCount} {entityLabel} selected
        </span>
        {onEdit && (
          <Button variant="outline" size="sm" onClick={onEdit}>
            <Pencil className="h-3.5 w-3.5 mr-1.5" />
            Edit
          </Button>
        )}
        <Button
          variant="destructive"
          size="sm"
          onClick={() => setConfirmOpen(true)}
          disabled={isDeleting}
        >
          <Trash2 className="h-3.5 w-3.5 mr-1.5" />
          {isDeleting ? 'Deleting…' : 'Delete'}
        </Button>
        <Button variant="ghost" size="sm" onClick={onClear}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Move {selectedCount} {entityLabel} to recycle bin?</AlertDialogTitle>
            <AlertDialogDescription>
              These records will be soft-deleted and can be restored from the recycle bin within 90 days.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                onDelete();
                setConfirmOpen(false);
              }}
            >
              Yes, delete {selectedCount} {entityLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
