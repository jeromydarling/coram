/**
 * ActivationTimeline — Vertical timeline of first movements.
 *
 * WHAT: Shows chronological activation log entries for a metro.
 * WHERE: ActivationPanel inside Metro Detail / Expansion Canvas.
 * WHY: Visualizes the journey of entering a new community.
 */

import { useActivationLog } from '@/hooks/useActivationLog';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { HelpCircle } from 'lucide-react';
import { format } from 'date-fns';

const EVENT_LABELS: Record<string, string> = {
  first_reflection: 'First reflection written',
  first_partner_contact: 'First partner contact',
  first_event_attended: 'First event attended',
  first_email: 'First email sent',
  first_communio_signal: 'First communio signal',
  first_provisio: 'First provision requested',
  first_voluntarium: 'First volunteer activity',
  activation_stage_change: 'Stage progressed',
  activation_action_completed: 'Action completed',
  first_presence_detected: 'First presence detected',
};

interface Props {
  metroId: string;
}

export function ActivationTimeline({ metroId }: Props) {
  const { entries, isLoading } = useActivationLog(metroId);

  if (isLoading) {
    return <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-10" />)}</div>;
  }

  if (entries.length === 0) {
    return (
      <p className="text-sm text-muted-foreground italic py-4" style={{ fontFamily: 'Georgia, serif' }}>
        No movements recorded yet. Every community begins with a single step.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium text-foreground flex items-center gap-1.5">
        Timeline
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger><HelpCircle className="h-3 w-3 text-muted-foreground" /></TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p className="text-xs">
                <strong>What:</strong> Chronological record of first movements.<br />
                <strong>Where:</strong> metro_activation_log table.<br />
                <strong>Why:</strong> Narrates the journey of community entry.
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </h4>
      <div className="relative pl-4 border-l-2 border-primary/20 space-y-4">
        {entries.map(entry => (
          <div key={entry.id} className="relative">
            <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-primary/60" />
            <div>
              <p className="text-sm text-foreground">
                {EVENT_LABELS[entry.event_type] || entry.event_type}
              </p>
              <p className="text-xs text-muted-foreground">
                {format(new Date(entry.created_at), 'MMM d, yyyy')}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
