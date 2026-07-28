import type { CampaignAudienceMember } from '@/hooks/useCampaignAudience';

/**
 * Export campaign recipients as CSV and trigger browser download.
 */
export function exportRecipientsCSV(
  recipients: CampaignAudienceMember[],
  filename?: string
) {
  if (recipients.length === 0) return;

  const headers = [
    'email',
    'name',
    'status',
    'source',
    'error_message',
    'sent_at',
    'provider_message_id',
  ];

  const rows = recipients.map((r) => [
    r.email,
    r.name ?? '',
    r.status,
    r.source,
    (r.error_message ?? '').replace(/"/g, '""'),
    r.sent_at ?? '',
    r.provider_message_id ?? '',
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map((row) => row.map((v) => `"${v}"`).join(',')),
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download =
    filename ?? `campaign-recipients-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
