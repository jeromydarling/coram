/**
 * GivingCSVImporter — CSV import presets for generosity records.
 *
 * WHAT: Auto-maps common giving CSV export headers to CROS generosity fields.
 * WHERE: Import Center → Generosity tab.
 * WHY: Enables clean migration from bloated donor systems using "Retain core giving history only" mode.
 *
 * Supported presets: Bloomerang, NeonCRM, DonorPerfect, Little Green Light, Generic
 */

import { GenericCSVImporter, type ImportPreviewRow, type ImportResult } from './Importer';

/** Canonical target fields for generosity CSV import */
export const GIVING_TARGET_FIELDS = [
  'gift_date',
  'amount',
  'is_recurring',
  'recurring_interval',
  'note',
  'first_name',
  'last_name',
  'email',
  'phone',
] as const;

/** Common CSV header aliases across all giving platforms */
const GIVING_ALIASES: Record<string, string> = {
  // Date
  'date': 'gift_date',
  'gift date': 'gift_date',
  'gift_date': 'gift_date',
  'donation date': 'gift_date',
  'donationdate': 'gift_date',
  'received on': 'gift_date',
  'received_on': 'gift_date',
  'transaction date': 'gift_date',

  // Amount
  'amount': 'amount',
  'gift amount': 'amount',
  'gift_amount': 'amount',
  'donation amount': 'amount',
  'total': 'amount',

  // Recurring
  'recurring': 'is_recurring',
  'is recurring': 'is_recurring',
  'is_recurring': 'is_recurring',
  'isrecurring': 'is_recurring',
  'pledgor': 'is_recurring',

  // Interval
  'frequency': 'recurring_interval',
  'recurring interval': 'recurring_interval',
  'recurring_interval': 'recurring_interval',
  'recurring period': 'recurring_interval',
  'recurringperiod': 'recurring_interval',

  // Note
  'note': 'note',
  'notes': 'note',
  'memo': 'note',
  'fund': 'note',
  'fund name': 'note',
  'fund_name': 'note',
  'campaign': 'note',
  'campaign name': 'note',
  'campaign_name': 'note',
  'designation': 'note',

  // Person identification
  'first name': 'first_name',
  'firstname': 'first_name',
  'first_name': 'first_name',
  'last name': 'last_name',
  'lastname': 'last_name',
  'last_name': 'last_name',
  'email': 'email',
  'email address': 'email',
  'phone': 'phone',
};

function normalizeHeader(h: string): string {
  return h.toLowerCase().trim().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
}

export class GivingCSVImporter extends GenericCSVImporter {
  detect(headers: string[], sourceSystem: string): boolean {
    if (sourceSystem === 'giving_csv') return true;
    // Auto-detect by checking for giving-specific columns
    const givingSignals = ['amount', 'gift date', 'donation date', 'gift_date', 'received_on', 'fund'];
    const normalizedHeaders = headers.map(normalizeHeader);
    return givingSignals.filter(s => normalizedHeaders.includes(s)).length >= 2;
  }

  map(headers: string[]): Record<string, string> {
    const result: Record<string, string> = {};
    for (const h of headers) {
      const normalized = normalizeHeader(h);
      if (GIVING_ALIASES[normalized]) {
        result[h] = GIVING_ALIASES[normalized];
      }
    }
    return result;
  }

  preview(
    data: Record<string, string>[],
    mapping: Record<string, string>,
    limit = 20
  ): ImportPreviewRow[] {
    return data.slice(0, limit).map(row => {
      const mapped: Record<string, unknown> = {};
      for (const [src, tgt] of Object.entries(mapping)) {
        if (tgt && row[src] != null) mapped[tgt] = row[src];
      }
      // Parse amount as number for preview
      if (mapped.amount) {
        const num = Number(String(mapped.amount).replace(/[$,]/g, ''));
        mapped.amount = isNaN(num) ? 0 : num;
      }
      // Normalize recurring boolean
      if (mapped.is_recurring) {
        const val = String(mapped.is_recurring).toLowerCase();
        mapped.is_recurring = ['true', 'yes', 'y', '1'].includes(val);
      }
      return { action: 'create' as const, data: mapped };
    });
  }
}

/** Bloomerang CSV export preset */
export class BloomerangGivingImporter extends GivingCSVImporter {
  private readonly BLOOMERANG_MAP: Record<string, string> = {
    'Date': 'gift_date',
    'Amount': 'amount',
    'Type': '_type',
    'Fund': 'note',
    'FundName': 'note',
    'CampaignName': 'note',
    'Note': 'note',
    'IsRecurring': 'is_recurring',
    'Frequency': 'recurring_interval',
    'First Name': 'first_name',
    'Last Name': 'last_name',
    'Email': 'email',
  };

  detect(headers: string[], sourceSystem: string): boolean {
    if (sourceSystem === 'bloomerang_giving') return true;
    const signals = ['FundName', 'CampaignName', 'IsRecurring', 'Designations'];
    return signals.some(c => headers.includes(c));
  }

  map(headers: string[]): Record<string, string> {
    const result: Record<string, string> = {};
    for (const h of headers) {
      if (this.BLOOMERANG_MAP[h]) {
        result[h] = this.BLOOMERANG_MAP[h];
      }
    }
    // Fallback to generic aliases
    if (Object.keys(result).length < 2) return super.map(headers);
    return result;
  }
}

/** NeonCRM CSV export preset */
export class NeonCRMGivingImporter extends GivingCSVImporter {
  private readonly NEON_MAP: Record<string, string> = {
    'Donation Date': 'gift_date',
    'donationDate': 'gift_date',
    'Amount': 'amount',
    'amount': 'amount',
    'Donation Status': '_status',
    'donationStatus': '_status',
    'Campaign Name': 'note',
    'Fund Name': 'note',
    'Purpose Name': 'note',
    'Recurring': 'is_recurring',
    'recurringDonationId': 'is_recurring',
    'Recurring Period': 'recurring_interval',
    'recurringPeriod': 'recurring_interval',
    'First Name': 'first_name',
    'Last Name': 'last_name',
    'Email': 'email',
  };

  detect(headers: string[], sourceSystem: string): boolean {
    if (sourceSystem === 'neoncrm_giving') return true;
    const signals = ['donationDate', 'Donation Date', 'donationStatus', 'Donation Status'];
    return signals.some(c => headers.includes(c));
  }

  map(headers: string[]): Record<string, string> {
    const result: Record<string, string> = {};
    for (const h of headers) {
      if (this.NEON_MAP[h]) result[h] = this.NEON_MAP[h];
    }
    if (Object.keys(result).length < 2) return super.map(headers);
    return result;
  }
}

/** DonorPerfect CSV export preset */
export class DonorPerfectGivingImporter extends GivingCSVImporter {
  private readonly DP_MAP: Record<string, string> = {
    'gift_date': 'gift_date',
    'Gift Date': 'gift_date',
    'amount': 'amount',
    'Amount': 'amount',
    'record_type': '_type',
    'gl_code': 'note',
    'GL Code': 'note',
    'campaign': 'note',
    'Campaign': 'note',
    'solicit_code': 'note',
    'memo': 'note',
    'Memo': 'note',
    'pledgor': 'is_recurring',
    'fmv': 'recurring_interval',
    'First Name': 'first_name',
    'Last Name': 'last_name',
    'Email': 'email',
  };

  detect(headers: string[], sourceSystem: string): boolean {
    if (sourceSystem === 'donorperfect_giving') return true;
    const signals = ['gift_date', 'record_type', 'gl_code', 'solicit_code'];
    return signals.filter(c => headers.includes(c)).length >= 2;
  }

  map(headers: string[]): Record<string, string> {
    const result: Record<string, string> = {};
    for (const h of headers) {
      if (this.DP_MAP[h]) result[h] = this.DP_MAP[h];
    }
    if (Object.keys(result).length < 2) return super.map(headers);
    return result;
  }
}

/** Little Green Light CSV export preset */
export class LGLGivingImporter extends GivingCSVImporter {
  private readonly LGL_MAP: Record<string, string> = {
    'Received On': 'gift_date',
    'received_on': 'gift_date',
    'Amount': 'amount',
    'amount': 'amount',
    'Campaign Name': 'note',
    'campaign_name': 'note',
    'Fund Name': 'note',
    'fund_name': 'note',
    'Appeal Name': 'note',
    'appeal_name': 'note',
    'Note': 'note',
    'note': 'note',
    'Is Recurring': 'is_recurring',
    'is_recurring': 'is_recurring',
    'Recurring Interval': 'recurring_interval',
    'recurring_interval': 'recurring_interval',
    'First Name': 'first_name',
    'Last Name': 'last_name',
    'Email': 'email',
  };

  detect(headers: string[], sourceSystem: string): boolean {
    if (sourceSystem === 'lgl_giving') return true;
    const signals = ['received_on', 'Received On', 'fund_name', 'Fund Name', 'appeal_name'];
    return signals.some(c => headers.includes(c));
  }

  map(headers: string[]): Record<string, string> {
    const result: Record<string, string> = {};
    for (const h of headers) {
      if (this.LGL_MAP[h]) result[h] = this.LGL_MAP[h];
    }
    if (Object.keys(result).length < 2) return super.map(headers);
    return result;
  }
}
