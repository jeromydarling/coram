/**
 * CarePrivacyToggle — Per-activity privacy toggle for companion entries.
 *
 * WHAT: Allows companions to mark individual logs as "Private."
 * WHERE: Activity creation/edit forms when tenant archetype is caregiver_agency.
 * WHY: Companions retain dignity — leadership sees patterns, not private journaling.
 */

import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Lock } from 'lucide-react';

interface CarePrivacyToggleProps {
  isPrivate: boolean;
  onToggle: (value: boolean) => void;
  disabled?: boolean;
}

export function CarePrivacyToggle({ isPrivate, onToggle, disabled }: CarePrivacyToggleProps) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border border-border/50">
      <Lock className="h-4 w-4 text-muted-foreground shrink-0" />
      <div className="flex-1 min-w-0">
        <Label htmlFor="care-private-toggle" className="text-sm font-medium cursor-pointer">
          Private entry
        </Label>
        <p className="text-xs text-muted-foreground mt-0.5">
          Only visible to you. Leadership sees counts, not content.
        </p>
      </div>
      <Switch
        id="care-private-toggle"
        checked={isPrivate}
        onCheckedChange={onToggle}
        disabled={disabled}
      />
    </div>
  );
}
