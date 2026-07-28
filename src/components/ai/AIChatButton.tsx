/**
 * AIChatButton — Floating CROS Companion (NRI) compass launcher.
 *
 * WHAT: Fixed-position compass button to open the unified NRI Guide.
 * WHERE: Global — rendered in App.tsx.
 * WHY: Single entry point for all platform help and AI actions.
 *      Glows softly when the companion detects helpful movement.
 *      Auto-opens when meaningful nudges exist (8h cooldown).
 *      Auto-opens with contextual guide for new users navigating sections.
 *      Auto-opens on system errors to reassure the user.
 */

import { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Compass } from 'lucide-react';
import { AIChatDrawer } from './AIChatDrawer';
import { useCompassGlow } from '@/hooks/useCompassGlow';
import { useCompassAutoOpen } from '@/hooks/useCompassAutoOpen';
import { useFoundationalProvidence } from '@/hooks/useFoundationalProvidence';
import { useCompassGuide } from '@/hooks/useCompassGuide';
import { useCompassSessionEngine } from '@/hooks/useCompassSessionEngine';
import { useCompassUserState } from '@/hooks/useCompassUserState';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

/** Routes where the compass should not appear */
const HIDDEN_ROUTES = ['/onboarding', '/sponsored-setup'];

export function AIChatButton() {
  const { t } = useTranslation('common');
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();
  const glowing = useCompassGlow(isOpen);
  useCompassAutoOpen(isOpen, setIsOpen);
  useFoundationalProvidence();
  const compassGuide = useCompassGuide(isOpen, setIsOpen);

  // Listen for system errors and auto-open compass to reassure user
  const handleSystemError = useCallback(() => {
    if (!isOpen) {
      setIsOpen(true);
    }
  }, [isOpen, setIsOpen]);

  useEffect(() => {
    window.addEventListener('cros:system-error', handleSystemError);
    return () => window.removeEventListener('cros:system-error', handleSystemError);
  }, [handleSystemError]);

  // Hide on onboarding routes
  const hidden = HIDDEN_ROUTES.some(r => location.pathname.startsWith(r));

  // Signal-aware glow: show subtle indicator when undismissed nudges exist and drawer is closed
  const { nudges } = useCompassSessionEngine();
  const { dismissedIds } = useCompassUserState();
  const hasUndismissedSignals = !isOpen && nudges.some(n => !dismissedIds.has(n.id));

  if (hidden) return null;

  return (
    <>
      <Button
        onClick={() => setIsOpen(true)}
        size="icon"
        aria-label={t('accessibility.openCrosCompanion')}
        className={cn(
          "fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg",
          "bg-primary hover:bg-primary/90",
          "transition-transform hover:scale-105",
          "z-50",
          glowing && "compass-glow",
          hasUndismissedSignals && !glowing && "ring-2 ring-primary/30 ring-offset-2 ring-offset-background"
        )}
      >
        <Compass className="h-6 w-6" />
        <span className="sr-only">{t('accessibility.openCrosCompanion')}</span>
      </Button>

      <AIChatDrawer
        open={isOpen}
        onOpenChange={setIsOpen}
        guideEntry={compassGuide.currentGuideAlways}
        onDismissGuide={compassGuide.completeGuide}
      />
    </>
  );
}
