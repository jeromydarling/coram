import { describe, it, expect } from 'vitest';
import {
  slugifyTopic,
  normalizeTopicCounts,
  computeDrift,
  driftScoreLabel,
} from '@/lib/drift-engine-browser';
import type { TopicCounts, SourceMix } from '@/lib/drift-engine-browser';

describe('slugifyTopic', () => {
  it('lowercases and trims', () => {
    expect(slugifyTopic('  Housing Programs  ')).toBe('housing-programs');
  });

  it('removes punctuation', () => {
    expect(slugifyTopic('K-12 Education!')).toBe('k-12-education');
  });

  it('collapses multiple spaces/dashes', () => {
    expect(slugifyTopic('digital   divide --  access')).toBe('digital-divide-access');
  });

  it('returns empty string for empty input', () => {
    expect(slugifyTopic('')).toBe('');
  });
});

describe('normalizeTopicCounts', () => {
  it('slugifies keys and keeps top 30', () => {
    const raw: Record<string, number> = {};
    for (let i = 0; i < 40; i++) raw[`Topic ${i}`] = 40 - i;
    const result = normalizeTopicCounts(raw);
    expect(Object.keys(result).length).toBeLessThanOrEqual(30);
  });

  it('merges duplicate slugs', () => {
    const result = normalizeTopicCounts({ 'Housing': 3, 'housing': 2 });
    expect(result['housing']).toBe(5);
  });

  it('clamps negative values to 0', () => {
    const result = normalizeTopicCounts({ 'test': -5 });
    expect(result['test']).toBe(0);
  });
});

describe('computeDrift', () => {
  const makeSnapshot = (topics: TopicCounts, signals: TopicCounts = {}, mix: SourceMix = {}) => ({
    topic_counts: topics,
    signal_counts: signals,
    source_mix: mix,
  });

  it('returns drift_score=0 for first snapshot (no previous)', () => {
    const result = computeDrift(null, makeSnapshot({ housing: 5 }));
    expect(result.drift_score).toBe(0);
    expect(result.summary_md).toContain('first chapter');
    expect(result.stable_themes.length).toBeGreaterThan(0);
  });

  it('drift_score is bounded 0..100', () => {
    // Extreme change
    const prev = makeSnapshot({ a: 100, b: 100, c: 100, d: 100, e: 100, f: 100, g: 100, h: 100, i: 100, j: 100 });
    const curr = makeSnapshot({ z: 100, y: 100, x: 100, w: 100, v: 100, u: 100, t: 100, s: 100, r: 100, q: 100 });
    const result = computeDrift(prev, curr);
    expect(result.drift_score).toBeGreaterThanOrEqual(0);
    expect(result.drift_score).toBeLessThanOrEqual(100);
  });

  it('detects emerging topics when count >= threshold and was absent', () => {
    const prev = makeSnapshot({ housing: 5 });
    const curr = makeSnapshot({ housing: 5, education: 3 });
    const result = computeDrift(prev, curr);
    expect(result.emerging_topics.some(t => t.topic === 'education')).toBe(true);
  });

  it('detects fading topics when count drops significantly', () => {
    const prev = makeSnapshot({ housing: 10 });
    const curr = makeSnapshot({ housing: 5 });
    const result = computeDrift(prev, curr);
    // delta = -5, which is <= FADING_THRESHOLD (-2)
    expect(result.fading_topics.some(t => t.topic === 'housing')).toBe(true);
  });

  it('detects divergence when news rises but reflections do not', () => {
    const prev = makeSnapshot({}, {}, { news: 2, reflections: 5 });
    const curr = makeSnapshot({}, {}, { news: 10, reflections: 5 });
    const result = computeDrift(prev, curr);
    expect(result.divergence['news_vs_reflections']).toBeDefined();
  });

  it('no divergence when sources move together', () => {
    const prev = makeSnapshot({}, {}, { news: 5, reflections: 5 });
    const curr = makeSnapshot({}, {}, { news: 7, reflections: 7 });
    const result = computeDrift(prev, curr);
    expect(result.divergence['news_vs_reflections']).toBeUndefined();
  });

  it('stable themes detected for topics with minimal change', () => {
    const prev = makeSnapshot({ housing: 5, education: 3 });
    const curr = makeSnapshot({ housing: 5, education: 4 });
    const result = computeDrift(prev, curr);
    expect(result.stable_themes.length).toBeGreaterThan(0);
  });
});

describe('driftScoreLabel', () => {
  it('returns steady for 0-20', () => {
    expect(driftScoreLabel(0)).toBe('steady');
    expect(driftScoreLabel(20)).toBe('steady');
  });

  it('returns shifting for 21-50', () => {
    expect(driftScoreLabel(21)).toBe('shifting');
    expect(driftScoreLabel(50)).toBe('shifting');
  });

  it('returns changing for 51+', () => {
    expect(driftScoreLabel(51)).toBe('changing');
    expect(driftScoreLabel(100)).toBe('changing');
  });
});
