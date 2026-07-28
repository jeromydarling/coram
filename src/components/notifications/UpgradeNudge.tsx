/**
 * UpgradeNudge — Gentle, non-urgent upgrade suggestion banner.
 *
 * WHAT: Shows a soft, dismissible banner when a user is approaching usage limits.
 * WHERE: Main app layout, above page content.
 * WHY: Encourages upgrades without creating urgency or pressure — in keeping with CROS principles.
 */
import { useState } from 'react';
import { X, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

interface UpgradeNudgeProps {
  /** e.g. "You've used 85% of your AI usage pool this month." */
  message: string;
  /** Which tier or add-on would help */
  suggestedUpgrade?: string;
  /** Dismiss key for localStorage persistence */
  dismissKey?: string;
}

export function UpgradeNudge({ message, suggestedUpgrade, dismissKey }: UpgradeNudgeProps) {
  const storageKey = `cros-nudge-dismissed-${dismissKey ?? 'default'}`;
  const [dismissed, setDismissed] = useState(() => {
    if (!dismissKey) return false;
    const stored = localStorage.getItem(storageKey);
    if (!stored) return false;
    // Re-show after 7 days
    const dismissedAt = parseInt(stored, 10);
    return Date.now() - dismissedAt < 7 * 24 * 60 * 60 * 1000;
  });

  if (dismissed) return null;

  const handleDismiss = () => {
    setDismissed(true);
    if (dismissKey) {
      localStorage.setItem(storageKey, Date.now().toString());
    }
  };

  return (
    <div className="bg-accent/30 border border-accent/50 rounded-lg px-4 py-3 flex items-start gap-3 mx-4 mt-3 sm:mx-6">
      <Sparkles className="h-4 w-4 text-primary mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-foreground/80">{message}</p>
        {suggestedUpgrade && (
          <p className="text-xs text-muted-foreground mt-1">
            Consider adding <strong>{suggestedUpgrade}</strong> to expand your capacity.{' '}
            <Link
              to="/admin?tab=subscription"
              className="underline underline-offset-2 hover:text-foreground transition-colors"
            >
              View options
            </Link>
          </p>
        )}
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 shrink-0 text-muted-foreground hover:text-foreground"
        onClick={handleDismiss}
        aria-label="Dismiss"
      >
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
