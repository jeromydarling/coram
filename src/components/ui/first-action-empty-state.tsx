/**
 * FirstActionEmptyState — Opinionated zero-state with ONE clear next action.
 *
 * WHAT: Thin wrapper around EmptyState that enforces the pre-mortem rule:
 *       every empty list/page gets one primary CTA + one-line context.
 *       No poetry, no multiple choices, no dead-ends.
 * WHERE: Use on every zero-state list page — People, Partners, Reflections,
 *        Provisions, Volunteers, Local Pulse, etc.
 * WHY: Onboarding cliff #1 was users landing on empty surfaces with no
 *      obvious next step. This component guarantees there always is one.
 */
import { LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';

interface FirstActionEmptyStateProps {
  /** Icon shown above the title. Use a Lucide icon that matches the surface. */
  icon?: LucideIcon;
  /** Short title — what's missing. e.g. "No people yet". */
  title: string;
  /** ONE sentence of context. Keep it under ~80 chars. No poetry. */
  context: string;
  /** Primary CTA label. e.g. "Add your first person". */
  actionLabel: string;
  /** Either a route (handled by react-router Link) OR an onClick handler. */
  actionTo?: string;
  onAction?: () => void;
  className?: string;
}

export function FirstActionEmptyState({
  icon,
  title,
  context,
  actionLabel,
  actionTo,
  onAction,
  className,
}: FirstActionEmptyStateProps) {
  return (
    <EmptyState
      icon={icon}
      title={title}
      description={context}
      className={className}
    >
      {actionTo ? (
        <Button asChild className="rounded-full">
          <Link to={actionTo}>{actionLabel}</Link>
        </Button>
      ) : (
        <Button onClick={onAction} className="rounded-full">
          {actionLabel}
        </Button>
      )}
    </EmptyState>
  );
}
