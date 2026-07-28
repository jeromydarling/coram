/**
 * Form payload / validation schema tests.
 *
 * WHAT: Tests Zod schemas for contacts, events, opportunities.
 * WHERE: src/lib/validations.ts
 * WHY: Ensures form validation catches bad input before DB writes.
 */
import { describe, it, expect } from 'vitest';
import {
  contactSchema,
  eventSchema,
  opportunitySchema,
  parseNumericInput,
  formatValidationErrors,
} from '@/lib/validations';

describe('contactSchema', () => {
  it('accepts valid minimal contact', () => {
    const result = contactSchema.safeParse({ name: 'Jane Doe' });
    expect(result.success).toBe(true);
  });

  it('rejects empty name', () => {
    const result = contactSchema.safeParse({ name: '' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid email format', () => {
    const result = contactSchema.safeParse({ name: 'Jane', email: 'not-email' });
    expect(result.success).toBe(false);
  });

  it('accepts empty string for optional email', () => {
    const result = contactSchema.safeParse({ name: 'Jane', email: '' });
    expect(result.success).toBe(true);
  });

  it('rejects phone with invalid characters', () => {
    const result = contactSchema.safeParse({ name: 'Jane', phone: 'abc-def' });
    expect(result.success).toBe(false);
  });

  it('accepts valid phone with parens and dashes', () => {
    const result = contactSchema.safeParse({ name: 'Jane', phone: '(555) 123-4567' });
    expect(result.success).toBe(true);
  });

  it('trims whitespace from name', () => {
    const result = contactSchema.parse({ name: '  Jane  ' });
    expect(result.name).toBe('Jane');
  });

  it('enforces max name length', () => {
    const result = contactSchema.safeParse({ name: 'A'.repeat(101) });
    expect(result.success).toBe(false);
  });
});

describe('eventSchema', () => {
  const validEvent = {
    event_name: 'Community Gathering',
    event_date: '2025-06-15',
    event_type: 'Distribution',
  };

  it('accepts valid event', () => {
    expect(eventSchema.safeParse(validEvent).success).toBe(true);
  });

  it('rejects missing event_name', () => {
    expect(eventSchema.safeParse({ ...validEvent, event_name: '' }).success).toBe(false);
  });

  it('rejects invalid date format', () => {
    expect(eventSchema.safeParse({ ...validEvent, event_date: '06/15/2025' }).success).toBe(false);
  });

  it('rejects negative staff count', () => {
    expect(eventSchema.safeParse({ ...validEvent, staff_deployed: -1 }).success).toBe(false);
  });

  it('allows null for optional numeric fields', () => {
    const result = eventSchema.safeParse({ ...validEvent, households_served: null });
    expect(result.success).toBe(true);
  });
});

describe('opportunitySchema', () => {
  const validOpp = {
    organization: 'Community Center',
    stage: 'Found',
    partner_tier: 'Anchor',
  };

  it('accepts valid opportunity', () => {
    expect(opportunitySchema.safeParse(validOpp).success).toBe(true);
  });

  it('rejects empty organization', () => {
    expect(opportunitySchema.safeParse({ ...validOpp, organization: '' }).success).toBe(false);
  });

  it('rejects invalid stage', () => {
    expect(opportunitySchema.safeParse({ ...validOpp, stage: 'InvalidStage' }).success).toBe(false);
  });

  it('accepts legacy stage values', () => {
    expect(opportunitySchema.safeParse({ ...validOpp, stage: 'Target Identified' }).success).toBe(true);
    expect(opportunitySchema.safeParse({ ...validOpp, stage: 'Agreement Signed' }).success).toBe(true);
  });
});

describe('parseNumericInput()', () => {
  it('returns number for valid string', () => {
    expect(parseNumericInput('42')).toBe(42);
  });

  it('returns undefined for empty string', () => {
    expect(parseNumericInput('')).toBeUndefined();
  });

  it('returns undefined for NaN', () => {
    expect(parseNumericInput('abc')).toBeUndefined();
  });

  it('returns undefined for whitespace', () => {
    expect(parseNumericInput('  ')).toBeUndefined();
  });
});

describe('formatValidationErrors()', () => {
  it('extracts messages from ZodError', () => {
    const result = contactSchema.safeParse({ name: '' });
    if (!result.success) {
      const messages = formatValidationErrors(result.error);
      expect(messages.length).toBeGreaterThan(0);
      expect(messages[0]).toContain('required');
    }
  });
});
