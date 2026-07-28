import { Badge } from '@/components/ui/badge';
import { Lightbulb, ShieldAlert, Sparkles, Info } from 'lucide-react';
import { useSuggestionDecisions } from '@/hooks/useCampaignIntelligence';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface SuggestionDecisionBadgeProps {
  suggestionId: string;
}

const DECISION_CONFIG: Record<string, {
  label: string;
  icon: typeof Sparkles;
  className: string;
}> = {
  boosted: {
    label: 'Proven',
    icon: Sparkles,
    className: 'bg-chart-2/15 text-chart-2',
  },
  shown: {
    label: 'Experimental',
    icon: Lightbulb,
    className: 'bg-warning/15 text-warning',
  },
  suppressed: {
    label: 'Suppressed',
    icon: ShieldAlert,
    className: 'bg-destructive/15 text-destructive',
  },
};

export function SuggestionDecisionBadge({ suggestionId }: SuggestionDecisionBadgeProps) {
  const { data: decisions } = useSuggestionDecisions([suggestionId]);
  const decision = decisions?.[0];

  if (!decision) return null;

  const config = DECISION_CONFIG[decision.decision] || DECISION_CONFIG.shown;
  const Icon = config.icon;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge className={`${config.className} text-xs gap-1 cursor-help`}>
            <Icon className="w-3 h-3" />
            {config.label}
          </Badge>
        </TooltipTrigger>
        <TooltipContent className="max-w-[240px]">
          <div className="space-y-1">
            <p className="text-xs font-medium flex items-center gap-1">
              <Info className="w-3 h-3" />
              Why this was suggested
            </p>
            <p className="text-xs text-muted-foreground">{decision.reason}</p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
