import { cn } from '@/lib/utils';
import type { GrantStage } from '@/hooks/useGrants';

interface GrantStageBadgeProps {
  stage: GrantStage;
  className?: string;
}

const stageColors: Record<GrantStage, string> = {
  'Researching': 'bg-muted text-muted-foreground',
  'Eligible': 'bg-info/15 text-info',
  'Cultivating': 'bg-primary/15 text-primary',
  'LOI Submitted': 'bg-warning/15 text-warning',
  'Full Proposal Submitted': 'bg-accent/15 text-accent',
  'Awarded': 'bg-success/15 text-success border border-success/30',
  'Declined': 'bg-destructive/15 text-destructive',
  'Closed': 'bg-muted text-muted-foreground'
};

export function GrantStageBadge({ stage, className }: GrantStageBadgeProps) {
  return (
    <span 
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap',
        stageColors[stage],
        className
      )}
    >
      {stage}
    </span>
  );
}
