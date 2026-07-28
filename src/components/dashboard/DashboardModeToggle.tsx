import { BookOpen, LayoutDashboard } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DashboardMode } from '@/hooks/useDashboardMode';
import { useTranslation } from 'react-i18next';

interface DashboardModeToggleProps {
  mode: DashboardMode;
  onModeChange: (mode: DashboardMode) => void;
}

export function DashboardModeToggle({ mode, onModeChange }: DashboardModeToggleProps) {
  const { t } = useTranslation('dashboard');

  return (
    <div className="inline-flex items-center rounded-lg border bg-muted p-0.5 text-muted-foreground">
      <button
        onClick={() => onModeChange('operational')}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-all',
          mode === 'operational'
            ? 'bg-background text-foreground shadow-sm'
            : 'hover:text-foreground/80'
        )}
      >
        <LayoutDashboard className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">{t('modes.operational')}</span>
      </button>
      <button
        onClick={() => onModeChange('story')}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-all',
          mode === 'story'
            ? 'bg-background text-foreground shadow-sm'
            : 'hover:text-foreground/80'
        )}
      >
        <BookOpen className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">{t('modes.story')}</span>
      </button>
    </div>
  );
}
