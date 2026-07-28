/**
 * ActivationChecklist — Gentle first-presence checklist.
 *
 * WHAT: Pre-seeded actions to guide first steps into a new metro.
 * WHERE: ActivationPanel inside Metro Detail / Expansion Canvas.
 * WHY: Encourages presence without urgency or deadlines.
 */

import { useActivationActions } from '@/hooks/useActivationActions';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { HelpCircle } from 'lucide-react';

interface Props {
  metroId: string;
}

export function ActivationChecklist({ metroId }: Props) {
  const { actions, isLoading, seedDefaults, toggleAction } = useActivationActions(metroId);

  if (isLoading) {
    return <div className="space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-8" />)}</div>;
  }

  if (actions.length === 0) {
    return (
      <div className="text-center py-4 space-y-3">
        <p className="text-sm text-muted-foreground" style={{ fontFamily: 'Georgia, serif' }}>
          Begin with gentle steps.
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => seedDefaults.mutate()}
          disabled={seedDefaults.isPending}
        >
          Start Activation Checklist
        </Button>
      </div>
    );
  }

  const completedCount = actions.filter(a => a.completed).length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-foreground flex items-center gap-1.5">
          First Steps
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger><HelpCircle className="h-3 w-3 text-muted-foreground" /></TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p className="text-xs">
                  <strong>What:</strong> Gentle activation checklist for first presence.<br />
                  <strong>Where:</strong> metro_activation_actions table.<br />
                  <strong>Why:</strong> Guides meaningful first steps without pressure.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </h4>
        <span className="text-xs text-muted-foreground">
          {completedCount} of {actions.length}
        </span>
      </div>
      <div className="space-y-2">
        {actions.map(action => (
          <label
            key={action.id}
            className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
          >
            <Checkbox
              checked={action.completed}
              onCheckedChange={(checked) =>
                toggleAction.mutate({ actionId: action.id, completed: !!checked })
              }
              disabled={toggleAction.isPending}
            />
            <span
              className={`text-sm ${action.completed ? 'text-muted-foreground line-through' : 'text-foreground'}`}
            >
              {action.label}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}
