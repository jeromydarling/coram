/**
 * ConnectionStatusBadge — Shows integration connection state.
 *
 * WHAT: Small status badge (connected / disconnected / error).
 * WHERE: IntegrationCard, admin views.
 * WHY: Quick visual indicator of integration health.
 */

import { cn } from '@/lib/utils';

interface ConnectionStatusBadgeProps {
  status: 'connected' | 'disconnected' | 'error';
}

const statusConfig = {
  connected: { label: 'Connected', className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  disconnected: { label: 'Not connected', className: 'bg-muted text-muted-foreground' },
  error: { label: 'Error', className: 'bg-destructive/10 text-destructive' },
};

export function ConnectionStatusBadge({ status }: ConnectionStatusBadgeProps) {
  const config = statusConfig[status];
  return (
    <span className={cn('inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium', config.className)}>
      <span className={cn(
        'w-1.5 h-1.5 rounded-full',
        status === 'connected' && 'bg-green-500',
        status === 'disconnected' && 'bg-muted-foreground',
        status === 'error' && 'bg-destructive',
      )} />
      {config.label}
    </span>
  );
}
