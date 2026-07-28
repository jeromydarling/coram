import type { AutomationRunDetail } from '@/hooks/useRunDetail';
import { workflowLabel, statusLabel, formatTimestamp, formatDuration } from '@/lib/automationHealthFormatters';
import { isBillableStatus } from '@/hooks/useRunDetail';

/**
 * Export filtered runs as CSV and trigger browser download.
 */
export function exportRunsCSV(runs: AutomationRunDetail[], filename?: string) {
  if (runs.length === 0) return;

  const headers = [
    'run_id',
    'workflow',
    'status',
    'billable',
    'org_id',
    'org_name',
    'created_at',
    'processed_at',
    'duration_seconds',
    'error_message',
    'triggered_by',
    'parent_run_id',
  ];

  const rows = runs.map((r) => {
    const durSec = r.processed_at
      ? ((new Date(r.processed_at).getTime() - new Date(r.created_at).getTime()) / 1000).toFixed(1)
      : '';
    return [
      r.run_id,
      workflowLabel(r.workflow_key),
      statusLabel(r.status),
      isBillableStatus(r.status) ? 'Yes' : 'No',
      r.org_id ?? '',
      r.org_name ?? '',
      r.created_at,
      r.processed_at ?? '',
      durSec,
      (r.error_message ?? '').replace(/"/g, '""'),
      r.triggered_by ?? '',
      r.parent_run_id ?? '',
    ];
  });

  const csvContent = [
    headers.join(','),
    ...rows.map((row) => row.map((v) => `"${v}"`).join(',')),
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename ?? `automation-runs-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
