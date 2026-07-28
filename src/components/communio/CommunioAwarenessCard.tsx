/**
 * CommunioAwarenessCard — Ambient cross-tenant learnings.
 *
 * WHAT: Displays anonymized patterns from the network as gentle narrative cards.
 * WHERE: Dashboard, Visits, Opportunities pages.
 * WHY: Strengthens adoption gently without exposing tenant identity.
 */
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Users, Feather, CalendarPlus, X } from 'lucide-react';
import { useCommunioAwareness } from '@/hooks/useCommunioAwareness';
import { useNavigate } from 'react-router-dom';
import { useTenant } from '@/contexts/TenantContext';
import { useState } from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { HelpCircle } from 'lucide-react';

const ACTION_ROUTES: Record<string, { label: string; icon: React.ElementType; route: string }> = {
  visit_without_followup: { label: 'Try This', icon: Feather, route: 'visits' },
  activity_dropoff: { label: 'Try This', icon: CalendarPlus, route: 'visits' },
  partner_silence_gap: { label: 'Try This', icon: CalendarPlus, route: 'opportunities' },
  event_followup_missing: { label: 'Try This', icon: Feather, route: 'visits' },
};

interface CommunioAwarenessCardProps {
  limit?: number;
  compact?: boolean;
}

export function CommunioAwarenessCard({ limit = 2, compact = false }: CommunioAwarenessCardProps) {
  const { data: signals, isLoading } = useCommunioAwareness(limit);
  const navigate = useNavigate();
  const { tenant } = useTenant();
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  if (isLoading) {
    return (
      <Card className="border-muted">
        <CardContent className="pt-4 pb-3 space-y-2">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-12" />
        </CardContent>
      </Card>
    );
  }

  const visible = (signals || []).filter(s => !dismissed.has(s.id));
  if (visible.length === 0) return null;

  return (
    <Card className="border-muted bg-muted/[0.03]">
      <CardContent className={compact ? 'pt-3 pb-2' : 'pt-4 pb-3'}>
        <div className="flex items-center gap-2 mb-3">
          <Users className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            From the network
          </span>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <HelpCircle className="w-3 h-3 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs text-xs">
                <p><strong>What:</strong> Anonymized patterns from companions across the network.</p>
                <p><strong>Where:</strong> Aggregated from shared activity rhythms.</p>
                <p><strong>Why:</strong> Small practices others found helpful — never identities.</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <div className="space-y-2">
          {visible.map((signal) => {
            const actionInfo = ACTION_ROUTES[signal.source_signal_type] ?? { label: 'Try This', icon: Feather, route: 'visits' };
            const ActionIcon = actionInfo.icon;

            return (
              <div
                key={signal.id}
                className="flex items-start justify-between gap-3 p-2.5 rounded-lg bg-muted/20"
              >
                <p className="text-sm text-muted-foreground leading-relaxed flex-1 min-w-0 italic">
                  {signal.anonymized_message}
                </p>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs gap-1 text-foreground hover:text-foreground"
                    onClick={() => {
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
                    onClick={() => setDismissed(prev => new Set(prev).add(signal.id))}
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
