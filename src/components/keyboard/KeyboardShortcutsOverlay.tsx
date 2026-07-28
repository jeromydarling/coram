/**
 * KeyboardShortcutsOverlay — Modal showing all available keyboard shortcuts.
 *
 * WHAT: Full-screen overlay listing all registered keyboard shortcuts.
 * WHERE: Triggered by pressing Shift+? from any non-input context.
 * WHY: Power users need discoverability for keyboard navigation.
 */
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Kbd } from '@/components/ui/kbd';

interface ShortcutGroup {
  label: string;
  shortcuts: { keys: string[]; description: string }[];
}

const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    label: 'Navigation',
    shortcuts: [
      { keys: ['G', 'D'], description: 'Go to Dashboard' },
      { keys: ['G', 'O'], description: 'Go to Partnerships' },
      { keys: ['G', 'C'], description: 'Go to People' },
      { keys: ['G', 'P'], description: 'Go to Pipeline' },
      { keys: ['G', 'E'], description: 'Go to Events' },
      { keys: ['G', 'M'], description: 'Go to Metros' },
      { keys: ['G', 'A'], description: 'Go to Anchors' },
      { keys: ['G', 'R'], description: 'Go to Reports' },
      { keys: ['G', 'S'], description: 'Go to Settings' },
    ],
  },
  {
    label: 'Actions',
    shortcuts: [
      { keys: ['G', 'N'], description: 'New Partnership' },
      { keys: ['G', 'K'], description: 'New Person' },
    ],
  },
  {
    label: 'Help',
    shortcuts: [
      { keys: ['?'], description: 'Open this shortcuts guide' },
    ],
  },
];

interface KeyboardShortcutsOverlayProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function KeyboardShortcutsOverlay({ open, onOpenChange }: KeyboardShortcutsOverlayProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Keyboard Shortcuts</DialogTitle>
        </DialogHeader>
        <div className="space-y-6 pt-2">
          {SHORTCUT_GROUPS.map((group) => (
            <div key={group.label}>
              <h3 className="text-sm font-medium text-muted-foreground mb-3">{group.label}</h3>
              <div className="space-y-2">
                {group.shortcuts.map((shortcut) => (
                  <div
                    key={shortcut.description}
                    className="flex items-center justify-between py-1"
                  >
                    <span className="text-sm">{shortcut.description}</span>
                    <div className="flex items-center gap-1">
                      {shortcut.keys.map((key, i) => (
                        <span key={i}>
                          {i > 0 && <span className="text-xs text-muted-foreground mx-0.5">then</span>}
                          <Kbd>{key}</Kbd>
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
