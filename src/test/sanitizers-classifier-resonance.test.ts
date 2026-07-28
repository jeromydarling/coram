/**
 * Sanitizers + classifier + resonance — Security and impact logic tests.
 *
 * WHAT: Tests sanitizeDescription, sanitizeRecoveryContext, operatorImpactClassifier, communioResonance.
 * WHERE: src/test/sanitizers-classifier-resonance.test.ts
 * WHY: Sanitizers prevent XSS/PII leaks; classifier drives operator triage; resonance shapes discovery.
 */
import { describe, it, expect } from 'vitest';
import { sanitizeEventDescription } from '@/lib/sanitizeDescription';
import { sanitizeRecoveryActions } from '@/lib/sanitizeRecoveryContext';
import { classifyImpact, isAutoResolvable } from '@/lib/operatorImpactClassifier';
import {
  buildResonanceContext,
  computeResultResonance,
  softReorderByResonance,
} from '@/lib/communioResonance';

// ── sanitizeEventDescription ──

describe('sanitizeEventDescription', () => {
  it('strips Zoom URLs and meeting boilerplate', () => {
    const desc = 'Community gathering\nhttps://us02web.zoom.us/j/12345\nMeeting ID: 12345\nPasscode: abc';
    const result = sanitizeEventDescription(desc);
    expect(result).not.toContain('zoom.us');
    expect(result).not.toContain('Meeting ID');
    expect(result).toContain('Community gathering');
  });

  it('strips Google Meet and Teams links', () => {
    const desc = 'A wonderful workshop about community building\nhttps://meet.google.com/abc-def-ghi\nhttps://teams.microsoft.com/l/meetup';
    const result = sanitizeEventDescription(desc);
    expect(result).not.toBeNull();
    expect(result!).not.toContain('meet.google.com');
    expect(result!).not.toContain('teams.microsoft.com');
  });

  it('returns null for description with only meeting content', () => {
    const desc = 'https://us02web.zoom.us/j/12345\nPasscode: abc';
    expect(sanitizeEventDescription(desc)).toBeNull();
  });

  it('preserves meaningful content', () => {
    const desc = 'Annual fundraiser at the community center. Bring your family!';
    expect(sanitizeEventDescription(desc)).toBe(desc);
  });
});

// ── sanitizeRecoveryActions ──

describe('sanitizeRecoveryActions', () => {
  it('keeps allowed keys and strips unknown keys', () => {
    const actions = [
      { event_type: 'click', route: '/people', secret_data: 'oops', entity_name: 'John' },
    ];
    const result = sanitizeRecoveryActions(actions);
    expect(result[0]).toHaveProperty('event_type', 'click');
    expect(result[0]).toHaveProperty('route', '/people');
    expect(result[0]).not.toHaveProperty('secret_data');
    expect(result[0]).not.toHaveProperty('entity_name');
  });

  it('strips values containing PII (emails)', () => {
    const actions = [
      { route: 'user@example.com', event_type: 'navigate' },
    ];
    const result = sanitizeRecoveryActions(actions);
    expect(result[0]).not.toHaveProperty('route');
    expect(result[0]).toHaveProperty('event_type', 'navigate');
  });

  it('strips values containing phone numbers', () => {
    const actions = [
      { route: '555-123-4567', event_type: 'call' },
    ];
    const result = sanitizeRecoveryActions(actions);
    expect(result[0]).not.toHaveProperty('route');
  });

  it('caps at 25 breadcrumbs', () => {
    const actions = Array.from({ length: 50 }, (_, i) => ({ event_type: `e${i}` }));
    expect(sanitizeRecoveryActions(actions)).toHaveLength(25);
  });

  it('handles non-array input', () => {
    expect(sanitizeRecoveryActions('not array' as any)).toEqual([]);
  });
});

// ── operatorImpactClassifier ──

describe('classifyImpact', () => {
  // first_seen_at far in the past so rate-per-day stays low
  const oldDate = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const base = {
    severity: 'medium',
    context: {} as Record<string, unknown>,
    count: 1,
    first_seen_at: oldDate,
    last_seen_at: oldDate,
  };

  it('returns high for critical routes', () => {
    expect(classifyImpact({ ...base, context: { route: '/onboarding/step1' } })).toBe('high');
    expect(classifyImpact({ ...base, context: { route: '/auth/callback' } })).toBe('high');
  });

  it('returns high for 5xx status', () => {
    expect(classifyImpact({ ...base, context: { status: 500 } })).toBe('high');
  });

  it('returns high for severity=high', () => {
    expect(classifyImpact({ ...base, severity: 'high' })).toBe('high');
  });

  it('returns low for single occurrence with non-critical context', () => {
    expect(classifyImpact({ ...base, count: 1, context: { status: 404 } })).toBe('low');
  });

  it('returns normal for repeated 400s', () => {
    expect(classifyImpact({ ...base, count: 3, context: { status: 400 } })).toBe('normal');
  });
});

describe('isAutoResolvable', () => {
  it('returns true if no occurrences in 7+ days and not high', () => {
    const old = new Date(Date.now() - 10 * 86_400_000).toISOString();
    expect(isAutoResolvable({
      severity: 'medium', context: {}, count: 1,
      first_seen_at: old, last_seen_at: old,
    })).toBe(true);
  });

  it('returns false for high severity even if old', () => {
    const old = new Date(Date.now() - 10 * 86_400_000).toISOString();
    expect(isAutoResolvable({
      severity: 'high', context: {}, count: 1,
      first_seen_at: old, last_seen_at: old,
    })).toBe(false);
  });

  it('returns false for recent errors', () => {
    const recent = new Date().toISOString();
    expect(isAutoResolvable({
      severity: 'medium', context: {}, count: 1,
      first_seen_at: recent, last_seen_at: recent,
    })).toBe(false);
  });
});

// ── communioResonance ──

describe('buildResonanceContext', () => {
  it('returns empty context for no snapshots', () => {
    const ctx = buildResonanceContext([]);
    expect(ctx.archetypeKeywords).toEqual([]);
    expect(ctx.totalSignals).toBe(0);
    expect(ctx.communioActive).toBe(false);
  });

  it('aggregates keywords and themes from snapshots', () => {
    const ctx = buildResonanceContext([
      {
        archetype_key: 'church', metro_id: 'm1', search_type: 'web',
        resonant_keywords: ['faith', 'community'],
        signal_count: 5, tenant_count: 3,
        testimonium_themes: ['belonging'],
        communio_participation_count: 2,
      },
    ]);
    expect(ctx.archetypeKeywords).toContain('faith');
    expect(ctx.metroKeywords).toContain('community');
    expect(ctx.testimoniumThemes).toContain('belonging');
    expect(ctx.communioActive).toBe(true);
    expect(ctx.totalSignals).toBe(5);
  });
});

describe('computeResultResonance', () => {
  it('returns zero score for empty context', () => {
    const ctx = buildResonanceContext([]);
    const r = computeResultResonance('some text', ctx, 0);
    expect(r.score).toBe(0);
    expect(r.annotation).toBeNull();
  });

  it('produces annotation above threshold', () => {
    const ctx = buildResonanceContext([{
      archetype_key: 'church', metro_id: 'm1', search_type: 'web',
      resonant_keywords: ['faith'], signal_count: 5, tenant_count: 3,
      testimonium_themes: ['belonging'], communio_participation_count: 1,
    }]);
    const r = computeResultResonance('faith and belonging in community', ctx, 0);
    expect(r.score).toBeGreaterThan(0);
    expect(r.matchedThemes.length).toBeGreaterThan(0);
  });
});

describe('softReorderByResonance', () => {
  it('reorders items with significant score differences', () => {
    const items = [
      { id: 'a', resonanceScore: 0.1 },
      { id: 'b', resonanceScore: 0.9 },
      { id: 'c', resonanceScore: 0.5 },
    ];
    const sorted = softReorderByResonance(items);
    expect(sorted[0].id).toBe('b');
  });

  it('preserves order for similar scores', () => {
    const items = [
      { id: 'a', resonanceScore: 0.5 },
      { id: 'b', resonanceScore: 0.55 },
    ];
    const sorted = softReorderByResonance(items);
    expect(sorted[0].id).toBe('a'); // diff < 0.1 preserves order
  });
});
