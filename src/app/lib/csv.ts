import Papa from 'papaparse';

export interface CSVParseResult {
  headers: string[];
  rows: Record<string, string>[];
  errors: Papa.ParseError[];
}

export function parseCSV(file: File): Promise<CSVParseResult> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        resolve({
          headers: results.meta.fields || [],
          rows: results.data as Record<string, string>[],
          errors: results.errors
        });
      },
      error: (error) => {
        reject(error);
      }
    });
  });
}

export function generateCSV<T extends Record<string, unknown>>(
  data: T[],
  columns: { key: keyof T; label: string }[]
): string {
  const headers = columns.map(col => col.label);
  const rows = data.map(row =>
    columns.map(col => {
      const value = row[col.key];
      if (value === null || value === undefined) return '';
      if (typeof value === 'boolean') return value ? 'Yes' : 'No';
      return String(value);
    })
  );

  return Papa.unparse({
    fields: headers,
    data: rows
  });
}

export function downloadCSV(csvContent: string, filename: string): void {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Field definitions for import mapping
export const contactFields = [
  { key: 'name', label: 'Name', required: true },
  { key: 'organization', label: 'Organization', required: false },
  { key: 'stage', label: 'Stage', required: false },
  { key: 'metro', label: 'Metro', required: false },
  { key: 'partner_tiers', label: 'Partner Tiers', required: false },
  { key: 'mission_snapshot', label: 'Mission Snapshot', required: false },
  { key: 'best_partnership_angle', label: 'Best Partnership Angle', required: false },
  { key: 'grant_alignment', label: 'Grant Alignment', required: false },
  { key: 'title', label: 'Title', required: false },
  { key: 'email', label: 'Email', required: false },
  { key: 'phone', label: 'Phone', required: false },
  { key: 'is_primary', label: 'Primary Contact', required: false },
  { key: 'notes', label: 'Notes', required: false },
] as const;

export const eventFields = [
  { key: 'event_name', label: 'Event Name', required: true },
  { key: 'event_date', label: 'Event Date', required: true },
  { key: 'event_type', label: 'Event Type', required: true },
  { key: 'staff_deployed', label: 'Staff Deployed', required: false },
  { key: 'households_served', label: 'Households Served', required: false },
  { key: 'devices_distributed', label: 'Devices Distributed', required: false },
  { key: 'internet_signups', label: 'Internet Signups', required: false },
  { key: 'referrals_generated', label: 'Referrals Generated', required: false },
  { key: 'cost_estimated', label: 'Cost Estimated', required: false },
  { key: 'anchor_identified_yn', label: 'Anchor Identified', required: false },
  { key: 'followup_meeting_yn', label: 'Followup Meeting', required: false },
  { key: 'grant_narrative_value', label: 'Grant Narrative Value', required: false },
  { key: 'notes', label: 'Notes', required: false },
] as const;

// Export column definitions
export const contactExportColumns = [
  { key: 'name' as const, label: 'Name' },
  { key: 'organization' as const, label: 'Organization' },
  { key: 'stage' as const, label: 'Stage' },
  { key: 'metro' as const, label: 'Metro' },
  { key: 'partner_tiers' as const, label: 'Partner Tiers' },
  { key: 'mission_snapshot' as const, label: 'Mission Snapshot' },
  { key: 'best_partnership_angle' as const, label: 'Best Partnership Angle' },
  { key: 'grant_alignment' as const, label: 'Grant Alignment' },
  { key: 'title' as const, label: 'Title' },
  { key: 'email' as const, label: 'Email' },
  { key: 'phone' as const, label: 'Phone' },
  { key: 'is_primary' as const, label: 'Primary Contact' },
  { key: 'notes' as const, label: 'Notes' },
];

export const eventExportColumns = [
  { key: 'event_name' as const, label: 'Event Name' },
  { key: 'event_date' as const, label: 'Event Date' },
  { key: 'event_type' as const, label: 'Event Type' },
  { key: 'staff_deployed' as const, label: 'Staff Deployed' },
  { key: 'households_served' as const, label: 'Households Served' },
  { key: 'devices_distributed' as const, label: 'Devices Distributed' },
  { key: 'internet_signups' as const, label: 'Internet Signups' },
  { key: 'referrals_generated' as const, label: 'Referrals Generated' },
  { key: 'cost_estimated' as const, label: 'Cost Estimated' },
  { key: 'anchor_identified_yn' as const, label: 'Anchor Identified' },
  { key: 'followup_meeting_yn' as const, label: 'Followup Meeting' },
  { key: 'grant_narrative_value' as const, label: 'Grant Narrative Value' },
  { key: 'notes' as const, label: 'Notes' },
];
