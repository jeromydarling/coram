/**
 * InsightRoleSelector — Role selector block embedded in insight essays.
 *
 * WHAT: Compact role selector showing all three CROS roles with links.
 * WHERE: Inside /insights/:slug pages.
 * WHY: Creates identity anchor within essay content for deeper engagement.
 */
import { Link } from 'react-router-dom';
import { Compass, HeartHandshake, MapPin } from 'lucide-react';

const roles = [
  { key: 'shepherd', label: 'Shepherd', subtitle: 'Keep the story', Icon: Compass, to: '/roles/shepherd' },
  { key: 'companion', label: 'Companion', subtitle: 'Keep the thread', Icon: HeartHandshake, to: '/roles/companion' },
  { key: 'visitor', label: 'Visitor', subtitle: 'Keep the witness', Icon: MapPin, to: '/roles/visitor' },
];

interface InsightRoleSelectorProps {
  /** Optional: highlight a specific role */
  activeRole?: 'shepherd' | 'companion' | 'visitor';
}

export default function InsightRoleSelector({ activeRole }: InsightRoleSelectorProps) {
  return (
    <div className="my-10 rounded-2xl border border-[hsl(var(--marketing-border))] bg-[hsl(var(--marketing-surface))] p-5 sm:p-6">
      <p className="text-xs font-medium text-[hsl(var(--marketing-navy)/0.5)] uppercase tracking-wider mb-4">
        Which role resonates?
      </p>
      <div className="grid gap-2 sm:grid-cols-3">
        {roles.map(({ key, label, subtitle, Icon, to }) => {
          const isActive = activeRole === key;
          return (
            <Link
              key={key}
              to={to}
              className={`group flex items-center gap-3 rounded-xl border px-4 py-3 transition-all ${
                isActive
                  ? 'border-[hsl(var(--marketing-blue)/0.4)] bg-white shadow-sm'
                  : 'border-transparent hover:border-[hsl(var(--marketing-border))] hover:bg-white'
              }`}
            >
              <Icon
                className={`h-4.5 w-4.5 shrink-0 ${
                  isActive
                    ? 'text-[hsl(var(--marketing-blue))]'
                    : 'text-[hsl(var(--marketing-navy)/0.35)] group-hover:text-[hsl(var(--marketing-blue))]'
                } transition-colors`}
              />
              <div className="min-w-0">
                <span className="text-sm font-medium text-[hsl(var(--marketing-navy))] block">
                  {label}
                </span>
                <span className="text-xs text-[hsl(var(--marketing-navy)/0.45)]">
                  {subtitle}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
