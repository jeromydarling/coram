import { useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import type { MetroMomentum } from '@/hooks/useMomentumData';
import { useAuth } from '@/contexts/AuthContext';

interface MissingCoordinatesAlertProps {
  metros: MetroMomentum[];
}

export function MissingCoordinatesAlert({ metros }: MissingCoordinatesAlertProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { isAdmin } = useAuth();

  const missingMetros = metros.filter(m => m.lat === null || m.lng === null);

  if (missingMetros.length === 0 || !isAdmin) {
    return null;
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-2 text-amber-600 border-amber-200 hover:bg-amber-50 dark:text-amber-400 dark:border-amber-800 dark:hover:bg-amber-950"
        >
          <AlertTriangle className="w-4 h-4" />
          <span>{missingMetros.length} metro{missingMetros.length !== 1 ? 's' : ''} missing coordinates</span>
          {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2">
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
          <p className="text-sm text-muted-foreground mb-2">
            These metros are not shown on the map because they lack coordinates:
          </p>
          <ul className="text-sm space-y-1">
            {missingMetros.map((metro) => (
              <li key={metro.metroId} className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                {metro.metroName}
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground mt-3">
            Add lat/lng values in the Admin panel to show these on the map.
          </p>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
