/**
 * FoundingGardenBadge — Subtle badge for Founding Garden members.
 *
 * WHAT: Displays a calm recognition badge for early adopter tenants.
 * WHERE: Settings header, Communio profile, Gardener Nexus.
 * WHY: Recognition without exclusivity — honoring early co-builders.
 */

import { Sprout } from 'lucide-react';

interface FoundingGardenBadgeProps {
  className?: string;
}

export function FoundingGardenBadge({ className = '' }: FoundingGardenBadgeProps) {
  return (
    <div
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/5 border border-primary/15 ${className}`}
    >
      <Sprout className="w-3.5 h-3.5 text-primary" />
      <span
        className="text-xs font-medium text-primary"
        style={{ fontFamily: 'Georgia, serif' }}
      >
        Founding Garden Member
      </span>
    </div>
  );
}
