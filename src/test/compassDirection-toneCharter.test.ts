/**
 * compassDirection + toneCharter — Direction mapping and CROS vocabulary tests.
 *
 * WHAT: Tests compass direction logic and tone charter enforcement.
 * WHERE: src/test/compassDirection-toneCharter.test.ts
 * WHY: Compass drives pastoral UX; tone charter prevents SaaS drift.
 */
import { describe, it, expect } from 'vitest';
import {
  buildCompassDirection,
  buildCompassWeights,
  buildOrientedWeights,
  dominantDirection,
} from '@/lib/compassDirection';
import {
  crosText,
  containsBannedWord,
  BANNED_WORDS,
  CROS_VOCABULARY,
} from '@/lib/toneCharter';

// ── compassDirection ──

describe('buildCompassDirection', () => {
  it('maps known kinds to correct directions', () => {
    expect(buildCompassDirection('reflection')).toBe('north');
    expect(buildCompassDirection('adoption_signal')).toBe('east');
    expect(buildCompassDirection('visit')).toBe('south');
    expect(buildCompassDirection('entity_restored')).toBe('west');
  });

  it('falls back to south for unknown kinds', () => {
    expect(buildCompassDirection('unknown_thing')).toBe('south');
  });
});

describe('buildCompassWeights', () => {
  it('tallies directions correctly', () => {
    const kinds = ['reflection', 'reflection', 'visit', 'entity_restored'];
    const w = buildCompassWeights(kinds);
    expect(w.north).toBe(2);
    expect(w.south).toBe(1);
    expect(w.west).toBe(1);
    expect(w.east).toBe(0);
  });

  it('returns zeros for empty array', () => {
    const w = buildCompassWeights([]);
    expect(w.north + w.east + w.south + w.west).toBe(0);
  });
});

describe('buildOrientedWeights', () => {
  it('applies human_focused multiplier — doubles south', () => {
    const kinds = ['visit', 'reflection'];
    const w = buildOrientedWeights(kinds, 'human_focused');
    expect(w.south).toBe(2); // 1 * 2
    expect(w.north).toBe(1); // 1 * 1
  });

  it('applies institution_focused multiplier — dampens south', () => {
    const kinds = ['visit', 'reflection'];
    const w = buildOrientedWeights(kinds, 'institution_focused');
    expect(w.south).toBeCloseTo(0.3);
    expect(w.north).toBe(2); // 1 * 2
  });
});

describe('dominantDirection', () => {
  it('returns the direction with highest weight', () => {
    expect(dominantDirection({ north: 5, east: 1, south: 2, west: 0 })).toBe('north');
  });
});

// ── toneCharter ──

describe('crosText', () => {
  it('translates known SaaS terms', () => {
    expect(crosText('Saved!')).toBe('Held.');
    expect(crosText('Success!')).toBe('Noted.');
    expect(crosText('No data')).toBe('Every relationship begins somewhere');
  });

  it('passes through unknown strings', () => {
    expect(crosText('Custom phrase')).toBe('Custom phrase');
  });
});

describe('containsBannedWord', () => {
  it('detects banned words (case-insensitive)', () => {
    expect(containsBannedWord('Let\'s boost engagement!')).toBe('Boost');
    expect(containsBannedWord('Top donor list')).toBe('Top donor');
  });

  it('returns null for clean text', () => {
    expect(containsBannedWord('A gentle signal appeared')).toBeNull();
  });

  it('all BANNED_WORDS are detected by containsBannedWord', () => {
    for (const word of BANNED_WORDS) {
      expect(containsBannedWord(word)).toBe(word);
    }
  });
});
