import { describe, it, expect } from 'vitest';
import { toChapterLabel, isCanonicalChapter, CHAPTERS } from '../journeyChapters';

describe('toChapterLabel', () => {
  it('maps legacy "Target Identified" to "Found"', () => {
    expect(toChapterLabel('Target Identified')).toBe('Found');
  });

  it('maps legacy "Contacted" to "First Conversation"', () => {
    expect(toChapterLabel('Contacted')).toBe('First Conversation');
  });

  it('maps both "Discovery Scheduled" and "Discovery Held" to "Discovery"', () => {
    expect(toChapterLabel('Discovery Scheduled')).toBe('Discovery');
    expect(toChapterLabel('Discovery Held')).toBe('Discovery');
  });

  it('maps legacy "Proposal Sent" to "Pricing Shared"', () => {
    expect(toChapterLabel('Proposal Sent')).toBe('Pricing Shared');
  });

  it('maps both "Agreement Pending" and "Agreement Signed" to "Account Setup"', () => {
    expect(toChapterLabel('Agreement Pending')).toBe('Account Setup');
    expect(toChapterLabel('Agreement Signed')).toBe('Account Setup');
  });

  it('maps "First Volume" to "First Devices"', () => {
    expect(toChapterLabel('First Volume')).toBe('First Devices');
  });

  it('maps "Stable Producer" to "Growing Together"', () => {
    expect(toChapterLabel('Stable Producer')).toBe('Growing Together');
  });

  it('maps "Closed - Not a Fit" to "Not the Right Time"', () => {
    expect(toChapterLabel('Closed - Not a Fit')).toBe('Not the Right Time');
  });

  it('returns canonical chapter if already canonical', () => {
    for (const ch of CHAPTERS) {
      expect(toChapterLabel(ch)).toBe(ch);
    }
  });

  it('returns "Found" for null/undefined', () => {
    expect(toChapterLabel(null)).toBe('Found');
    expect(toChapterLabel(undefined)).toBe('Found');
  });

  it('returns "Found" for unknown values', () => {
    expect(toChapterLabel('Some Random Stage')).toBe('Found');
    expect(toChapterLabel('')).toBe('Found');
  });
});

describe('isCanonicalChapter', () => {
  it('returns true for all canonical chapters', () => {
    for (const ch of CHAPTERS) {
      expect(isCanonicalChapter(ch)).toBe(true);
    }
  });

  it('returns false for legacy stage names', () => {
    expect(isCanonicalChapter('Target Identified')).toBe(false);
    expect(isCanonicalChapter('Contacted')).toBe(false);
    expect(isCanonicalChapter('Discovery Held')).toBe(false);
  });

  it('returns false for random strings', () => {
    expect(isCanonicalChapter('hello')).toBe(false);
    expect(isCanonicalChapter('')).toBe(false);
  });
});
