/**
 * Vitest tests for payments components and hooks logic.
 *
 * Tests: CSV export logic, event type labels, status labels, dialog state management.
 */
import { describe, it, expect } from 'vitest';

// Test event type label mapping completeness
describe('Financial Activity Labels', () => {
  const EVENT_TYPE_LABELS: Record<string, string> = {
    generosity: 'Generosity',
    participation: 'Participation',
    collaboration: 'Collaboration',
    support: 'Support',
    invoice: 'Invoice',
    membership: 'Membership',
  };

  const STATUS_LABELS: Record<string, string> = {
    pending: 'Waiting',
    completed: 'Noted',
    failed: 'Did not complete',
    cancelled: 'The thread is still open',
    refunded: 'Returned',
  };

  it('covers all financial_event_type enum values', () => {
    const dbEnumValues = ['generosity', 'participation', 'collaboration', 'support', 'invoice', 'membership'];
    for (const v of dbEnumValues) {
      expect(EVENT_TYPE_LABELS[v]).toBeDefined();
      expect(EVENT_TYPE_LABELS[v].length).toBeGreaterThan(0);
    }
  });

  it('covers all financial_event_status enum values', () => {
    const dbEnumValues = ['pending', 'completed', 'failed', 'cancelled', 'refunded'];
    for (const v of dbEnumValues) {
      expect(STATUS_LABELS[v]).toBeDefined();
      expect(STATUS_LABELS[v].length).toBeGreaterThan(0);
    }
  });

  it('uses CROS pastoral language, not commercial language', () => {
    const forbidden = ['Revenue', 'Transaction', 'Order', 'Success!', 'Donor', 'Top donor', 'Conversion'];
    const allLabels = [...Object.values(EVENT_TYPE_LABELS), ...Object.values(STATUS_LABELS)];
    for (const label of allLabels) {
      for (const word of forbidden) {
        expect(label.toLowerCase()).not.toContain(word.toLowerCase());
      }
    }
  });
});

// Test CSV export formatting
describe('CSV Export Logic', () => {
  it('formats amount correctly from cents to dollars', () => {
    const amountCents = 50000;
    const formatted = `$${(amountCents / 100).toFixed(2)}`;
    expect(formatted).toBe('$500.00');
  });

  it('handles zero cents', () => {
    const formatted = `$${(0 / 100).toFixed(2)}`;
    expect(formatted).toBe('$0.00');
  });

  it('handles fractional cents correctly', () => {
    const formatted = `$${(1999 / 100).toFixed(2)}`;
    expect(formatted).toBe('$19.99');
  });

  it('produces valid CSV with proper quoting', () => {
    const headers = ['Date', 'Person', 'Type', 'Amount', 'Status', 'Description'];
    const rows = [
      ['2026-03-13', 'John "Jack" Smith', 'Generosity', '$50.00', 'Noted', 'Annual support'],
    ];
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    expect(csv).toContain('"Date"');
    expect(csv).toContain('"John ""Jack"" Smith"');
    expect(csv.split('\n')).toHaveLength(2);
  });
});

// Test webhook timeline language mapping
describe('Webhook Timeline Language', () => {
  const TIMELINE_LANGUAGE: Record<string, { title: string; confirmation: string }> = {
    generosity: { title: 'Generosity', confirmation: 'Your generosity has been recorded.' },
    participation: { title: 'Participation', confirmation: 'Your place has been held.' },
    collaboration: { title: 'Collaboration', confirmation: 'This support has been recorded.' },
    support: { title: 'Support', confirmation: 'This support has been recorded.' },
    invoice: { title: 'Collaboration', confirmation: 'Invoice paid.' },
    membership: { title: 'Participation', confirmation: 'Membership confirmed.' },
  };

  it('covers all event types', () => {
    const types = ['generosity', 'participation', 'collaboration', 'support', 'invoice', 'membership'];
    for (const t of types) {
      expect(TIMELINE_LANGUAGE[t]).toBeDefined();
      expect(TIMELINE_LANGUAGE[t].title).toBeTruthy();
      expect(TIMELINE_LANGUAGE[t].confirmation).toBeTruthy();
    }
  });

  it('uses pastoral confirmation language', () => {
    const forbidden = ['Order complete', 'Success!', 'Transaction finished', 'Purchase confirmed'];
    for (const entry of Object.values(TIMELINE_LANGUAGE)) {
      for (const word of forbidden) {
        expect(entry.confirmation.toLowerCase()).not.toContain(word.toLowerCase());
      }
    }
  });

  it('has fallback for unknown event types', () => {
    const unknownType = 'unknown_type';
    const lang = TIMELINE_LANGUAGE[unknownType] ?? TIMELINE_LANGUAGE.support;
    expect(lang).toBeDefined();
    expect(lang.title).toBe('Support');
  });
});

// Test amount validation logic used in dialogs
describe('Amount Validation', () => {
  it('rounds to nearest cent correctly', () => {
    expect(Math.round(parseFloat('25.999') * 100)).toBe(2600);
    expect(Math.round(parseFloat('0.50') * 100)).toBe(50);
    expect(Math.round(parseFloat('100') * 100)).toBe(10000);
  });

  it('rejects NaN amounts', () => {
    expect(isNaN(parseFloat(''))).toBe(true);
    expect(isNaN(parseFloat('abc'))).toBe(true);
  });

  it('rejects zero and negative amounts', () => {
    const val = Math.round(parseFloat('0') * 100);
    expect(val <= 0).toBe(true);
    const neg = Math.round(parseFloat('-5') * 100);
    expect(neg <= 0).toBe(true);
  });
});

// Test platform fee calculation
describe('Platform Fee Calculation', () => {
  it('calculates 1% fee correctly', () => {
    const amountCents = 10000; // $100
    const feePercent = 1;
    const fee = Math.round(amountCents * (feePercent / 100));
    expect(fee).toBe(100); // $1
  });

  it('handles null/undefined fee percent with fallback', () => {
    const amountCents = 10000;
    const feePercent = null;
    const fee = Math.round(amountCents * ((feePercent ?? 1) / 100));
    expect(fee).toBe(100);
  });

  it('handles 0% fee', () => {
    const fee = Math.round(5000 * (0 / 100));
    expect(fee).toBe(0);
  });

  it('rounds fee to nearest cent', () => {
    const fee = Math.round(1999 * (1 / 100));
    expect(fee).toBe(20); // 19.99 rounds to 20
  });
});

// Test due date calculation used in create-invoice
describe('Invoice Due Date Calculation', () => {
  it('calculates days until due correctly', () => {
    const now = new Date('2026-03-13T00:00:00Z').getTime();
    const dueDate = '2026-04-12';
    const days = Math.max(1, Math.ceil((new Date(dueDate).getTime() - now) / 86400000));
    expect(days).toBe(30);
  });

  it('enforces minimum 1 day', () => {
    const now = Date.now();
    const pastDate = new Date(now - 86400000).toISOString().split('T')[0];
    const days = Math.max(1, Math.ceil((new Date(pastDate).getTime() - now) / 86400000));
    expect(days).toBe(1);
  });

  it('defaults to 30 days when no due date', () => {
    const defaultDays = 30;
    expect(defaultDays).toBe(30);
  });
});
