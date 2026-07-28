/**
 * TodaysMovementSection — Calm nudge cards inside the Compass drawer.
 *
 * WHAT: Renders top 3 CompassNudge cards with direction icons, messages, and optional actions.
 * WHERE: AIChatDrawer, below posture label.
 * WHY: Single unified suggestion surface — replaces all scattered dashboard nudges.
 *
 * ACCESSIBILITY:
 *   - aria-live region announces new nudges
 *   - Arrow keys navigate between nudge cards
 *   - Each card has proper role and labelling
 */

import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { HelpTooltip } from '@/components/ui/help-tooltip';
import { Heart, Compass, RotateCcw, Shield, X, ArrowRight } from 'lucide-react';
import { useCompassSessionEngine, type CompassNudge, type NudgeDirection } from '@/hooks/useCompassSessionEngine';
import { useCompassUserState } from '@/hooks/useCompassUserState';
import { cn } from '@/lib/utils';

const DIRECTION_CONFIG: Record<NudgeDirection, { icon: typeof Heart; label: string; className: string }> = {
  care: { icon: Heart, label: 'Care', className: 'text-[hsl(142_40%_55%)] bg-[hsl(142_40%_55%/0.1)]' },
  expansion: { icon: Compass, label: 'Expansion', className: 'text-primary bg-primary/10' },
  restoration: { icon: RotateCcw, label: 'Restoration', className: 'text-[hsl(40_80%_60%)] bg-[hsl(40_80%_60%/0.1)]' },
  steadfastness: { icon: Shield, label: 'Steadfastness', className: 'text-accent-foreground bg-accent/30' },
};

function NudgeCard({
  nudge,
  onDismiss,
  onNavigate,
  index,
  total,
}: {
  nudge: CompassNudge;
  onDismiss: (id: string) => void;
  onNavigate: (route: string) => void;
  index: number;
  total: number;
}) {
  const config = DIRECTION_CONFIG[nudge.direction];
  const Icon = config.icon;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = (e.currentTarget.parentElement?.children[index + 1] as HTMLElement);
      next?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = (e.currentTarget.parentElement?.children[index - 1] as HTMLElement);
      prev?.focus();
    }
  };

  return (
    <div
      className="flex items-start gap-3 p-3 rounded-lg border border-border/40 bg-card/50 compass-nudge-card"
      role="article"
      aria-label={`${config.label} signal: ${nudge.message}`}
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      <div className={cn('p-1.5 rounded-md shrink-0', config.className)} aria-hidden="true">
        <Icon className="w-3.5 h-3.5" />
      </div>
      <div className="flex-1 min-w-0 space-y-1.5">
        <p className="text-sm text-foreground/85 leading-relaxed">{nudge.message}</p>
        <div className="flex items-center gap-1.5">
          {nudge.optional_action && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-[11px] gap-1 px-2 text-primary hover:text-primary"
              onClick={() => onNavigate(nudge.optional_action!.route || '/')}
              aria-label={`${nudge.optional_action.label} — opens in main view`}
            >
              {nudge.optional_action.label}
              <ArrowRight className="w-3 h-3" aria-hidden="true" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-[11px] gap-1 px-2 text-muted-foreground"
            onClick={() => onDismiss(nudge.id)}
            aria-label={`Dismiss this ${config.label} signal`}
          >
            <X className="w-3 h-3" aria-hidden="true" />
            Dismiss
          </Button>
        </div>
      </div>
    </div>
  );
}

export function TodaysMovementSection({ onClose }: { onClose?: () => void }) {
  const navigate = useNavigate();
  const { nudges, isLoading, revelationActive } = useCompassSessionEngine();
  const { dismissedIds, dismissNudge } = useCompassUserState();

  const handleDismiss = useCallback((id: string) => {
    dismissNudge(id);
  }, [dismissNudge]);

  const handleNavigate = useCallback((route: string) => {
    onClose?.();
    navigate(route);
  }, [navigate, onClose]);

  const visibleNudges = nudges.filter(n => !dismissedIds.has(n.id));

  if (isLoading || visibleNudges.length === 0) return null;

  return (
    <section
      className="space-y-2 pb-3 mb-3 border-b border-border/30"
      aria-label={`Today's Movement — ${visibleNudges.length} signal${visibleNudges.length !== 1 ? 's' : ''}`}
    >
      <div className="flex items-center gap-2">
        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Today's Movement
        </h4>
        <HelpTooltip
          what="Gentle signals gathered from your relationships, actions, and rhythms — unified in one place."
          where="Compass drawer"
          why="Replaces scattered dashboard nudges with a single, calm awareness surface."
        />
      </div>
      <div className="space-y-2" role="feed" aria-label="Movement signals">
        {visibleNudges.map((nudge, index) => (
          <NudgeCard
            key={nudge.id}
            nudge={nudge}
            onDismiss={handleDismiss}
            onNavigate={handleNavigate}
            index={index}
            total={visibleNudges.length}
          />
        ))}
      </div>

      {/* Screen reader announcement for nudge count */}
      <div className="sr-only" aria-live="polite" role="status">
        {visibleNudges.length} gentle signal{visibleNudges.length !== 1 ? 's' : ''} awaiting your attention.
      </div>
    </section>
  );
}
