/**
 * Event logic — Vitest suite for slug generation, form validation, and public page logic.
 *
 * WHAT: Pure logic tests for event-related utilities used across EventModal, EventSlugShare, and PublicEventPage.
 * WHERE: src/test/events-logic.test.ts
 * WHY: Ensures slug generation, capacity gating, price display, and validation rules are correct.
 */
import { describe, it, expect } from 'vitest';

// ── Slug generation (duplicated from EventSlugShare + EventModal) ──
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

describe('Event Slug Generation', () => {
  it('converts simple name to slug', () => {
    expect(slugify('Annual Gala 2026')).toBe('annual-gala-2026');
  });

  it('handles special characters', () => {
    expect(slugify('St. Mary\'s Spring Festival!')).toBe('st-mary-s-spring-festival');
  });

  it('trims leading/trailing hyphens', () => {
    expect(slugify('  --Hello World--  ')).toBe('hello-world');
  });

  it('truncates at 80 characters', () => {
    const longName = 'A'.repeat(100);
    expect(slugify(longName).length).toBeLessThanOrEqual(80);
  });

  it('handles empty string', () => {
    expect(slugify('')).toBe('');
  });

  it('collapses multiple separators', () => {
    expect(slugify('Event   with   spaces')).toBe('event-with-spaces');
  });

  it('handles unicode/accented characters', () => {
    // Accented chars get stripped (non a-z0-9), leaving hyphens
    expect(slugify('Café Résumé')).toBe('caf-r-sum');
  });

  it('handles numeric-only names', () => {
    expect(slugify('2026')).toBe('2026');
  });
});

// ── Capacity gating logic (from PublicEventPage) ──
describe('Event Capacity Logic', () => {
  it('isFull when regCount >= capacity', () => {
    const capacity = 50;
    const regCount = 50;
    const isFull = capacity && regCount !== undefined ? regCount >= capacity : false;
    expect(isFull).toBe(true);
  });

  it('not full when regCount < capacity', () => {
    const capacity = 50;
    const regCount = 30;
    const isFull = capacity && regCount !== undefined ? regCount >= capacity : false;
    expect(isFull).toBe(false);
  });

  it('not full when capacity is null (unlimited)', () => {
    const capacity = null;
    const regCount = 9999;
    const isFull = capacity && regCount !== undefined ? regCount >= capacity : false;
    expect(isFull).toBe(false);
  });

  it('spots remaining calculation is correct', () => {
    const capacity = 100;
    const regCount = 73;
    const spotsRemaining = capacity - regCount;
    expect(spotsRemaining).toBe(27);
  });
});

// ── Price display logic (from PublicEventPage) ──
describe('Event Price Display', () => {
  it('formats cents to dollars correctly', () => {
    expect((2500 / 100).toFixed(2)).toBe('25.00');
  });

  it('formats zero cents', () => {
    expect((0 / 100).toFixed(2)).toBe('0.00');
  });

  it('formats fractional cents', () => {
    expect((1550 / 100).toFixed(2)).toBe('15.50');
  });

  it('shows paid badge when is_paid and price_cents', () => {
    const is_paid = true;
    const price_cents = 2500;
    const showPaidBadge = !!(is_paid && price_cents);
    expect(showPaidBadge).toBe(true);
  });

  it('hides paid badge when not paid', () => {
    const is_paid = false;
    const price_cents = 2500;
    const showPaidBadge = !!(is_paid && price_cents);
    expect(showPaidBadge).toBe(false);
  });

  it('hides paid badge when price is null', () => {
    const is_paid = true;
    const price_cents = null;
    const showPaidBadge = !!(is_paid && price_cents);
    expect(showPaidBadge).toBe(false);
  });
});

// ── Form validation logic (from EventModal) ──
describe('Event Form Validation', () => {
  function validateEvent(eventName: string, eventDate: string) {
    const errors: Record<string, string> = {};
    if (!eventName.trim()) errors.event_name = 'Event name is required';
    if (!eventDate) errors.event_date = 'Event date is required';
    return errors;
  }

  it('passes with valid name and date', () => {
    const errors = validateEvent('Annual Retreat', '2026-05-15');
    expect(Object.keys(errors)).toHaveLength(0);
  });

  it('fails with empty name', () => {
    const errors = validateEvent('', '2026-05-15');
    expect(errors.event_name).toBe('Event name is required');
  });

  it('fails with whitespace-only name', () => {
    const errors = validateEvent('   ', '2026-05-15');
    expect(errors.event_name).toBe('Event name is required');
  });

  it('fails with empty date', () => {
    const errors = validateEvent('My Event', '');
    expect(errors.event_date).toBe('Event date is required');
  });

  it('returns multiple errors when both invalid', () => {
    const errors = validateEvent('', '');
    expect(Object.keys(errors)).toHaveLength(2);
  });
});

// ── Numeric input parsing (from EventModal) ──
describe('Numeric Input Parsing', () => {
  function parseNumericInput(val: string): number | null {
    if (!val || val.trim() === '') return null;
    const num = parseInt(val, 10);
    return isNaN(num) ? null : num;
  }

  it('parses valid integer', () => {
    expect(parseNumericInput('42')).toBe(42);
  });

  it('returns null for empty string', () => {
    expect(parseNumericInput('')).toBe(null);
  });

  it('returns null for whitespace', () => {
    expect(parseNumericInput('   ')).toBe(null);
  });

  it('returns null for non-numeric', () => {
    expect(parseNumericInput('abc')).toBe(null);
  });

  it('parses leading digits from mixed string', () => {
    expect(parseNumericInput('42abc')).toBe(42);
  });
});

// ── Email validation (from event-register edge function, client-side check) ──
describe('Registration Email Validation', () => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  it('accepts valid email', () => {
    expect(emailRegex.test('user@example.com')).toBe(true);
  });

  it('rejects missing @', () => {
    expect(emailRegex.test('userexample.com')).toBe(false);
  });

  it('rejects missing domain', () => {
    expect(emailRegex.test('user@')).toBe(false);
  });

  it('rejects spaces', () => {
    expect(emailRegex.test('user @example.com')).toBe(false);
  });

  it('accepts subdomain email', () => {
    expect(emailRegex.test('user@mail.example.com')).toBe(true);
  });
});
