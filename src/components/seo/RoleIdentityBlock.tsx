/**
 * RoleIdentityBlock — Interactive role identity selector for marketing pages.
 *
 * WHAT: "I am a..." role selector that links to role landing pages.
 * WHERE: Embedded in /manifesto, /nri, /archetypes, and insight pages.
 * WHY: Creates identity anchors that help visitors self-select and deepen engagement.
 */
import { Link } from 'react-router-dom';
import { Compass, HeartHandshake, MapPin, Users } from 'lucide-react';

const roles = [
  { key: 'shepherd', label: 'Shepherd', Icon: Compass, to: '/roles/shepherd' },
  { key: 'companion', label: 'Companion', Icon: HeartHandshake, to: '/roles/companion' },
  { key: 'visitor', label: 'Visitor', Icon: MapPin, to: '/roles/visitor' },
];

interface RoleIdentityBlockProps {
  /** Optional heading override */
  heading?: string;
}

export default function RoleIdentityBlock({
  heading = 'I serve as a...',
}: RoleIdentityBlockProps) {
  return (
    <div className="my-12 py-8 px-6 rounded-2xl border border-[hsl(var(--marketing-border))] bg-[hsl(var(--marketing-surface))]">
      <p
        className="text-sm font-medium text-[hsl(var(--marketing-navy)/0.5)] uppercase tracking-wider mb-4 text-center"
      >
        {heading}
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        {roles.map(({ key, label, Icon, to }) => (
          <Link
            key={key}
            to={to}
            className="group flex items-center gap-2.5 rounded-full border border-[hsl(var(--marketing-border))] bg-white px-5 py-2.5 hover:border-[hsl(var(--marketing-blue)/0.4)] hover:shadow-sm transition-all"
          >
            <Icon className="h-4 w-4 text-[hsl(var(--marketing-blue))] shrink-0" />
            <span className="text-sm font-medium text-[hsl(var(--marketing-navy))] group-hover:text-[hsl(var(--marketing-blue))] transition-colors">
              {label}
            </span>
          </Link>
        ))}
        <Link
          to="/roles"
          className="group flex items-center gap-2.5 rounded-full border border-dashed border-[hsl(var(--marketing-navy)/0.15)] bg-white px-5 py-2.5 hover:border-[hsl(var(--marketing-blue)/0.3)] transition-all"
        >
          <Users className="h-4 w-4 text-[hsl(var(--marketing-navy)/0.4)] shrink-0" />
          <span className="text-sm text-[hsl(var(--marketing-navy)/0.5)] group-hover:text-[hsl(var(--marketing-blue))] transition-colors">
            See all roles
          </span>
        </Link>
      </div>
    </div>
  );
}
