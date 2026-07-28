/**
 * RoleSelector — Gentle inline role identity picker for marketing pages.
 *
 * WHAT: Lets visitors select which role resonates with them.
 * WHERE: /roles, /manifesto, /archetypes.
 * WHY: Identity-based narrative flows — visitors feel recognized before sold to.
 */
import { Compass, HeartHandshake, MapPin, Shield } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useMarketingRole, type MarketingRole } from '@/contexts/RoleContext';
import { cn } from '@/lib/utils';

const roleIconMap: { key: MarketingRole; Icon: React.ComponentType<{ className?: string }> }[] = [
  { key: 'shepherd', Icon: Compass },
  { key: 'companion', Icon: HeartHandshake },
  { key: 'visitor', Icon: MapPin },
  { key: 'leader', Icon: Shield },
];

export default function RoleSelector() {
  const { t } = useTranslation('marketing');
  const { role, setRole } = useMarketingRole();

  return (
    <div className="py-8">
      <p className="text-sm text-[hsl(var(--marketing-navy)/0.5)] text-center mb-4">
        {t('roleSelector.prompt')}
      </p>
      <div className="flex flex-wrap justify-center gap-2.5">
        {roleIconMap.map(({ key, Icon }) => (
          <button
            key={key}
            onClick={() => setRole(role === key ? null : key)}
            className={cn(
              'inline-flex items-center gap-2 px-4 py-2.5 rounded-full border text-sm transition-all',
              role === key
                ? 'bg-[hsl(var(--marketing-navy))] text-white border-[hsl(var(--marketing-navy))]'
                : 'bg-white text-[hsl(var(--marketing-navy)/0.7)] border-[hsl(var(--marketing-navy)/0.15)] hover:border-[hsl(var(--marketing-navy)/0.3)] hover:bg-[hsl(var(--marketing-surface))]'
            )}
          >
            <Icon className="h-4 w-4" />
            {t(`roleSelector.roles.${key}`)}
          </button>
        ))}
      </div>
      {role && (
        <p className="text-xs text-[hsl(var(--marketing-navy)/0.4)] text-center mt-3 animate-in fade-in">
          {t('roleSelector.adaptNote')}
        </p>
      )}
    </div>
  );
}
