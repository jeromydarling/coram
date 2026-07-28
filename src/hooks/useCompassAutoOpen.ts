/**
 * useCompassAutoOpen — Auto-opens Compass drawer on login when nudges exist.
 *
 * WHAT: Checks nudge count + 8-hour DB-persisted cooldown + daily dismiss state.
 * WHERE: AIChatButton.
 * WHY: Meaningful movement should gently surface, not demand attention.
 */

import { useEffect, useRef } from 'react';
import { useCompassSessionEngine } from './useCompassSessionEngine';
import { useCompassUserState } from './useCompassUserState';

export function useCompassAutoOpen(
  isOpen: boolean,
  setIsOpen: (open: boolean) => void
) {
  const { nudges, isLoading: nudgesLoading } = useCompassSessionEngine();
  const { dismissedIds, canAutoOpen, recordAutoOpen, isLoading: stateLoading } = useCompassUserState();
  const hasTriggered = useRef(false);

  useEffect(() => {
    if (isOpen || nudgesLoading || stateLoading || hasTriggered.current || nudges.length === 0) return;

    // Check DB-persisted cooldown
    if (!canAutoOpen) return;

    // Check if all nudges already dismissed today
    const allDismissed = nudges.every(n => dismissedIds.has(n.id));
    if (allDismissed) return;

    hasTriggered.current = true;
    recordAutoOpen();
    setIsOpen(true);
  }, [nudges, nudgesLoading, stateLoading, isOpen, setIsOpen, canAutoOpen, dismissedIds, recordAutoOpen]);
}
