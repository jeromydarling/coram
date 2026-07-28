import { describe, it, expect } from 'vitest';
import {
  formatDuration,
  formatErrorRate,
  truncateError,
  workflowLabel,
  statusVariant,
} from '@/lib/automationHealthFormatters';

describe('automationHealthFormatters', () => {
  describe('formatDuration', () => {
    it('returns — for null', () => {
      expect(formatDuration(null)).toBe('—');
    });

    it('returns <1s for fractional seconds', () => {
      expect(formatDuration(0.3)).toBe('<1s');
    });

    it('formats seconds', () => {
      expect(formatDuration(45)).toBe('45s');
    });

    it('formats minutes and seconds', () => {
      expect(formatDuration(125)).toBe('2m 5s');
    });

    it('formats exact minutes', () => {
      expect(formatDuration(120)).toBe('2m');
    });
  });

  describe('formatErrorRate', () => {
    it('returns 0% for null', () => {
      expect(formatErrorRate(null)).toBe('0%');
    });

    it('formats percentage', () => {
      expect(formatErrorRate(12.5)).toBe('12.5%');
    });
  });

  describe('truncateError', () => {
    it('returns — for null', () => {
      expect(truncateError(null)).toBe('—');
    });

    it('returns short messages as-is', () => {
      expect(truncateError('short error')).toBe('short error');
    });

    it('truncates long messages', () => {
      const long = 'a'.repeat(100);
      const result = truncateError(long, 80);
      expect(result.length).toBe(81); // 80 + …
      expect(result.endsWith('…')).toBe(true);
    });
  });

  describe('workflowLabel', () => {
    it('maps known keys', () => {
      expect(workflowLabel('partner_enrich')).toBe('Partner Enrich');
      expect(workflowLabel('recommendations_generate')).toBe('Recommendations');
    });

    it('returns unknown keys as-is', () => {
      expect(workflowLabel('unknown_workflow')).toBe('unknown_workflow');
    });
  });

  describe('statusVariant', () => {
    it('returns correct variants', () => {
      expect(statusVariant('processed')).toBe('default');
      expect(statusVariant('error')).toBe('destructive');
      expect(statusVariant('dispatched')).toBe('secondary');
      expect(statusVariant('running')).toBe('secondary');
      expect(statusVariant('unknown')).toBe('outline');
    });
  });
});
