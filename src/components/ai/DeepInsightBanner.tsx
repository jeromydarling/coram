/**
 * DeepInsightBanner — Gentle awareness banner for Deep Insight usage thresholds.
 *
 * WHAT: Subtle banner at 80%, 95%, and 100% of Deep Insight allowance.
 * WHERE: Rendered at the top of AI-heavy pages or in settings.
 * WHY: Calm, non-alarmist usage transparency per CROS governance (Part 3 & 4).
 */
import { useState } from 'react';
import { useDeepInsightStatus } from '@/hooks/useDeepInsightStatus';
import { Info, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

export function DeepInsightBanner() {
  const { data: status } = useDeepInsightStatus();
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || !status || (!status.nearLimit && !status.atLimit)) return null;

  if (status.atLimit) {
    return (
      <div className="rounded-lg border border-border bg-muted/50 p-3 flex items-start gap-3">
        <Sparkles className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0 space-y-2">
          <p className="text-sm text-foreground">
            You've used your included Deep Insights for this month. You can continue with essential summaries or unlock deeper narrative intelligence.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              className="text-xs h-7"
              onClick={() => setDismissed(true)}
            >
              Continue Essential Mode
            </Button>
            <Button
              variant="default"
              size="sm"
              className="text-xs h-7"
              onClick={() => navigate('/settings')}
            >
              Upgrade Plan
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Near limit (80-95%) or critical (95-99%)
  const message = status.criticalLimit
    ? "You're nearly at your included Deep Insight limit. Essential mode will remain available."
    : "You're approaching your included Deep Insights for this month. Essential summaries remain available.";

  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3 flex items-start gap-2">
      <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
      <p className="text-xs text-muted-foreground">{message}</p>
    </div>
  );
}
