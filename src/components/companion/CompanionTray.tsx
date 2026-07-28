/**
 * CompanionTray — Container for Narrative Companion Mode guidance.
 *
 * WHAT: Fixed bottom-right tray showing at most one MicroGuidanceCard.
 * WHERE: Rendered in MainLayout when companion mode is active.
 * WHY: Consistent, non-intrusive placement that never blocks work.
 */
import { useTranslation } from 'react-i18next';
import { useNarrativeCompanion } from '@/hooks/useNarrativeCompanion';
import { MicroGuidanceCard } from './MicroGuidanceCard';

export function CompanionTray() {
  const { t } = useTranslation('narrative');
  const { activeGuide, acceptGuide, dismissGuide, isActive } = useNarrativeCompanion();

  if (!isActive || !activeGuide) return null;

  return (
    <div
      className="fixed bottom-4 right-4 z-40 pointer-events-auto"
      aria-label={t('companionTray.ariaLabel')}
      data-testid="companion-tray"
    >
      <MicroGuidanceCard
        guide={activeGuide}
        onAccept={acceptGuide}
        onDismiss={() => dismissGuide(false)}
      />
    </div>
  );
}
