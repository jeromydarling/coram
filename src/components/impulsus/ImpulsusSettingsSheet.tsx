/**
 * ImpulsusSettingsSheet — toggles for capture preferences.
 *
 * WHAT: A slide-out sheet letting users enable/disable capture types.
 * WHERE: Accessed via the settings icon on the Impulsus page header.
 * WHY: Gives users control over what gets captured.
 */

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useImpulsusSettings } from '@/hooks/useImpulsusSettings';

interface ImpulsusSettingsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const TOGGLES = [
  { key: 'capture_reflections', label: 'Reflections', desc: 'When I write a reflection on a partner.' },
  { key: 'capture_email_actions', label: 'Emails & Tasks', desc: 'When I act on emails or create tasks.' },
  { key: 'capture_calendar_events', label: 'Calendar Events', desc: 'When I mark events as attended.' },
  { key: 'capture_ai_suggestions', label: 'AI Suggestions', desc: 'When I accept an AI nudge.' },
] as const;

export function ImpulsusSettingsSheet({ open, onOpenChange }: ImpulsusSettingsSheetProps) {
  const { settings, updateSettings } = useImpulsusSettings();

  const handleToggle = (key: string, value: boolean) => {
    updateSettings.mutate({ [key]: value });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Capture Settings</SheetTitle>
          <SheetDescription>
            Choose which moments get added to your Impulsus journal.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 mt-6">
          {TOGGLES.map((toggle) => (
            <div key={toggle.key} className="flex items-start justify-between gap-4">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">{toggle.label}</Label>
                <p className="text-xs text-muted-foreground">{toggle.desc}</p>
              </div>
              <Switch
                checked={settings?.[toggle.key as keyof typeof settings] as boolean ?? true}
                onCheckedChange={(checked) => handleToggle(toggle.key, checked)}
                disabled={updateSettings.isPending}
              />
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
