/**
 * Demo gate form validation tests.
 *
 * WHAT: Tests email validation, required fields, and edge cases for the demo gate.
 * WHERE: src/pages/DemoGatePage.tsx validation logic.
 * WHY: Prevents junk submissions from polluting the Gardener pipeline.
 */
import { describe, it, expect } from 'vitest';

// Extract validation logic to test independently
function isValidDemoSubmission(name: string, email: string, location: string): boolean {
  return name.trim().length > 0 && email.includes('@') && location.trim().length > 0;
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

describe('Demo gate validation', () => {
  describe('isValidDemoSubmission', () => {
    it('accepts valid inputs', () => {
      expect(isValidDemoSubmission('Maria Torres', 'maria@org.com', 'Denver')).toBe(true);
    });

    it('rejects empty name', () => {
      expect(isValidDemoSubmission('', 'maria@org.com', 'Denver')).toBe(false);
      expect(isValidDemoSubmission('   ', 'maria@org.com', 'Denver')).toBe(false);
    });

    it('rejects email without @', () => {
      expect(isValidDemoSubmission('Maria', 'notanemail', 'Denver')).toBe(false);
    });

    it('rejects empty location', () => {
      expect(isValidDemoSubmission('Maria', 'a@b.com', '')).toBe(false);
      expect(isValidDemoSubmission('Maria', 'a@b.com', '  ')).toBe(false);
    });
  });

  describe('Edge function email validation', () => {
    it('accepts standard emails', () => {
      expect(isValidEmail('user@example.com')).toBe(true);
      expect(isValidEmail('name+tag@domain.org')).toBe(true);
    });

    it('rejects malformed emails', () => {
      expect(isValidEmail('nope')).toBe(false);
      expect(isValidEmail('@domain.com')).toBe(false);
      expect(isValidEmail('user@')).toBe(false);
      expect(isValidEmail('user @domain.com')).toBe(false);
    });
  });
});
