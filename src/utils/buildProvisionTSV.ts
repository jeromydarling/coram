/**
 * Builds a TSV (tab-separated values) string for a provision and its items.
 * One row per provision_item. Invoice-level fields repeat on every row.
 */

export interface ProvisionForTSV {
  invoice_type?: string | null;
  invoice_date?: string | null;
  business_unit?: string | null;
  client_id?: string | null;
  business_name?: string | null;
  business_address?: string | null;
  business_city?: string | null;
  business_state?: string | null;
  business_zip?: string | null;
  contact_name?: string | null;
  contact_email?: string | null;
  payment_due_date?: string | null;
  paid?: boolean;
  date_paid?: string | null;
}

export interface ProvisionItemForTSV {
  product_name?: string | null;
  item_name?: string | null;
  gl_account?: string | null;
  quantity: number;
  unit_price_cents: number;
}

export interface BuildTSVOptions {
  includeHeader?: boolean;
}

const HEADERS = [
  'Type',
  'Invoice Date',
  'Requested by',
  'Business Unit',
  'Client ID',
  'Business Name',
  'Address',
  'City',
  'State',
  'Zip',
  'Contact Name',
  'Email Address',
  'Product Name',
  'G/L Account',
  'Quantity',
  'Cost Per Unit',
  'Total',
  'Payment Due Date',
  'Timestamp',
  'Paid',
  'Date Paid',
] as const;

/** Remove tabs, newlines, and collapse repeated whitespace */
function sanitize(value: string | null | undefined): string {
  if (value == null) return '';
  return String(value).replace(/[\t\r\n]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
}

function formatDate(d: string | null | undefined): string {
  if (!d) return '';
  // Already YYYY-MM-DD? Return as-is. Otherwise try to parse.
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
  try {
    const parsed = new Date(d);
    if (isNaN(parsed.getTime())) return '';
    return parsed.toISOString().slice(0, 10);
  } catch {
    return '';
  }
}

function formatMoney(cents: number): string {
  return (cents / 100).toFixed(2);
}

export function buildProvisionTSV(
  provision: ProvisionForTSV,
  items: ProvisionItemForTSV[],
  requestedByLabel: string,
  opts?: BuildTSVOptions,
): string {
  const includeHeader = opts?.includeHeader !== false;
  const timestamp = new Date().toISOString();
  const lines: string[] = [];

  if (includeHeader) {
    lines.push(HEADERS.join('\t'));
  }

  for (const item of items) {
    const qty = item.quantity;
    const unitCents = item.unit_price_cents;
    const lineTotalCents = qty * unitCents;
    const productName = sanitize(item.product_name || item.item_name);

    const cells: string[] = [
      sanitize(provision.invoice_type || 'Due'),
      formatDate(provision.invoice_date),
      sanitize(requestedByLabel),
      sanitize(provision.business_unit),
      sanitize(provision.client_id),
      sanitize(provision.business_name),
      sanitize(provision.business_address),
      sanitize(provision.business_city),
      sanitize(provision.business_state),
      sanitize(provision.business_zip),
      sanitize(provision.contact_name),
      sanitize(provision.contact_email),
      productName,
      sanitize(item.gl_account),
      String(qty),
      formatMoney(unitCents),
      formatMoney(lineTotalCents),
      formatDate(provision.payment_due_date),
      timestamp,
      provision.paid ? 'TRUE' : 'FALSE',
      formatDate(provision.date_paid),
    ];

    lines.push(cells.join('\t'));
  }

  return lines.join('\n');
}

export { HEADERS };
