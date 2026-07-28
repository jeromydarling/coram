/**
 * DeepInsightBadge — Subtle indicator that an action uses Deep Insight.
 *
 * WHAT: Shows "✦ Uses Deep Insight" label with hover explanation.
 * WHERE: Next to buttons/actions that trigger Deep Intelligence workflows.
 * WHY: Transparent usage communication per CROS governance (Part 3).
 */
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Sparkles } from 'lucide-react';

interface DeepInsightBadgeProps {
  className?: string;
}

export function DeepInsightBadge({ className = '' }: DeepInsightBadgeProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={`inline-flex items-center gap-1 text-xs text-muted-foreground ${className}`}>
            <Sparkles className="h-3 w-3" />
            <span>Uses Deep Insight</span>
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[240px]">
          <p className="text-xs">
            Deep Insights perform multi-source research and cross-entity synthesis. 
            Your monthly allowance covers these deeper analyses.
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
