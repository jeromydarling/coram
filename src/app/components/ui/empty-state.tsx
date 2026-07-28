/**
 * EmptyState — Reusable empty state with icon, message, and optional action.
 *
 * WHAT: A calm, narrative-first empty state for lists, panels, and pages.
 * WHERE: Used anywhere data might be empty (contacts, activities, filters, etc.).
 * WHY: Empty states are an opportunity to guide, not to frustrate.
 */
import { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { LucideIcon, Inbox } from 'lucide-react';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  children?: ReactNode;
  className?: string;
  compact?: boolean;
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  actionLabel,
  onAction,
  children,
  className,
  compact = false,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center',
        compact ? 'py-6 px-4' : 'py-12 px-6',
        className
      )}
    >
      <div
        className={cn(
          'rounded-full bg-muted flex items-center justify-center mb-4',
          compact ? 'h-10 w-10' : 'h-14 w-14'
        )}
      >
        <Icon className={cn('text-muted-foreground', compact ? 'h-5 w-5' : 'h-7 w-7')} />
      </div>
      <h3 className={cn('font-medium text-foreground', compact ? 'text-sm' : 'text-base')}>
        {title}
      </h3>
      {description && (
        <p className={cn('text-muted-foreground mt-1 max-w-sm', compact ? 'text-xs' : 'text-sm')}>
          {description}
        </p>
      )}
      {actionLabel && onAction && (
        <Button
          variant="outline"
          size={compact ? 'sm' : 'default'}
          onClick={onAction}
          className="mt-4"
        >
          {actionLabel}
        </Button>
      )}
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}
