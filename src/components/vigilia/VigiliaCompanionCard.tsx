/**
 * VigiliaCompanionCard — Gentle companion prompts for tenant users.
 *
 * WHAT: Displays open Vigilia signals as warm, narrative cards with action buttons.
 * WHERE: Dashboard, Visits page, Opportunities page.
 * WHY: Vigilia is a calm companion — never urgent, always human.
 */
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Eye, Feather, CalendarPlus, X } from 'lucide-react';
import { useVigiliaSignals, useVigiliaAction } from '@/hooks/useVigiliaSignals';
import { useNavigate } from 'react-router-dom';
import { useTenant } from '@/contexts/TenantContext';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { HelpCircle } from 'lucide-react';

interface VigiliaCompanionCardProps {
  /** Max signals to show */
  limit?: number;
  /** Compact mode for sidebars */
  compact?: boolean;
}

const ACTION_MAP: Record<string, { label: string; icon: React.ElementType; route: string }> = {
  visit_without_followup: { label: 'Capture Reflection', icon: Feather, route: 'reflections' },
  partner_silence_gap: { label: 'Schedule Follow-up', icon: CalendarPlus, route: 'opportunities' },
  activity_dropoff: { label: 'Capture Reflection', icon: Feather, route: 'visits' },
  volunteer_gap: { label: 'Schedule Follow-up', icon: CalendarPlus, route: 'volunteers' },
  reflection_without_action: { label: 'Schedule Follow-up', icon: CalendarPlus, route: 'opportunities' },
  event_followup_missing: { label: 'Capture Reflection', icon: Feather, route: 'visits' },
  friction_idle_detected: { label: 'Capture Reflection', icon: Feather, route: 'visits' },
  narrative_surge_detected: { label: 'Capture Reflection', icon: Feather, route: 'reflections' },
};

export function VigiliaCompanionCard({ limit = 3, compact = false }: VigiliaCompanionCardProps) {
  const { data: signals, isLoading } = useVigiliaSignals(limit);
  const { mutate: actOnSignal } = useVigiliaAction();
  const navigate = useNavigate();
  const { tenant } = useTenant();

  if (isLoading) {
    return (
      <Card className="border-primary/10">
        <CardContent className="pt-4 pb-3 space-y-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-14" />
        </CardContent>
      </Card>
    );
  }

  if (!signals || signals.length === 0) return null;

  return (
    <Card className="border-primary/10 bg-primary/[0.02]">
      <CardContent className={compact ? 'pt-3 pb-2' : 'pt-4 pb-3'}>
        <div className="flex items-center gap-2 mb-3">
          <Eye className="w-3.5 h-3.5 text-primary/60" />
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Something worth noticing
          </span>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <HelpCircle className="w-3 h-3 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs text-xs">
                <p><strong>What:</strong> Gentle observations from your relationship patterns.</p>
                <p><strong>Where:</strong> Generated from visits, activities, and events.</p>
                <p><strong>Why:</strong> A calm companion noticing what may help.</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <div className="space-y-2">
          {signals.map((signal) => {
            const actionInfo = ACTION_MAP[signal.type] ?? { label: 'Capture Reflection', icon: Feather, route: 'visits' };
            const ActionIcon = actionInfo.icon;

            return (
              <div
                key={signal.id}
                className="flex items-start justify-between gap-3 p-2.5 rounded-lg bg-muted/30"
              >
                <p className="text-sm text-foreground leading-relaxed flex-1 min-w-0">
                  {signal.suggested_action}
                </p>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs gap-1 text-primary hover:text-primary"
                    onClick={() => {
                      actOnSignal({ signalId: signal.id, action: 'acted' });
                      if (tenant?.slug) {
                        navigate(`/${tenant.slug}/${actionInfo.route}`);
                      }
                    }}
                  >
                    <ActionIcon className="w-3 h-3" />
                    {actionInfo.label}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                    onClick={() => actOnSignal({ signalId: signal.id, action: 'dismissed' })}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
