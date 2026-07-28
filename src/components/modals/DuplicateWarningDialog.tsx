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
import { Badge } from '@/components/ui/badge';
import { Building2, MapPin } from 'lucide-react';

interface SimilarOpportunity {
  id: string;
  organization: string;
  stage?: string | null;
  metros?: { metro: string } | null;
}

interface DuplicateWarningDialogProps {
  open: boolean;
  organizationName: string;
  similarOpportunities: SimilarOpportunity[];
  onCreateAnyway: () => void;
  onCancel: () => void;
  onSelect?: (id: string) => void;
}

export function DuplicateWarningDialog({ 
  open, 
  organizationName,
  similarOpportunities,
  onCreateAnyway, 
  onCancel,
  onSelect
}: DuplicateWarningDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-warning" />
            Similar Organization Found
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>
                An organization with a similar name to <strong>"{organizationName}"</strong> already exists.
                Would you like to use the existing record or create a new one?
              </p>
              
              <div className="space-y-2 max-h-[200px] overflow-y-auto">
                {similarOpportunities.map((opp) => (
                  <div 
                    key={opp.id}
                    className="p-3 rounded-lg border border-border bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer"
                    onClick={() => onSelect?.(opp.id)}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{opp.organization}</span>
                      {opp.stage && (
                        <Badge variant="secondary" className="text-xs">
                          {opp.stage}
                        </Badge>
                      )}
                    </div>
                    {opp.metros?.metro && (
                      <div className="flex items-center gap-1 mt-1 text-sm text-muted-foreground">
                        <MapPin className="w-3 h-3" />
                        {opp.metros.metro}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onCreateAnyway}>
            Create New Anyway
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
