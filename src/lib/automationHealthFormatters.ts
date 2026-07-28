import { formatDistanceToNow, format } from 'date-fns';

export function formatDuration(seconds: number | null): string {
  if (seconds == null) return '—';
  if (seconds < 1) return '<1s';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
}

export function formatErrorRate(rate: number | null): string {
  if (rate == null) return '0%';
  return `${rate}%`;
}

export function formatTimestamp(ts: string | null): string {
  if (!ts) return '—';
  return format(new Date(ts), 'MMM d, HH:mm:ss');
}

export function formatRelativeTime(ts: string | null): string {
  if (!ts) return '—';
  return formatDistanceToNow(new Date(ts), { addSuffix: true });
}

export function truncateError(msg: string | null, maxLen = 80): string {
  if (!msg) return '—';
  return msg.length > maxLen ? msg.slice(0, maxLen) + '…' : msg;
}

export function workflowLabel(key: string): string {
  const labels: Record<string, string> = {
    partner_enrich: 'Partner Enrich',
    opportunity_monitor: 'Opportunity Monitor',
    recommendations_generate: 'Recommendations',
    watchlist_ingest: 'Watchlist Ingest',
    watchlist_diff: 'Watchlist Diff',
  };
  return labels[key] || key;
}

export type StatusVariant = 'default' | 'secondary' | 'destructive' | 'outline';

export function statusVariant(status: string): StatusVariant {
  switch (status) {
    case 'processed': return 'default';
    case 'error':
    case 'failed_timeout': return 'destructive';
    case 'dispatched':
    case 'running': return 'secondary';
    case 'deduped':
    case 'skipped_due_to_cap':
    case 'throttled':
    case 'rate_limited':
      return 'outline';
    default: return 'outline';
  }
}

/** Human-readable status label for clarity */
export function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    processed: 'Processed',
    error: 'Error',
    dispatched: 'Dispatched',
    running: 'Running',
    queued: 'Queued',
    deduped: 'Deduped (no change)',
    skipped_due_to_cap: 'Skipped (cap)',
    processing: 'Processing',
    throttled: 'Throttled (concurrency)',
    rate_limited: 'Rate limited',
    failed_timeout: 'Failed (timeout)',
  };
  return labels[status] || status;
}
