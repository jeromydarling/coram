/**
 * PublicMovementOptInCard — Calm opt-in for public constellation contribution.
 *
 * WHAT: Toggles to share anonymous movement signals in the public constellation.
 * WHERE: Onboarding wizard (after enrichment), Settings → Public Presence.
 * WHY: Privacy-first consent — never auto-enabled. Grows the constellation of care.
 */

import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Sparkles } from 'lucide-react';

interface Props {
  movementOptIn: boolean;
  onMovementOptInChange: (checked: boolean) => void;
  excerptOptIn: boolean;
  onExcerptOptInChange: (checked: boolean) => void;
  isHipaa?: boolean;
}

export default function PublicMovementOptInCard({
  movementOptIn,
  onMovementOptInChange,
  excerptOptIn,
  onExcerptOptInChange,
  isHipaa = false,
}: Props) {
  return (
    <div className="p-4 rounded-lg border border-border bg-muted/30 space-y-4">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Sparkles className="h-5 w-5 text-primary" />
        </div>
        <div className="space-y-1.5">
          <h4
            className="text-sm font-medium text-foreground"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            Help grow the constellation of care
          </h4>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Across CROS, organizations are quietly building a living constellation —
            not of data points, but of people helped and stories unfolding.
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            If you choose, your organization can contribute anonymous movement signals:
            things like visits completed, projects finished, or care provided.
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed font-medium">
            No names. No private details.
            Just the quiet evidence that good work is happening.
          </p>
        </div>
      </div>

      <div className="space-y-3 pl-[3.25rem]">
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="movement-opt-in" className="text-sm cursor-pointer flex-1">
            Share anonymous movement in the public constellation
          </Label>
          <Switch
            id="movement-opt-in"
            checked={movementOptIn}
            onCheckedChange={onMovementOptInChange}
          />
        </div>

        <div className="flex items-center justify-between gap-3">
          <Label
            htmlFor="excerpt-opt-in"
            className={`text-sm flex-1 ${isHipaa ? 'text-muted-foreground/50 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            Allow published story excerpts to appear (optional)
          </Label>
          <Switch
            id="excerpt-opt-in"
            checked={excerptOptIn}
            onCheckedChange={onExcerptOptInChange}
            disabled={isHipaa}
          />
        </div>

        {isHipaa && (
          <p className="text-[10px] text-muted-foreground/60">
            For sensitive contexts, only anonymous counts are shared.
          </p>
        )}
      </div>

      <p className="text-[10px] text-muted-foreground/60 pl-[3.25rem]">
        You can change this anytime in Settings.
      </p>
    </div>
  );
}
