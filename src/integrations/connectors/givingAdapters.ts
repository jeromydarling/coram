/**
 * Giving Adapters — Platform-specific normalizeGiving() implementations
 *
 * WHAT: Maps raw CRM giving data to CROS NormalizedGiving records.
 * WHERE: Used by Bridge migration harness and API sync runners.
 * WHY: Each donor CRM stores gifts differently; this normalizes to a single shape.
 *
 * Platforms: Bloomerang, NeonCRM, DonorPerfect, Little Green Light
 * Reference: CROS Generosity Records API Guide (March 2026)
 */

import type { NormalizedGiving, MappingWarning } from './types';
import { normalizeDate } from './types';

// ─── Shared helpers ───────────────────────────────────────────

function safeNote(parts: (string | null | undefined)[], maxLen = 500): string | null {
  const joined = parts.filter(Boolean).join(' · ').trim();
  if (!joined) return null;
  return joined.length > maxLen ? joined.slice(0, maxLen - 3) + '...' : joined;
}

const RECURRING_INTERVAL_MAP: Record<string, string> = {
  monthly: 'monthly',
  annually: 'annually',
  yearly: 'annually',
  quarterly: 'quarterly',
  weekly: 'weekly',
  'semi-annually': 'semi-annually',
  'bi-monthly': 'bi-monthly',
  // DonorPerfect codes
  m: 'monthly',
  a: 'annually',
  q: 'quarterly',
  w: 'weekly',
  s: 'semi-annually',
  b: 'bi-monthly',
};

function normalizeInterval(raw: unknown): { interval: string | null; warning: string | null } {
  if (!raw) return { interval: null, warning: null };
  const key = String(raw).toLowerCase().trim();
  const mapped = RECURRING_INTERVAL_MAP[key];
  if (mapped) return { interval: mapped, warning: null };
  return { interval: null, warning: `Unknown recurring interval: ${raw}` };
}

// ─── Bloomerang ───────────────────────────────────────────────

export const bloomerangGivingAdapter = {
  key: 'bloomerang' as const,
  displayName: 'Bloomerang',

  normalizeGiving(raw: Record<string, unknown>): { result: NormalizedGiving | null; warnings: MappingWarning[] } {
    const warnings: MappingWarning[] = [];

    // Filter: only actual donations and recurring payments
    const type = String(raw.Type ?? '');
    if (!['Donation', 'RecurringDonationPayment'].includes(type)) {
      return { result: null, warnings: [{ type: 'normalization', message: `Skipped non-donation type: ${type}` }] };
    }

    const { date, warning: dw } = normalizeDate(raw.Date);
    if (dw) warnings.push({ type: 'invalid_date', message: dw, field: 'Date' });
    if (!date) {
      warnings.push({ type: 'missing_required', message: 'Missing date — record skipped', field: 'Date' });
      return { result: null, warnings };
    }

    if (raw.Amount == null) {
      warnings.push({ type: 'missing_required', message: 'Amount is null', field: 'Amount' });
    }

    // Note: FundName → CampaignName → AppealName → Note (fallback chain)
    const designations = raw.Designations as Array<Record<string, unknown>> | undefined;
    const fundName = designations?.[0]?.FundName as string | undefined;
    const note = safeNote([
      fundName ?? (raw.CampaignName as string) ?? (raw.AppealName as string),
      raw.Note as string,
    ]);

    // Recurring interval from nested object
    const freq = (raw.RecurringDonation as Record<string, unknown>)?.Frequency;
    const { interval, warning: iw } = normalizeInterval(freq);
    if (iw) warnings.push({ type: 'normalization', message: iw, field: 'Frequency' });

    return {
      result: {
        date: date.split('T')[0],
        amount: Number(raw.Amount ?? 0),
        is_recurring: type === 'RecurringDonationPayment',
        recurring_interval: interval,
        note,
        warnings: warnings.map(w => w.message),
      },
      warnings,
    };
  },
};

// ─── NeonCRM ──────────────────────────────────────────────────

export const neonCrmGivingAdapter = {
  key: 'neoncrm' as const,
  displayName: 'NeonCRM',

  normalizeGiving(raw: Record<string, unknown>): { result: NormalizedGiving | null; warnings: MappingWarning[] } {
    const warnings: MappingWarning[] = [];

    // Filter: only succeeded / settled donations
    const status = String(raw.donationStatus ?? '');
    if (!['SUCCEED', 'Settled'].includes(status)) {
      return { result: null, warnings: [{ type: 'normalization', message: `Skipped non-settled donation: ${status}` }] };
    }

    const { date, warning: dw } = normalizeDate(raw.donationDate);
    if (dw) warnings.push({ type: 'invalid_date', message: dw, field: 'donationDate' });
    if (!date) {
      warnings.push({ type: 'missing_required', message: 'Missing donationDate', field: 'donationDate' });
      return { result: null, warnings };
    }

    // Note chain: campaign → fund → purpose → recognition name
    const campaign = (raw.campaign as Record<string, unknown>)?.name as string | undefined;
    const fund = (raw.fund as Record<string, unknown>)?.name as string | undefined;
    const purpose = (raw.purpose as Record<string, unknown>)?.name as string | undefined;
    const recognition = (raw.publicRecognitionName ?? raw.donorNote) as string | undefined;
    const note = safeNote([campaign, fund, purpose, recognition]);

    const isRecurring = raw.recurringDonationId != null;
    const { interval, warning: iw } = normalizeInterval(raw.recurringPeriod);
    if (iw) warnings.push({ type: 'normalization', message: iw, field: 'recurringPeriod' });

    if (raw.recurringPeriod && !raw.recurringDonationId) {
      warnings.push({ type: 'normalization', message: 'recurringPeriod set but no recurringDonationId' });
    }

    return {
      result: {
        date: date.split('T')[0],
        amount: Number(raw.amount ?? 0),
        is_recurring: isRecurring,
        recurring_interval: interval,
        note,
        warnings: warnings.map(w => w.message),
      },
      warnings,
    };
  },
};

// ─── DonorPerfect ─────────────────────────────────────────────

function parseDPDate(raw: string): { date: string; warning: string | null } {
  const parts = raw.split('/');
  if (parts.length !== 3) return { date: '', warning: `Invalid DP date: ${raw}` };
  const [m, d, y] = parts;
  return { date: `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`, warning: null };
}

export const donorPerfectGivingAdapter = {
  key: 'donorperfect' as const,
  displayName: 'DonorPerfect',

  normalizeGiving(raw: Record<string, unknown>): { result: NormalizedGiving | null; warnings: MappingWarning[] } {
    const warnings: MappingWarning[] = [];

    // Filter: D = donation, G = pledge payment
    const recordType = String(raw.record_type ?? '');
    if (!['D', 'G'].includes(recordType)) {
      return { result: null, warnings: [{ type: 'normalization', message: `Skipped record_type: ${recordType}` }] };
    }

    let dateStr = '';
    const giftDate = String(raw.gift_date ?? '');
    if (giftDate.includes('/')) {
      const { date, warning } = parseDPDate(giftDate);
      dateStr = date;
      if (warning) warnings.push({ type: 'invalid_date', message: warning, field: 'gift_date' });
    } else {
      const { date, warning } = normalizeDate(giftDate);
      dateStr = date?.split('T')[0] ?? '';
      if (warning) warnings.push({ type: 'invalid_date', message: warning, field: 'gift_date' });
    }

    if (!dateStr) {
      warnings.push({ type: 'missing_required', message: 'Unparseable gift_date', field: 'gift_date' });
      return { result: null, warnings };
    }

    const note = safeNote([
      raw.gl_code as string,
      raw.campaign as string,
      raw.solicit_code as string,
      raw.memo as string,
    ]);

    const isRecurring = String(raw.pledgor ?? '').toUpperCase() === 'Y';
    const { interval, warning: iw } = normalizeInterval(raw.fmv);
    if (iw) warnings.push({ type: 'normalization', message: iw, field: 'fmv' });

    return {
      result: {
        date: dateStr,
        amount: Number(raw.amount ?? 0),
        is_recurring: isRecurring,
        recurring_interval: interval,
        note,
        warnings: warnings.map(w => w.message),
      },
      warnings,
    };
  },
};

// ─── Little Green Light ───────────────────────────────────────

export const lglGivingAdapter = {
  key: 'lgl' as const,
  displayName: 'Little Green Light',

  normalizeGiving(raw: Record<string, unknown>): { result: NormalizedGiving | null; warnings: MappingWarning[] } {
    const warnings: MappingWarning[] = [];

    const { date, warning: dw } = normalizeDate(raw.received_on);
    if (dw) warnings.push({ type: 'invalid_date', message: dw, field: 'received_on' });
    if (!date) {
      warnings.push({ type: 'missing_required', message: 'Missing received_on', field: 'received_on' });
      return { result: null, warnings };
    }

    const amount = Number(raw.amount);
    if (isNaN(amount)) {
      warnings.push({ type: 'normalization', message: `Non-numeric amount: ${raw.amount}`, field: 'amount' });
    }

    const note = safeNote([
      raw.campaign_name as string,
      raw.fund_name as string,
      raw.appeal_name as string,
      raw.note as string,
    ]);

    const isRecurring = raw.is_recurring === true || raw.is_recurring === 'true';
    const { interval, warning: iw } = normalizeInterval(raw.recurring_interval);
    if (iw) warnings.push({ type: 'normalization', message: iw, field: 'recurring_interval' });

    return {
      result: {
        date: date.split('T')[0],
        amount: isNaN(amount) ? 0 : amount,
        is_recurring: isRecurring,
        recurring_interval: interval,
        note,
        warnings: warnings.map(w => w.message),
      },
      warnings,
    };
  },
};
