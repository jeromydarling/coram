/**
 * useDirtyClose — Modal abandon guard.
 *
 * WHAT: Tracks "dirty" state and intercepts close attempts, opening an
 *       Unsaved Changes dialog when the user has unsaved work.
 * WHERE: Wrap any modal that has free-text or multi-step input.
 * WHY: Pre-mortem #4 — accidentally closing a modal silently destroyed
 *      30+ minutes of typing. Now they get a gentle "Discard?" prompt.
 *
 * Usage:
 *   const guard = useDirtyClose(onOpenChange);
 *   // In <form>: onChange={guard.markDirty}
 *   // On submit success: guard.reset()
 *   // <Dialog onOpenChange={guard.handleOpenChange}>
 *   // Cancel button: onClick={() => guard.handleOpenChange(false)}
 *   // Render: <UnsavedChangesDialog open={guard.showPrompt} ... />
 */
import { useCallback, useState } from 'react';

export function useDirtyClose(onOpenChange: (open: boolean) => void) {
  const [isDirty, setIsDirty] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);

  const markDirty = useCallback(() => setIsDirty(true), []);
  const reset = useCallback(() => {
    setIsDirty(false);
    setShowPrompt(false);
  }, []);

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open && isDirty) {
        setShowPrompt(true);
        return;
      }
      onOpenChange(open);
    },
    [isDirty, onOpenChange],
  );

  const discard = useCallback(() => {
    setIsDirty(false);
    setShowPrompt(false);
    onOpenChange(false);
  }, [onOpenChange]);

  const cancelPrompt = useCallback(() => setShowPrompt(false), []);

  return { isDirty, markDirty, reset, showPrompt, handleOpenChange, discard, cancelPrompt };
}
