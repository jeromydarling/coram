/**
 * CalmModeToggle — Toggle for operator calm mode preference.
 *
 * WHAT: Switch that toggles calm_mode in operator_preferences.
 * WHERE: Operator Nexus header area.
 * WHY: Allows operators to control their experience density.
 */
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useCalmMode } from '@/hooks/useCalmMode';
import { Leaf } from 'lucide-react';

export function CalmModeToggle() {
  const { calmMode, toggleCalmMode, isToggling } = useCalmMode();

  return (
    <div className="flex items-center gap-2">
      <Leaf className="w-3 h-3 text-muted-foreground" />
      <Label htmlFor="calm-mode" className="text-xs text-muted-foreground cursor-pointer">
        Calm Mode
      </Label>
      <Switch
        id="calm-mode"
        checked={calmMode}
        onCheckedChange={() => toggleCalmMode()}
        disabled={isToggling}
        className="scale-75"
      />
    </div>
  );
}
