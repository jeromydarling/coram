/**
 * Shared configuration for volunteer reliability labels.
 * Thresholds are in days since last volunteered.
 */
export const RELIABILITY_THRESHOLDS = [
  { maxDays: 14, label: 'Recent helper', className: 'text-green-600' },
  { maxDays: 30, label: 'Steady helper', className: 'text-blue-600' },
  { maxDays: 90, label: 'Returning soon', className: 'text-amber-600' },
] as const;

export const RELIABILITY_DEFAULT = {
  label: 'Returning soon',
  className: 'text-muted-foreground',
} as const;

export const RELIABILITY_NEW = {
  label: 'New volunteer',
  className: 'text-muted-foreground',
} as const;

/** Max rows to render in Import Center preview */
export const IMPORT_PREVIEW_MAX_ROWS = 200;

/** Max CSV rows allowed for preview (prevent browser hang) */
export const IMPORT_CSV_MAX_ROWS = 50_000;
