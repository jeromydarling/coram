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
import { AlertTriangle, Users, FileText, Calendar, TrendingUp } from 'lucide-react';

interface RelatedCounts {
  contacts?: number;
  grants?: number;
  events?: number;
  activities?: number;
  pipeline?: number;
}

interface CascadeDeleteDialogProps {
  open: boolean;
  entityType: 'opportunity' | 'contact' | 'event' | 'grant';
  entityName: string;
  relatedCounts: RelatedCounts;
  onConfirm: () => void;
  onCancel: () => void;
  isDeleting?: boolean;
}

const ENTITY_LABELS: Record<string, { singular: string; plural: string; icon: React.ReactNode }> = {
  contacts: { singular: 'contact', plural: 'contacts', icon: <Users className="w-4 h-4" /> },
  grants: { singular: 'grant', plural: 'grants', icon: <FileText className="w-4 h-4" /> },
  events: { singular: 'event', plural: 'events', icon: <Calendar className="w-4 h-4" /> },
  activities: { singular: 'activity', plural: 'activities', icon: <Calendar className="w-4 h-4" /> },
  pipeline: { singular: 'pipeline entry', plural: 'pipeline entries', icon: <TrendingUp className="w-4 h-4" /> },
};

export function CascadeDeleteDialog({ 
  open,
  entityType,
  entityName,
  relatedCounts,
  onConfirm, 
  onCancel,
  isDeleting
}: CascadeDeleteDialogProps) {
  const hasRelatedData = Object.values(relatedCounts).some(count => count && count > 0);
  
  const relatedItems = Object.entries(relatedCounts)
    .filter(([, count]) => count && count > 0)
    .map(([key, count]) => {
      const label = ENTITY_LABELS[key];
      return {
        key,
        count,
        label: count === 1 ? label.singular : label.plural,
        icon: label.icon
      };
    });

  return (
    <AlertDialog open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            {hasRelatedData && <AlertTriangle className="w-5 h-5 text-warning" />}
            Delete {entityType}?
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>
                Are you sure you want to delete <strong>"{entityName}"</strong>?
              </p>
              
              {hasRelatedData && (
                <div className="p-3 rounded-lg bg-warning/10 border border-warning/20">
                  <p className="font-medium text-warning mb-2">
                    This will also affect:
                  </p>
                  <ul className="space-y-1">
                    {relatedItems.map(({ key, count, label, icon }) => (
                      <li key={key} className="flex items-center gap-2 text-sm text-foreground">
                        {icon}
                        <span>{count} {label}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              
              <p className="text-sm">
                You'll have 8 seconds to undo this action.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel} disabled={isDeleting}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction 
            onClick={onConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={isDeleting}
          >
            {isDeleting ? 'Deleting...' : 'Delete'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
