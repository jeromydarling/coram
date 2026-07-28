/**
 * AccessibilityToggle — Menu item variant for the user dropdown.
 *
 * WHAT: Toggle button for Accessibility Mode with proper ARIA pattern.
 * WHERE: Header user menu.
 * WHY: Must be always reachable and itself fully accessible (WCAG toggle pattern).
 */
import { Accessibility } from 'lucide-react';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { useAccessibilityMode } from '@/hooks/useAccessibilityMode';

export function AccessibilityToggle() {
  const { enabled, toggle } = useAccessibilityMode();

  return (
    <DropdownMenuItem
      className="cursor-pointer"
      onClick={toggle}
      role="menuitemcheckbox"
      aria-checked={enabled}
    >
      <Accessibility className="w-4 h-4 mr-2" />
      <div className="flex flex-col">
        <span>Accessibility Mode</span>
        <span className="text-[10px] text-muted-foreground">
          {enabled ? 'On — enhanced contrast & readability' : 'Off — standard experience'}
        </span>
      </div>
    </DropdownMenuItem>
  );
}
