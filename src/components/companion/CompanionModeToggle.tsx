/**
 * CompanionModeToggle — Inline toggle for Narrative Companion Mode.
 *
 * WHAT: Switch component for enabling/disabling companion mode.
 * WHERE: User menu dropdown, Settings page.
 * WHY: Big, clear, user-controlled switch — never hidden.
 */
import { Switch } from '@/components/ui/switch';
import { useCompanionMode } from '@/hooks/useCompanionMode';
import { Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface CompanionModeToggleProps {
  variant?: 'menu' | 'card';
}

export function CompanionModeToggle({ variant = 'menu' }: CompanionModeToggleProps) {
  const { t } = useTranslation('common');
  const { enabled, allowedByTenant, toggle, isToggling } = useCompanionMode();

  if (!allowedByTenant) {
    if (variant === 'menu') return null;
    return (
      <p className="text-xs text-muted-foreground italic">
        {t('companion.pausedBySteward')}
      </p>
    );
  }

  if (variant === 'menu') {
    return (
      <div
        className="flex items-center gap-3 px-2 py-2 cursor-pointer"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          toggle(!enabled);
        }}
        data-testid="companion-mode-toggle"
      >
        <Sparkles className="w-4 h-4 text-muted-foreground" />
        <div className="flex-1 min-w-0">
          <span className="text-sm">{t('companion.title')}</span>
          <p className="text-[10px] text-muted-foreground leading-tight">
            {t('companion.subtitle')}
          </p>
        </div>
        <Switch
          checked={enabled}
          disabled={isToggling}
          className="scale-75 pointer-events-none"
          tabIndex={-1}
        />
      </div>
    );
  }

  return null;
}
